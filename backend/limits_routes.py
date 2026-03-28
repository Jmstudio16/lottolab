"""
LOTTOLAB - Intelligent Limits System (PHASE 3)
================================================
Complete betting limits management for lottery operations:
1. Max bet per number configurable by Super Admin
2. Real-time alerts when limits are reached
3. Automatic blocking of numbers exceeding limits
4. Dynamic limit management synchronized across all agents
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
import logging

from models import UserRole
from auth import decode_token
from utils import generate_id, get_current_timestamp
from security_system import create_audit_log

limits_router = APIRouter(prefix="/api/limits", tags=["Intelligent Limits"])
security = HTTPBearer()
logger = logging.getLogger(__name__)

db = None

def set_limits_db(database):
    global db
    db = database


# ============================================================================
# AUTHENTICATION HELPERS
# ============================================================================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user"""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return user


async def require_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require SUPER_ADMIN role"""
    user = await get_current_user(credentials)
    if user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès Super Admin requis")
    return user


async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require admin roles"""
    user = await get_current_user(credentials)
    allowed_roles = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return user


# ============================================================================
# MODELS
# ============================================================================

class LimitConfig(BaseModel):
    """Global limit configuration"""
    default_max_bet_per_number: float = Field(5000.0, ge=0, description="Max bet per number in HTG")
    default_max_bet_per_ticket: float = Field(50000.0, ge=0, description="Max total bet per ticket")
    alert_threshold_percentage: float = Field(80.0, ge=0, le=100, description="Alert when % of limit reached")
    auto_block_enabled: bool = Field(True, description="Auto-block numbers exceeding limits")
    block_duration_minutes: int = Field(0, description="0 = block until next draw")


class NumberLimitUpdate(BaseModel):
    """Update limit for a specific number"""
    number: str
    max_bet: float = Field(..., ge=0)
    lottery_id: Optional[str] = None
    draw_name: Optional[str] = None


class BetCheckRequest(BaseModel):
    """Request to check if a bet is allowed"""
    lottery_id: str
    draw_name: str
    draw_date: str
    plays: List[Dict[str, Any]]  # [{numbers: "12", bet_type: "BORLETTE", amount: 100}]


class AlertAcknowledge(BaseModel):
    """Acknowledge an alert"""
    alert_id: str
    notes: Optional[str] = None


# ============================================================================
# DEFAULT CONFIGURATION
# ============================================================================

DEFAULT_LIMIT_CONFIG = {
    "config_id": "global_limits",
    "default_max_bet_per_number": 5000.0,  # 5000 HTG max per number
    "default_max_bet_per_ticket": 50000.0,  # 50000 HTG max per ticket
    "alert_threshold_percentage": 80.0,  # Alert at 80%
    "auto_block_enabled": True,
    "block_duration_minutes": 0,  # 0 = until next draw
    "number_specific_limits": {},  # {"12": 10000, "00": 3000}
    "lottery_specific_limits": {},  # {"lotto_ny_midi": {"max_per_number": 3000}}
    "created_at": None,
    "updated_at": None
}


# ============================================================================
# 1. LIMIT CONFIGURATION MANAGEMENT
# ============================================================================

@limits_router.get("/config")
async def get_limit_config(
    current_user: dict = Depends(require_admin)
):
    """Get current limit configuration"""
    config = await db.limit_config.find_one({"config_id": "global_limits"}, {"_id": 0})
    
    if not config:
        # Initialize default config
        config = DEFAULT_LIMIT_CONFIG.copy()
        config["created_at"] = get_current_timestamp()
        config["updated_at"] = get_current_timestamp()
        await db.limit_config.insert_one(config)
        config.pop("_id", None)
    
    return config


@limits_router.put("/config")
async def update_limit_config(
    request: Request,
    data: LimitConfig,
    current_user: dict = Depends(require_super_admin)
):
    """Update global limit configuration (Super Admin only)"""
    now = get_current_timestamp()
    
    # Get current config for audit
    old_config = await db.limit_config.find_one({"config_id": "global_limits"})
    
    update_data = {
        "default_max_bet_per_number": data.default_max_bet_per_number,
        "default_max_bet_per_ticket": data.default_max_bet_per_ticket,
        "alert_threshold_percentage": data.alert_threshold_percentage,
        "auto_block_enabled": data.auto_block_enabled,
        "block_duration_minutes": data.block_duration_minutes,
        "updated_at": now,
        "updated_by": current_user.get("user_id")
    }
    
    await db.limit_config.update_one(
        {"config_id": "global_limits"},
        {"$set": update_data},
        upsert=True
    )
    
    # Create audit log
    await create_audit_log(
        db=db,
        action="LIMIT_CONFIG_UPDATE",
        user_id=current_user.get("user_id"),
        request=request,
        details={
            "old_max_bet": old_config.get("default_max_bet_per_number") if old_config else None,
            "new_max_bet": data.default_max_bet_per_number,
            "old_auto_block": old_config.get("auto_block_enabled") if old_config else None,
            "new_auto_block": data.auto_block_enabled
        },
        entity_type="limit_config",
        entity_id="global_limits",
        severity="WARNING",
        company_id=current_user.get("company_id")
    )
    
    # Broadcast config change to sync service
    await db.realtime_events.insert_one({
        "event_id": generate_id("evt_"),
        "event_type": "LIMITS_CONFIG_UPDATED",
        "data": update_data,
        "created_at": now
    })
    
    return {"message": "Configuration des limites mise à jour", "config": update_data}


@limits_router.put("/config/number")
async def update_number_limit(
    request: Request,
    data: NumberLimitUpdate,
    current_user: dict = Depends(require_super_admin)
):
    """Set a specific limit for a number (Super Admin only)"""
    now = get_current_timestamp()
    
    # Update number-specific limit in config
    key = f"number_specific_limits.{data.number}"
    
    await db.limit_config.update_one(
        {"config_id": "global_limits"},
        {
            "$set": {
                key: data.max_bet,
                "updated_at": now
            }
        }
    )
    
    # Create audit log
    await create_audit_log(
        db=db,
        action="NUMBER_LIMIT_SET",
        user_id=current_user.get("user_id"),
        request=request,
        details={
            "number": data.number,
            "max_bet": data.max_bet,
            "lottery_id": data.lottery_id,
            "draw_name": data.draw_name
        },
        entity_type="number_limit",
        entity_id=data.number,
        severity="INFO",
        company_id=current_user.get("company_id")
    )
    
    return {
        "message": f"Limite pour le numéro {data.number} mise à jour: {data.max_bet} HTG",
        "number": data.number,
        "max_bet": data.max_bet
    }


@limits_router.delete("/config/number/{number}")
async def remove_number_limit(
    number: str,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Remove specific limit for a number (revert to default)"""
    now = get_current_timestamp()
    key = f"number_specific_limits.{number}"
    
    await db.limit_config.update_one(
        {"config_id": "global_limits"},
        {
            "$unset": {key: ""},
            "$set": {"updated_at": now}
        }
    )
    
    return {"message": f"Limite spécifique pour {number} supprimée (défaut appliqué)"}


# ============================================================================
# 2. BET TRACKING AND CHECKING
# ============================================================================

async def get_current_bets_for_number(lottery_id: str, draw_name: str, draw_date: str, number: str) -> float:
    """Get total bets placed on a specific number for current draw"""
    pipeline = [
        {
            "$match": {
                "lottery_id": lottery_id,
                "draw_name": draw_name,
                "draw_date": draw_date,
                "status": {"$in": ["VALIDATED", "PENDING", "WINNER"]}
            }
        },
        {"$unwind": "$plays"},
        {
            "$match": {
                "plays.numbers": {"$regex": f"(^|-)({number})($|-)"}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_bets": {"$sum": "$plays.amount"}
            }
        }
    ]
    
    result = await db.lottery_transactions.aggregate(pipeline).to_list(1)
    return result[0]["total_bets"] if result else 0.0


async def get_limit_for_number(number: str, lottery_id: str = None) -> float:
    """Get the applicable limit for a number"""
    config = await db.limit_config.find_one({"config_id": "global_limits"})
    
    if not config:
        return DEFAULT_LIMIT_CONFIG["default_max_bet_per_number"]
    
    # Check number-specific limit first
    number_limits = config.get("number_specific_limits", {})
    if number in number_limits:
        return number_limits[number]
    
    # Check lottery-specific limit
    if lottery_id:
        lottery_limits = config.get("lottery_specific_limits", {})
        if lottery_id in lottery_limits:
            return lottery_limits[lottery_id].get("max_per_number", config.get("default_max_bet_per_number", 5000))
    
    return config.get("default_max_bet_per_number", 5000)


@limits_router.post("/check")
async def check_bet_allowed(
    data: BetCheckRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Check if a bet is allowed based on current limits.
    Returns detailed status for each number in the plays.
    """
    config = await db.limit_config.find_one({"config_id": "global_limits"})
    if not config:
        config = DEFAULT_LIMIT_CONFIG
    
    results = []
    all_allowed = True
    
    for play in data.plays:
        numbers_str = play.get("numbers", "")
        amount = play.get("amount", 0)
        bet_type = play.get("bet_type", "BORLETTE")
        
        # Extract individual numbers from the play
        numbers = numbers_str.split("-") if "-" in numbers_str else [numbers_str]
        
        for number in numbers:
            number = number.strip()
            if not number:
                continue
            
            # Get current bets for this number
            current_bets = await get_current_bets_for_number(
                data.lottery_id, data.draw_name, data.draw_date, number
            )
            
            # Get limit for this number
            max_bet = await get_limit_for_number(number, data.lottery_id)
            
            # Check if blocked
            blocked = await db.blocked_numbers.find_one({
                "number": number,
                "lottery_id": data.lottery_id,
                "draw_name": data.draw_name,
                "draw_date": data.draw_date,
                "active": True
            })
            
            new_total = current_bets + amount
            remaining = max_bet - current_bets
            percentage_used = (current_bets / max_bet * 100) if max_bet > 0 else 0
            
            is_allowed = True
            reason = None
            
            if blocked:
                is_allowed = False
                reason = f"Numéro {number} bloqué jusqu'au prochain tirage"
                all_allowed = False
            elif new_total > max_bet:
                is_allowed = False
                reason = f"Limite dépassée pour {number}: {current_bets:.0f}/{max_bet:.0f} HTG (+{amount:.0f})"
                all_allowed = False
            
            # Check alert threshold
            alert_threshold = config.get("alert_threshold_percentage", 80)
            needs_alert = percentage_used >= alert_threshold and is_allowed
            
            results.append({
                "number": number,
                "bet_type": bet_type,
                "amount": amount,
                "current_total": current_bets,
                "max_limit": max_bet,
                "new_total": new_total,
                "remaining": max(0, remaining),
                "percentage_used": round(percentage_used, 1),
                "is_allowed": is_allowed,
                "is_blocked": blocked is not None,
                "reason": reason,
                "needs_alert": needs_alert
            })
    
    return {
        "all_allowed": all_allowed,
        "lottery_id": data.lottery_id,
        "draw_name": data.draw_name,
        "draw_date": data.draw_date,
        "checks": results
    }


@limits_router.get("/numbers/status")
async def get_numbers_status(
    lottery_id: str,
    draw_name: str,
    draw_date: str,
    current_user: dict = Depends(require_admin)
):
    """Get status of all numbers with bet totals for a specific draw"""
    config = await db.limit_config.find_one({"config_id": "global_limits"})
    default_limit = config.get("default_max_bet_per_number", 5000) if config else 5000
    alert_threshold = config.get("alert_threshold_percentage", 80) if config else 80
    
    # Aggregate bets by number
    pipeline = [
        {
            "$match": {
                "lottery_id": lottery_id,
                "draw_name": draw_name,
                "draw_date": draw_date,
                "status": {"$in": ["VALIDATED", "PENDING", "WINNER"]}
            }
        },
        {"$unwind": "$plays"},
        {
            "$group": {
                "_id": "$plays.numbers",
                "total_bets": {"$sum": "$plays.amount"},
                "ticket_count": {"$sum": 1}
            }
        },
        {"$sort": {"total_bets": -1}}
    ]
    
    aggregated = await db.lottery_transactions.aggregate(pipeline).to_list(200)
    
    # Get blocked numbers
    blocked = await db.blocked_numbers.find({
        "lottery_id": lottery_id,
        "draw_name": draw_name,
        "draw_date": draw_date,
        "active": True
    }, {"_id": 0, "number": 1}).to_list(100)
    blocked_numbers = {b["number"] for b in blocked}
    
    # Get number-specific limits
    number_limits = config.get("number_specific_limits", {}) if config else {}
    
    results = []
    for item in aggregated:
        number = item["_id"]
        total = item["total_bets"]
        limit = number_limits.get(number, default_limit)
        percentage = (total / limit * 100) if limit > 0 else 0
        
        status = "OK"
        if number in blocked_numbers:
            status = "BLOCKED"
        elif percentage >= 100:
            status = "LIMIT_REACHED"
        elif percentage >= alert_threshold:
            status = "WARNING"
        
        results.append({
            "number": number,
            "total_bets": total,
            "ticket_count": item["ticket_count"],
            "limit": limit,
            "percentage": round(percentage, 1),
            "remaining": max(0, limit - total),
            "status": status,
            "is_blocked": number in blocked_numbers
        })
    
    return {
        "lottery_id": lottery_id,
        "draw_name": draw_name,
        "draw_date": draw_date,
        "default_limit": default_limit,
        "alert_threshold": alert_threshold,
        "numbers": results,
        "total_count": len(results),
        "blocked_count": len(blocked_numbers),
        "warning_count": len([r for r in results if r["status"] == "WARNING"]),
        "limit_reached_count": len([r for r in results if r["status"] == "LIMIT_REACHED"])
    }


# ============================================================================
# 3. AUTOMATIC BLOCKING
# ============================================================================

@limits_router.post("/numbers/block")
async def block_number(
    request: Request,
    number: str,
    lottery_id: str,
    draw_name: str,
    draw_date: str,
    reason: Optional[str] = None,
    current_user: dict = Depends(require_super_admin)
):
    """Manually block a number for a specific draw"""
    now = get_current_timestamp()
    
    # Check if already blocked
    existing = await db.blocked_numbers.find_one({
        "number": number,
        "lottery_id": lottery_id,
        "draw_name": draw_name,
        "draw_date": draw_date,
        "active": True
    })
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Numéro {number} déjà bloqué")
    
    block_id = generate_id("block_")
    block_doc = {
        "block_id": block_id,
        "number": number,
        "lottery_id": lottery_id,
        "draw_name": draw_name,
        "draw_date": draw_date,
        "reason": reason or "Blocage manuel par Super Admin",
        "blocked_by": current_user.get("user_id"),
        "blocked_by_name": current_user.get("name"),
        "block_type": "MANUAL",
        "active": True,
        "created_at": now
    }
    
    await db.blocked_numbers.insert_one(block_doc)
    
    # Create alert
    alert_id = generate_id("alert_")
    await db.limit_alerts.insert_one({
        "alert_id": alert_id,
        "alert_type": "NUMBER_BLOCKED",
        "number": number,
        "lottery_id": lottery_id,
        "draw_name": draw_name,
        "draw_date": draw_date,
        "message": f"Numéro {number} bloqué manuellement par {current_user.get('name')}",
        "severity": "HIGH",
        "acknowledged": False,
        "created_at": now
    })
    
    # Audit log
    await create_audit_log(
        db=db,
        action="NUMBER_BLOCKED",
        user_id=current_user.get("user_id"),
        request=request,
        details={
            "number": number,
            "lottery_id": lottery_id,
            "draw_name": draw_name,
            "reason": reason
        },
        entity_type="blocked_number",
        entity_id=block_id,
        severity="WARNING",
        company_id=current_user.get("company_id")
    )
    
    return {
        "message": f"Numéro {number} bloqué avec succès",
        "block_id": block_id,
        "alert_id": alert_id
    }


@limits_router.delete("/numbers/block/{block_id}")
async def unblock_number(
    block_id: str,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Unblock a number"""
    now = get_current_timestamp()
    
    block = await db.blocked_numbers.find_one({"block_id": block_id, "active": True})
    if not block:
        raise HTTPException(status_code=404, detail="Blocage non trouvé")
    
    await db.blocked_numbers.update_one(
        {"block_id": block_id},
        {
            "$set": {
                "active": False,
                "unblocked_by": current_user.get("user_id"),
                "unblocked_at": now
            }
        }
    )
    
    # Audit log
    await create_audit_log(
        db=db,
        action="NUMBER_UNBLOCKED",
        user_id=current_user.get("user_id"),
        request=request,
        details={
            "number": block.get("number"),
            "block_id": block_id
        },
        entity_type="blocked_number",
        entity_id=block_id,
        severity="INFO",
        company_id=current_user.get("company_id")
    )
    
    return {"message": f"Numéro {block.get('number')} débloqué"}


@limits_router.get("/numbers/blocked")
async def get_blocked_numbers(
    lottery_id: Optional[str] = None,
    draw_name: Optional[str] = None,
    draw_date: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Get list of currently blocked numbers"""
    query = {"active": True}
    
    if lottery_id:
        query["lottery_id"] = lottery_id
    if draw_name:
        query["draw_name"] = draw_name
    if draw_date:
        query["draw_date"] = draw_date
    
    blocked = await db.blocked_numbers.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    return {
        "blocked_numbers": blocked,
        "count": len(blocked)
    }


async def auto_block_number_if_needed(
    lottery_id: str,
    draw_name: str,
    draw_date: str,
    number: str,
    current_total: float,
    max_limit: float
):
    """Automatically block a number if it exceeds its limit"""
    config = await db.limit_config.find_one({"config_id": "global_limits"})
    
    if not config or not config.get("auto_block_enabled", True):
        return None
    
    if current_total < max_limit:
        return None
    
    # Check if already blocked
    existing = await db.blocked_numbers.find_one({
        "number": number,
        "lottery_id": lottery_id,
        "draw_name": draw_name,
        "draw_date": draw_date,
        "active": True
    })
    
    if existing:
        return existing.get("block_id")
    
    now = get_current_timestamp()
    block_id = generate_id("block_")
    
    await db.blocked_numbers.insert_one({
        "block_id": block_id,
        "number": number,
        "lottery_id": lottery_id,
        "draw_name": draw_name,
        "draw_date": draw_date,
        "reason": f"Limite automatique atteinte: {current_total:.0f}/{max_limit:.0f} HTG",
        "block_type": "AUTOMATIC",
        "active": True,
        "created_at": now
    })
    
    # Create high priority alert
    alert_id = generate_id("alert_")
    await db.limit_alerts.insert_one({
        "alert_id": alert_id,
        "alert_type": "LIMIT_EXCEEDED_AUTO_BLOCK",
        "number": number,
        "lottery_id": lottery_id,
        "draw_name": draw_name,
        "draw_date": draw_date,
        "current_total": current_total,
        "limit": max_limit,
        "message": f"BLOCAGE AUTO: {number} a atteint {current_total:.0f}/{max_limit:.0f} HTG",
        "severity": "CRITICAL",
        "acknowledged": False,
        "created_at": now
    })
    
    logger.warning(f"Auto-blocked number {number}: {current_total}/{max_limit} HTG")
    
    return block_id


# ============================================================================
# 4. ALERTS MANAGEMENT
# ============================================================================

@limits_router.get("/alerts")
async def get_limit_alerts(
    acknowledged: Optional[bool] = None,
    severity: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    current_user: dict = Depends(require_admin)
):
    """Get limit alerts"""
    query = {}
    
    if acknowledged is not None:
        query["acknowledged"] = acknowledged
    if severity:
        query["severity"] = severity
    
    alerts = await db.limit_alerts.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Count unacknowledged
    unack_count = await db.limit_alerts.count_documents({"acknowledged": False})
    
    return {
        "alerts": alerts,
        "total": len(alerts),
        "unacknowledged_count": unack_count
    }


@limits_router.post("/alerts/acknowledge")
async def acknowledge_alert(
    data: AlertAcknowledge,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Acknowledge a limit alert"""
    now = get_current_timestamp()
    
    result = await db.limit_alerts.update_one(
        {"alert_id": data.alert_id},
        {
            "$set": {
                "acknowledged": True,
                "acknowledged_by": current_user.get("user_id"),
                "acknowledged_by_name": current_user.get("name"),
                "acknowledged_at": now,
                "acknowledgement_notes": data.notes
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alerte non trouvée")
    
    return {"message": "Alerte acquittée", "alert_id": data.alert_id}


@limits_router.post("/alerts/acknowledge-all")
async def acknowledge_all_alerts(
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Acknowledge all unacknowledged alerts"""
    now = get_current_timestamp()
    
    result = await db.limit_alerts.update_many(
        {"acknowledged": False},
        {
            "$set": {
                "acknowledged": True,
                "acknowledged_by": current_user.get("user_id"),
                "acknowledged_by_name": current_user.get("name"),
                "acknowledged_at": now
            }
        }
    )
    
    return {"message": f"{result.modified_count} alertes acquittées"}


async def create_threshold_alert(
    number: str,
    lottery_id: str,
    draw_name: str,
    draw_date: str,
    current_total: float,
    max_limit: float,
    percentage: float
):
    """Create an alert when threshold is reached"""
    now = get_current_timestamp()
    
    # Check if alert already exists for this number/draw
    existing = await db.limit_alerts.find_one({
        "number": number,
        "lottery_id": lottery_id,
        "draw_name": draw_name,
        "draw_date": draw_date,
        "alert_type": "THRESHOLD_WARNING"
    })
    
    if existing:
        return None
    
    alert_id = generate_id("alert_")
    await db.limit_alerts.insert_one({
        "alert_id": alert_id,
        "alert_type": "THRESHOLD_WARNING",
        "number": number,
        "lottery_id": lottery_id,
        "draw_name": draw_name,
        "draw_date": draw_date,
        "current_total": current_total,
        "limit": max_limit,
        "percentage": percentage,
        "message": f"ATTENTION: {number} à {percentage:.0f}% ({current_total:.0f}/{max_limit:.0f} HTG)",
        "severity": "MEDIUM",
        "acknowledged": False,
        "created_at": now
    })
    
    return alert_id


# ============================================================================
# 5. DASHBOARD STATISTICS
# ============================================================================

@limits_router.get("/dashboard/stats")
async def get_limits_dashboard_stats(
    current_user: dict = Depends(require_admin)
):
    """Get real-time limits dashboard statistics"""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Get config
    config = await db.limit_config.find_one({"config_id": "global_limits"}, {"_id": 0})
    if not config:
        config = DEFAULT_LIMIT_CONFIG
    
    # Count active blocks
    active_blocks = await db.blocked_numbers.count_documents({"active": True})
    today_blocks = await db.blocked_numbers.count_documents({
        "active": True,
        "created_at": {"$regex": f"^{today}"}
    })
    
    # Count alerts
    unack_alerts = await db.limit_alerts.count_documents({"acknowledged": False})
    critical_alerts = await db.limit_alerts.count_documents({
        "acknowledged": False,
        "severity": "CRITICAL"
    })
    today_alerts = await db.limit_alerts.count_documents({
        "created_at": {"$regex": f"^{today}"}
    })
    
    # Get top numbers approaching limit (for today)
    # This is a simplified query - would need draw-specific logic in production
    
    return {
        "config": {
            "default_max_bet": config.get("default_max_bet_per_number", 5000),
            "alert_threshold": config.get("alert_threshold_percentage", 80),
            "auto_block_enabled": config.get("auto_block_enabled", True)
        },
        "blocks": {
            "active_total": active_blocks,
            "created_today": today_blocks
        },
        "alerts": {
            "unacknowledged": unack_alerts,
            "critical": critical_alerts,
            "created_today": today_alerts
        },
        "generated_at": now.isoformat()
    }


# ============================================================================
# 6. INTEGRATION HELPER - Called by ticket creation
# ============================================================================

async def validate_bet_limits(
    lottery_id: str,
    draw_name: str,
    draw_date: str,
    plays: List[Dict]
) -> Dict:
    """
    Validate all plays against limits.
    Returns: {allowed: bool, blocked_plays: [], exceeded_plays: [], alerts_created: []}
    This function is called by the ticket creation endpoint.
    """
    config = await db.limit_config.find_one({"config_id": "global_limits"})
    if not config:
        config = DEFAULT_LIMIT_CONFIG
    
    alert_threshold = config.get("alert_threshold_percentage", 80)
    auto_block = config.get("auto_block_enabled", True)
    
    blocked_plays = []
    exceeded_plays = []
    alerts_created = []
    all_allowed = True
    
    for play in plays:
        numbers_str = play.get("numbers", "")
        amount = play.get("amount", 0)
        
        # Handle both single numbers and combinations (like "12-45")
        numbers = numbers_str.split("-") if "-" in numbers_str else [numbers_str]
        
        for number in numbers:
            number = number.strip()
            if not number:
                continue
            
            # Check if blocked
            blocked = await db.blocked_numbers.find_one({
                "number": number,
                "lottery_id": lottery_id,
                "draw_name": draw_name,
                "draw_date": draw_date,
                "active": True
            })
            
            if blocked:
                blocked_plays.append({
                    "number": number,
                    "reason": f"Numéro {number} bloqué: {blocked.get('reason', 'Limite atteinte')}"
                })
                all_allowed = False
                continue
            
            # Get current bets and limit
            current_bets = await get_current_bets_for_number(
                lottery_id, draw_name, draw_date, number
            )
            max_limit = await get_limit_for_number(number, lottery_id)
            
            new_total = current_bets + amount
            percentage = (new_total / max_limit * 100) if max_limit > 0 else 0
            
            # Check if would exceed
            if new_total > max_limit:
                exceeded_plays.append({
                    "number": number,
                    "current": current_bets,
                    "requested": amount,
                    "limit": max_limit,
                    "reason": f"Limite dépassée: {current_bets:.0f}+{amount:.0f} > {max_limit:.0f} HTG"
                })
                all_allowed = False
                
                # Auto-block if enabled
                if auto_block:
                    block_id = await auto_block_number_if_needed(
                        lottery_id, draw_name, draw_date, number, current_bets, max_limit
                    )
                    if block_id:
                        alerts_created.append(block_id)
            
            # Check threshold for warning
            elif percentage >= alert_threshold:
                alert_id = await create_threshold_alert(
                    number, lottery_id, draw_name, draw_date,
                    new_total, max_limit, percentage
                )
                if alert_id:
                    alerts_created.append(alert_id)
    
    return {
        "allowed": all_allowed,
        "blocked_plays": blocked_plays,
        "exceeded_plays": exceeded_plays,
        "alerts_created": alerts_created
    }


# ============================================================================
# 7. CLEANUP - Reset blocks after draw
# ============================================================================

@limits_router.post("/cleanup/draw")
async def cleanup_after_draw(
    lottery_id: str,
    draw_name: str,
    draw_date: str,
    current_user: dict = Depends(require_super_admin)
):
    """Clean up blocks and alerts after a draw is complete"""
    now = get_current_timestamp()
    
    # Deactivate all blocks for this draw
    blocks_result = await db.blocked_numbers.update_many(
        {
            "lottery_id": lottery_id,
            "draw_name": draw_name,
            "draw_date": draw_date,
            "active": True
        },
        {
            "$set": {
                "active": False,
                "deactivated_at": now,
                "deactivation_reason": "Draw completed"
            }
        }
    )
    
    return {
        "message": "Nettoyage effectué",
        "blocks_deactivated": blocks_result.modified_count
    }
