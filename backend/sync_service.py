"""
LOTTOLAB - Lottery Status Synchronization Service
==================================================
Service centralisé pour gérer l'état ouvert/fermé des loteries
basé sur les horaires configurés par le Super Admin.

Ce service:
1. Vérifie périodiquement l'état des loteries
2. Émet des événements WebSocket quand une loterie s'ouvre/ferme
3. Fournit des endpoints pour obtenir l'état en temps réel
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import pytz
import asyncio
import logging

from models import UserRole
from auth import decode_token
from utils import get_current_timestamp, generate_id
from websocket_manager import (
    emit_lottery_status_change,
    emit_schedule_change,
    emit_result_change,
    emit_sync_required,
    emit_lottery_toggled
)

logger = logging.getLogger(__name__)

sync_service_router = APIRouter(prefix="/api/sync", tags=["Sync Service"])
security = HTTPBearer()

db = None


def set_sync_service_db(database):
    """Initialize database for sync service"""
    global db
    db = database


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from token"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return user


def require_super_admin(user: dict):
    """Require Super Admin role"""
    if user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès réservé au Super Admin")
    return user


# ============================================================================
# LOTTERY STATUS CALCULATION
# ============================================================================

def calculate_lottery_status(
    schedule: dict, 
    company_timezone: str = "America/Port-au-Prince"
) -> Dict[str, Any]:
    """
    Calculate if a lottery is currently open based on its schedule.
    
    Returns:
    - is_open: Boolean
    - open_time: "HH:MM"
    - close_time: "HH:MM"
    - draw_time: "HH:MM"
    - time_until_close: seconds (if open)
    - time_until_open: seconds (if closed)
    - status_text: Human readable status
    """
    try:
        tz = pytz.timezone(company_timezone)
    except:
        tz = pytz.timezone("America/Port-au-Prince")
    
    now = datetime.now(tz)
    current_weekday = now.weekday()
    
    # Check if today is in the schedule's days_of_week
    days_of_week = schedule.get("days_of_week", [])
    if days_of_week and current_weekday not in days_of_week:
        return {
            "is_open": False,
            "open_time": schedule.get("open_time"),
            "close_time": schedule.get("close_time"),
            "draw_time": schedule.get("draw_time"),
            "time_until_close": None,
            "time_until_open": None,
            "status_text": "Pas de tirage aujourd'hui",
            "reason": "not_scheduled_today"
        }
    
    open_time_str = schedule.get("open_time", "00:00")
    close_time_str = schedule.get("close_time", "23:59")
    draw_time_str = schedule.get("draw_time", close_time_str)
    
    # Parse times
    try:
        open_h, open_m = map(int, open_time_str.split(":"))
        close_h, close_m = map(int, close_time_str.split(":"))
    except:
        return {
            "is_open": False,
            "error": "Invalid time format"
        }
    
    # Convert to minutes since midnight
    current_mins = now.hour * 60 + now.minute
    open_mins = open_h * 60 + open_m
    close_mins = close_h * 60 + close_m
    
    # Handle overnight schedules (close_time < open_time, e.g., 22:00 - 02:00)
    is_overnight = close_mins < open_mins
    
    if is_overnight:
        # Overnight: open if current >= open OR current < close
        is_open = current_mins >= open_mins or current_mins < close_mins
    else:
        # Normal: open if open <= current < close
        is_open = open_mins <= current_mins < close_mins
    
    # Calculate time until close/open
    time_until_close = None
    time_until_open = None
    
    if is_open:
        if is_overnight and current_mins < close_mins:
            time_until_close = (close_mins - current_mins) * 60
        elif is_overnight:
            time_until_close = ((24 * 60 - current_mins) + close_mins) * 60
        else:
            time_until_close = (close_mins - current_mins) * 60
        
        # Format time remaining
        hours = time_until_close // 3600
        mins = (time_until_close % 3600) // 60
        if hours > 0:
            status_text = f"Ferme dans {hours}h{mins:02d}"
        else:
            status_text = f"Ferme dans {mins}min"
    else:
        # Calculate time until open
        if current_mins < open_mins:
            time_until_open = (open_mins - current_mins) * 60
        else:
            # Opens tomorrow
            time_until_open = ((24 * 60 - current_mins) + open_mins) * 60
        
        hours = time_until_open // 3600
        mins = (time_until_open % 3600) // 60
        if hours > 0:
            status_text = f"Ouvre dans {hours}h{mins:02d}"
        else:
            status_text = f"Ouvre dans {mins}min"
    
    return {
        "is_open": is_open,
        "open_time": open_time_str,
        "close_time": close_time_str,
        "draw_time": draw_time_str,
        "time_until_close": time_until_close if is_open else None,
        "time_until_open": time_until_open if not is_open else None,
        "status_text": status_text,
        "current_time": now.strftime("%H:%M:%S"),
        "timezone": company_timezone
    }


# ============================================================================
# REAL-TIME LOTTERY STATUS ENDPOINT
# ============================================================================

@sync_service_router.get("/lotteries/status")
async def get_all_lotteries_status(
    current_user: dict = Depends(get_current_user),
    company_id: Optional[str] = None
):
    """
    Get real-time open/close status for all lotteries.
    Returns only OPEN lotteries for sellers, all for admins.
    """
    user_role = current_user.get("role")
    user_company_id = current_user.get("company_id") or company_id
    
    # Get company timezone
    company_tz = "America/Port-au-Prince"
    if user_company_id:
        company = await db.companies.find_one(
            {"company_id": user_company_id},
            {"_id": 0, "timezone": 1}
        )
        if company:
            company_tz = company.get("timezone", "America/Port-au-Prince")
    
    # Get all active lotteries
    lotteries = await db.master_lotteries.find(
        {"is_active_global": True},
        {"_id": 0}
    ).to_list(500)
    
    # Get schedules
    lottery_ids = [l["lottery_id"] for l in lotteries]
    schedules = await db.global_schedules.find(
        {"lottery_id": {"$in": lottery_ids}, "is_active": True},
        {"_id": 0}
    ).to_list(1000)
    
    # Build schedule map
    schedule_map = {}
    for sched in schedules:
        lid = sched.get("lottery_id")
        if lid not in schedule_map:
            schedule_map[lid] = []
        schedule_map[lid].append(sched)
    
    # Calculate status for each lottery
    result = []
    for lottery in lotteries:
        lid = lottery.get("lottery_id")
        lottery_schedules = schedule_map.get(lid, [])
        
        # Find the active schedule for today
        active_status = None
        for sched in lottery_schedules:
            status = calculate_lottery_status(sched, company_tz)
            if status.get("is_open"):
                active_status = status
                active_status["draw_name"] = sched.get("draw_name")
                break
            elif not active_status or (status.get("time_until_open") and 
                  (not active_status.get("time_until_open") or 
                   status["time_until_open"] < active_status["time_until_open"])):
                active_status = status
                active_status["draw_name"] = sched.get("draw_name")
        
        if not active_status:
            active_status = {
                "is_open": False,
                "status_text": "Pas de tirage configuré"
            }
        
        lottery_data = {
            **lottery,
            **active_status
        }
        
        # For sellers/agents, only return OPEN lotteries
        if user_role == UserRole.AGENT_POS:
            if active_status.get("is_open"):
                result.append(lottery_data)
        else:
            result.append(lottery_data)
    
    # Sort: Open first, then by name
    result.sort(key=lambda x: (not x.get("is_open", False), x.get("lottery_name", "")))
    
    return {
        "lotteries": result,
        "total": len(result),
        "open_count": len([l for l in result if l.get("is_open")]),
        "closed_count": len([l for l in result if not l.get("is_open")]),
        "server_time": datetime.now(timezone.utc).isoformat(),
        "timezone": company_tz
    }


@sync_service_router.get("/lottery/{lottery_id}/status")
async def get_lottery_status(
    lottery_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get real-time status for a specific lottery."""
    user_company_id = current_user.get("company_id")
    
    # Get company timezone
    company_tz = "America/Port-au-Prince"
    if user_company_id:
        company = await db.companies.find_one(
            {"company_id": user_company_id},
            {"_id": 0, "timezone": 1}
        )
        if company:
            company_tz = company.get("timezone", "America/Port-au-Prince")
    
    # Get lottery
    lottery = await db.master_lotteries.find_one(
        {"lottery_id": lottery_id},
        {"_id": 0}
    )
    
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    # Get schedules
    schedules = await db.global_schedules.find(
        {"lottery_id": lottery_id, "is_active": True},
        {"_id": 0}
    ).to_list(50)
    
    # Calculate status for each schedule
    schedule_statuses = []
    for sched in schedules:
        status = calculate_lottery_status(sched, company_tz)
        status["draw_name"] = sched.get("draw_name")
        status["schedule_id"] = sched.get("schedule_id")
        schedule_statuses.append(status)
    
    # Find if any schedule is currently open
    is_any_open = any(s.get("is_open") for s in schedule_statuses)
    
    return {
        "lottery_id": lottery_id,
        "lottery_name": lottery.get("lottery_name"),
        "is_active_global": lottery.get("is_active_global"),
        "is_open": is_any_open,
        "schedules": schedule_statuses,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "timezone": company_tz
    }


# ============================================================================
# SUPER ADMIN - TOGGLE LOTTERY STATUS
# ============================================================================

@sync_service_router.post("/lottery/{lottery_id}/toggle")
async def toggle_lottery_status(
    lottery_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Super Admin: Toggle lottery active/inactive status.
    This immediately broadcasts to all connected clients.
    """
    require_super_admin(current_user)
    
    lottery = await db.master_lotteries.find_one(
        {"lottery_id": lottery_id},
        {"_id": 0}
    )
    
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    new_status = not lottery.get("is_active_global", True)
    now = get_current_timestamp()
    
    await db.master_lotteries.update_one(
        {"lottery_id": lottery_id},
        {"$set": {
            "is_active_global": new_status,
            "updated_at": now,
            "updated_by": current_user.get("user_id")
        }}
    )
    
    # Broadcast change via WebSocket
    background_tasks.add_task(
        emit_lottery_toggled,
        lottery_id,
        lottery.get("lottery_name"),
        new_status
    )
    
    # Also emit status change
    background_tasks.add_task(
        emit_lottery_status_change,
        lottery_id,
        lottery.get("lottery_name"),
        new_status,
        None,
        None,
        "manual_toggle"
    )
    
    logger.info(f"[SYNC] Lottery {lottery.get('lottery_name')} toggled to {'ACTIVE' if new_status else 'INACTIVE'} by {current_user.get('email')}")
    
    return {
        "success": True,
        "lottery_id": lottery_id,
        "lottery_name": lottery.get("lottery_name"),
        "is_active": new_status,
        "message": f"Loterie {'activée' if new_status else 'désactivée'}"
    }


# ============================================================================
# SUPER ADMIN - UPDATE SCHEDULE
# ============================================================================

@sync_service_router.put("/schedule/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    open_time: Optional[str] = None,
    close_time: Optional[str] = None,
    draw_time: Optional[str] = None,
    is_active: Optional[bool] = None,
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Super Admin: Update a schedule's times.
    Broadcasts changes to all clients immediately.
    """
    require_super_admin(current_user)
    
    schedule = await db.global_schedules.find_one(
        {"schedule_id": schedule_id},
        {"_id": 0}
    )
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Horaire non trouvé")
    
    now = get_current_timestamp()
    update_fields = {"updated_at": now, "updated_by": current_user.get("user_id")}
    
    if open_time is not None:
        update_fields["open_time"] = open_time
    if close_time is not None:
        update_fields["close_time"] = close_time
    if draw_time is not None:
        update_fields["draw_time"] = draw_time
    if is_active is not None:
        update_fields["is_active"] = is_active
    
    await db.global_schedules.update_one(
        {"schedule_id": schedule_id},
        {"$set": update_fields}
    )
    
    # Get lottery name for broadcast
    lottery = await db.master_lotteries.find_one(
        {"lottery_id": schedule.get("lottery_id")},
        {"_id": 0, "lottery_name": 1}
    )
    lottery_name = lottery.get("lottery_name") if lottery else "Unknown"
    
    # Broadcast change via WebSocket
    if background_tasks:
        background_tasks.add_task(
            emit_schedule_change,
            schedule.get("lottery_id"),
            lottery_name,
            schedule.get("draw_name"),
            open_time or schedule.get("open_time"),
            close_time or schedule.get("close_time"),
            draw_time or schedule.get("draw_time")
        )
        
        # Also request full sync
        background_tasks.add_task(emit_sync_required, None, "schedule_updated")
    
    logger.info(f"[SYNC] Schedule {schedule_id} updated by {current_user.get('email')}")
    
    return {
        "success": True,
        "schedule_id": schedule_id,
        "lottery_name": lottery_name,
        "draw_name": schedule.get("draw_name"),
        "open_time": open_time or schedule.get("open_time"),
        "close_time": close_time or schedule.get("close_time"),
        "draw_time": draw_time or schedule.get("draw_time"),
        "message": "Horaire mis à jour"
    }


# ============================================================================
# COMPANY ADMIN - GET LOTTERIES WITH STATUS
# ============================================================================

@sync_service_router.get("/company/lotteries")
async def get_company_lotteries_with_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all lotteries for the current user's company with real-time status.
    """
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Compagnie non trouvée")
    
    # Get company timezone
    company = await db.companies.find_one(
        {"company_id": company_id},
        {"_id": 0, "timezone": 1}
    )
    company_tz = company.get("timezone", "America/Port-au-Prince") if company else "America/Port-au-Prince"
    
    # Get enabled lotteries for company
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "$or": [{"is_enabled": True}, {"enabled": True}, {"is_enabled_for_company": True}]},
        {"_id": 0}
    ).to_list(500)
    
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    if not lottery_ids:
        return {"lotteries": [], "total": 0, "open_count": 0}
    
    # Get lottery details
    lotteries = await db.master_lotteries.find(
        {"lottery_id": {"$in": lottery_ids}, "is_active_global": True},
        {"_id": 0}
    ).to_list(500)
    
    # Get schedules
    schedules = await db.global_schedules.find(
        {"lottery_id": {"$in": lottery_ids}, "is_active": True},
        {"_id": 0}
    ).to_list(1000)
    
    schedule_map = {}
    for sched in schedules:
        lid = sched.get("lottery_id")
        if lid not in schedule_map:
            schedule_map[lid] = []
        schedule_map[lid].append(sched)
    
    result = []
    for lottery in lotteries:
        lid = lottery.get("lottery_id")
        lottery_schedules = schedule_map.get(lid, [])
        
        # Calculate status
        active_status = {"is_open": False, "status_text": "Pas de tirage"}
        for sched in lottery_schedules:
            status = calculate_lottery_status(sched, company_tz)
            if status.get("is_open"):
                active_status = status
                active_status["draw_name"] = sched.get("draw_name")
                break
            elif status.get("time_until_open"):
                if not active_status.get("time_until_open") or status["time_until_open"] < active_status.get("time_until_open", float("inf")):
                    active_status = status
                    active_status["draw_name"] = sched.get("draw_name")
        
        result.append({
            **lottery,
            **active_status,
            "schedules": lottery_schedules
        })
    
    # Sort: Open first, Haiti flag first
    result.sort(key=lambda x: (
        not x.get("is_open", False),
        x.get("flag_type") != "HAITI",
        x.get("lottery_name", "")
    ))
    
    return {
        "lotteries": result,
        "total": len(result),
        "open_count": len([l for l in result if l.get("is_open")]),
        "server_time": datetime.now(timezone.utc).isoformat(),
        "timezone": company_tz
    }


# ============================================================================
# VENDEUR - GET ONLY OPEN LOTTERIES
# ============================================================================

@sync_service_router.get("/vendeur/open-lotteries")
async def get_open_lotteries_for_seller(
    current_user: dict = Depends(get_current_user)
):
    """
    Get ONLY open lotteries for vendor sale page.
    Closed lotteries are completely hidden from this endpoint.
    """
    user_email = current_user.get("email", "unknown")
    company_id = current_user.get("company_id")
    
    logger.info(f"[VENDEUR-LOTTERIES] Request from user={user_email}, company_id={company_id}")
    
    if not company_id:
        logger.warning(f"[VENDEUR-LOTTERIES] No company_id for user={user_email}")
        raise HTTPException(status_code=400, detail="Compagnie non trouvée")
    
    # Get company
    company = await db.companies.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    company_tz = company.get("timezone", "America/Port-au-Prince") if company else "America/Port-au-Prince"
    
    # Get enabled lotteries
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "$or": [{"is_enabled": True}, {"enabled": True}, {"is_enabled_for_company": True}]},
        {"_id": 0}
    ).to_list(500)
    
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    logger.info(f"[VENDEUR-LOTTERIES] company_id={company_id}, enabled_lotteries={len(lottery_ids)}")
    
    if not lottery_ids:
        logger.warning(f"[VENDEUR-LOTTERIES] No enabled lotteries for company_id={company_id}")
        return {"lotteries": [], "open_count": 0, "debug": {"company_id": company_id, "enabled_count": 0}}
    
    # Get active global lotteries
    lotteries = await db.master_lotteries.find(
        {"lottery_id": {"$in": lottery_ids}, "is_active_global": True},
        {"_id": 0}
    ).to_list(500)
    
    logger.info(f"[VENDEUR-LOTTERIES] master_lotteries found={len(lotteries)}")
    
    # Get schedules
    schedules = await db.global_schedules.find(
        {"lottery_id": {"$in": lottery_ids}, "is_active": True},
        {"_id": 0}
    ).to_list(1000)
    
    logger.info(f"[VENDEUR-LOTTERIES] active_schedules found={len(schedules)}")
    
    schedule_map = {}
    for sched in schedules:
        lid = sched.get("lottery_id")
        if lid not in schedule_map:
            schedule_map[lid] = []
        schedule_map[lid].append(sched)
    
    # Only return OPEN lotteries
    open_lotteries = []
    for lottery in lotteries:
        lid = lottery.get("lottery_id")
        lottery_schedules = schedule_map.get(lid, [])
        
        for sched in lottery_schedules:
            status = calculate_lottery_status(sched, company_tz)
            if status.get("is_open"):
                open_lotteries.append({
                    **lottery,
                    **status,
                    "draw_name": sched.get("draw_name"),
                    "schedule_id": sched.get("schedule_id")
                })
                break  # Only add once per lottery
    
    # Sort: Haiti first, then by name
    open_lotteries.sort(key=lambda x: (
        x.get("flag_type") != "HAITI",
        x.get("lottery_name", "")
    ))
    
    logger.info(f"[VENDEUR-LOTTERIES] FINAL: user={user_email}, company={company_id}, open_count={len(open_lotteries)}")
    
    return {
        "lotteries": open_lotteries,
        "open_count": len(open_lotteries),
        "server_time": datetime.now(timezone.utc).isoformat(),
        "timezone": company_tz
    }
