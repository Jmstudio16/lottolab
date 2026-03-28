"""
LOTTOLAB - Draw Times Management
Super Admin exclusive CRUD for managing lottery draw times.
No auto-generation - all draw times must be manually created.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel

from models import UserRole
from auth import decode_token
from utils import generate_id, get_current_timestamp

draw_times_router = APIRouter(prefix="/api", tags=["Draw Times Management"])
security = HTTPBearer()

db = None

def set_draw_times_db(database):
    global db
    db = database


async def require_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require SUPER_ADMIN role"""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    if user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès Super Admin requis")
    
    return user


# ============================================================================
# MODELS
# ============================================================================

class DrawTimeCreate(BaseModel):
    lottery_id: str
    draw_name: str  # "Matin", "Midi", "Soir", "Nuit"
    open_time: str  # "06:00"
    close_time: str  # "12:15"
    draw_time: str  # "12:30"
    days_of_week: List[int] = [0, 1, 2, 3, 4, 5, 6]  # 0=Monday, 6=Sunday
    is_active: bool = True


class DrawTimeUpdate(BaseModel):
    draw_name: Optional[str] = None
    open_time: Optional[str] = None
    close_time: Optional[str] = None
    draw_time: Optional[str] = None
    days_of_week: Optional[List[int]] = None
    is_active: Optional[bool] = None


# ============================================================================
# GET ALL DRAW TIMES
# ============================================================================

@draw_times_router.get("/super/draw-times")
async def get_all_draw_times(
    lottery_id: Optional[str] = None,
    current_user: dict = Depends(require_super_admin)
):
    """
    Get all draw times. Optionally filter by lottery_id.
    """
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    draw_times = await db.global_schedules.find(query, {"_id": 0}).to_list(500)
    
    # Enrich with lottery names
    lottery_ids = list(set(dt.get("lottery_id") for dt in draw_times if dt.get("lottery_id")))
    lotteries = await db.master_lotteries.find(
        {"lottery_id": {"$in": lottery_ids}},
        {"_id": 0, "lottery_id": 1, "lottery_name": 1, "state_code": 1}
    ).to_list(500)
    lottery_map = {l["lottery_id"]: l for l in lotteries}
    
    for dt in draw_times:
        lottery = lottery_map.get(dt.get("lottery_id"), {})
        dt["lottery_name"] = lottery.get("lottery_name", "Inconnu")
        dt["state_code"] = lottery.get("state_code", "")
    
    return draw_times


# ============================================================================
# GET DRAW TIMES FOR A SPECIFIC LOTTERY
# ============================================================================

@draw_times_router.get("/super/draw-times/lottery/{lottery_id}")
async def get_lottery_draw_times(
    lottery_id: str,
    current_user: dict = Depends(require_super_admin)
):
    """Get all draw times for a specific lottery"""
    draw_times = await db.global_schedules.find(
        {"lottery_id": lottery_id},
        {"_id": 0}
    ).to_list(50)
    
    return draw_times


# ============================================================================
# CREATE DRAW TIME
# ============================================================================

@draw_times_router.post("/super/draw-times")
async def create_draw_time(
    data: DrawTimeCreate,
    current_user: dict = Depends(require_super_admin)
):
    """
    Create a new draw time (Super Admin only).
    This is the ONLY way to add draw times - no auto-generation.
    """
    # Verify lottery exists
    lottery = await db.master_lotteries.find_one(
        {"lottery_id": data.lottery_id},
        {"_id": 0, "lottery_name": 1}
    )
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    # Check for duplicate (same lottery + same draw_name)
    existing = await db.global_schedules.find_one({
        "lottery_id": data.lottery_id,
        "draw_name": data.draw_name
    })
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Un tirage '{data.draw_name}' existe déjà pour cette loterie"
        )
    
    now = get_current_timestamp()
    schedule_id = generate_id("sched_")
    
    schedule = {
        "schedule_id": schedule_id,
        "lottery_id": data.lottery_id,
        "draw_name": data.draw_name,
        "open_time": data.open_time,
        "close_time": data.close_time,
        "draw_time": data.draw_time,
        "days_of_week": data.days_of_week,
        "is_active": data.is_active,
        "created_by": current_user.get("user_id"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.global_schedules.insert_one(schedule)
    
    return {
        "message": f"Tirage '{data.draw_name}' créé pour {lottery.get('lottery_name')}",
        "schedule_id": schedule_id
    }


# ============================================================================
# UPDATE DRAW TIME
# ============================================================================

@draw_times_router.put("/super/draw-times/{schedule_id}")
async def update_draw_time(
    schedule_id: str,
    data: DrawTimeUpdate,
    current_user: dict = Depends(require_super_admin)
):
    """Update an existing draw time (Super Admin only)"""
    # Get existing schedule
    existing = await db.global_schedules.find_one({"schedule_id": schedule_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Tirage non trouvé")
    
    # Build update dict
    updates = {"updated_at": get_current_timestamp()}
    
    if data.draw_name is not None:
        updates["draw_name"] = data.draw_name
    if data.open_time is not None:
        updates["open_time"] = data.open_time
    if data.close_time is not None:
        updates["close_time"] = data.close_time
    if data.draw_time is not None:
        updates["draw_time"] = data.draw_time
    if data.days_of_week is not None:
        updates["days_of_week"] = data.days_of_week
    if data.is_active is not None:
        updates["is_active"] = data.is_active
    
    await db.global_schedules.update_one(
        {"schedule_id": schedule_id},
        {"$set": updates}
    )
    
    return {"message": "Tirage mis à jour", "schedule_id": schedule_id}


# ============================================================================
# DELETE DRAW TIME
# ============================================================================

@draw_times_router.delete("/super/draw-times/{schedule_id}")
async def delete_draw_time(
    schedule_id: str,
    current_user: dict = Depends(require_super_admin)
):
    """Delete a draw time (Super Admin only)"""
    result = await db.global_schedules.delete_one({"schedule_id": schedule_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tirage non trouvé")
    
    return {"message": "Tirage supprimé", "schedule_id": schedule_id}


# ============================================================================
# TOGGLE DRAW TIME ACTIVE STATUS
# ============================================================================

@draw_times_router.put("/super/draw-times/{schedule_id}/toggle")
async def toggle_draw_time(
    schedule_id: str,
    current_user: dict = Depends(require_super_admin)
):
    """Toggle active status of a draw time"""
    existing = await db.global_schedules.find_one({"schedule_id": schedule_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Tirage non trouvé")
    
    new_status = not existing.get("is_active", True)
    
    await db.global_schedules.update_one(
        {"schedule_id": schedule_id},
        {"$set": {
            "is_active": new_status,
            "updated_at": get_current_timestamp()
        }}
    )
    
    status_text = "activé" if new_status else "désactivé"
    return {"message": f"Tirage {status_text}", "is_active": new_status}


# ============================================================================
# BULK OPERATIONS
# ============================================================================

@draw_times_router.post("/super/draw-times/bulk-create")
async def bulk_create_draw_times(
    lottery_id: str,
    current_user: dict = Depends(require_super_admin)
):
    """
    Create standard draw times (Matin, Midi, Soir) for a lottery.
    Only creates if they don't already exist.
    """
    # Verify lottery exists
    lottery = await db.master_lotteries.find_one(
        {"lottery_id": lottery_id},
        {"_id": 0, "lottery_name": 1}
    )
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    # Check existing schedules
    existing = await db.global_schedules.find(
        {"lottery_id": lottery_id},
        {"draw_name": 1}
    ).to_list(10)
    existing_names = {e["draw_name"] for e in existing}
    
    # Standard draw times for Haiti lotteries
    standard_draws = [
        {
            "draw_name": "Matin",
            "open_time": "06:00",
            "close_time": "10:15",
            "draw_time": "10:30"
        },
        {
            "draw_name": "Midi",
            "open_time": "06:00",
            "close_time": "13:15",
            "draw_time": "13:30"
        },
        {
            "draw_name": "Soir",
            "open_time": "12:00",
            "close_time": "21:15",
            "draw_time": "21:30"
        }
    ]
    
    now = get_current_timestamp()
    created_count = 0
    
    for draw in standard_draws:
        if draw["draw_name"] not in existing_names:
            schedule_id = generate_id("sched_")
            await db.global_schedules.insert_one({
                "schedule_id": schedule_id,
                "lottery_id": lottery_id,
                "draw_name": draw["draw_name"],
                "open_time": draw["open_time"],
                "close_time": draw["close_time"],
                "draw_time": draw["draw_time"],
                "days_of_week": [0, 1, 2, 3, 4, 5, 6],
                "is_active": True,
                "created_by": current_user.get("user_id"),
                "created_at": now,
                "updated_at": now
            })
            created_count += 1
    
    return {
        "message": f"{created_count} tirages créés pour {lottery.get('lottery_name')}",
        "created": created_count
    }
