"""
LOTTOLAB - Scheduled Results System
Handles automated results for Plop Plop (hourly) and Loto Rapid (every 2 hours)
Super Admin can program results in advance
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import random
import asyncio

from models import UserRole
from utils import generate_id, get_current_timestamp

scheduled_results_router = APIRouter(prefix="/api/scheduled-results", tags=["Scheduled Results"])

db = None

def set_scheduled_results_db(database):
    global db
    db = database


# ============================================================================
# MODELS
# ============================================================================

class ScheduledResultCreate(BaseModel):
    lottery_id: str
    lottery_name: Optional[str] = None
    draw_name: str
    draw_date: str  # YYYY-MM-DD
    draw_time: str  # HH:MM
    winning_numbers: str  # Format: "12-45-78" (first-second-third)
    is_auto_generated: bool = False


class ScheduledResultUpdate(BaseModel):
    winning_numbers: Optional[str] = None
    draw_time: Optional[str] = None
    is_active: Optional[bool] = None


# ============================================================================
# SUPER ADMIN - PROGRAM RESULTS
# ============================================================================

async def get_super_admin(request):
    """Verify super admin access"""
    from auth import decode_token
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non autorisé")
    token = auth_header.split(" ")[1]
    payload = decode_token(token)
    if not payload or payload.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super Admin requis")
    return payload


@scheduled_results_router.post("/program")
async def program_result(data: ScheduledResultCreate, request: Request):
    """
    Super Admin programs a result for a specific lottery draw.
    The system will automatically release this result at the scheduled time.
    """
    await get_super_admin(request)
    
    now = get_current_timestamp()
    result_id = generate_id("schres_")
    
    # Get lottery name if not provided
    lottery_name = data.lottery_name
    if not lottery_name:
        lottery = await db.master_lotteries.find_one(
            {"lottery_id": data.lottery_id},
            {"_id": 0, "lottery_name": 1}
        )
        lottery_name = lottery.get("lottery_name") if lottery else data.lottery_id
    
    scheduled_result = {
        "scheduled_result_id": result_id,
        "lottery_id": data.lottery_id,
        "lottery_name": lottery_name,
        "draw_name": data.draw_name,
        "draw_date": data.draw_date,
        "draw_time": data.draw_time,
        "winning_numbers": data.winning_numbers,
        "is_auto_generated": data.is_auto_generated,
        "status": "SCHEDULED",  # SCHEDULED, RELEASED, CANCELLED
        "scheduled_release_at": f"{data.draw_date}T{data.draw_time}:00+00:00",
        "created_at": now,
        "created_by": "SUPER_ADMIN"
    }
    
    await db.scheduled_results.insert_one(scheduled_result)
    
    return {
        "message": "Résultat programmé avec succès",
        "scheduled_result_id": result_id,
        "release_at": f"{data.draw_date} {data.draw_time}"
    }


@scheduled_results_router.get("/list")
async def list_scheduled_results(
    request: Request,
    lottery_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """Get all scheduled results"""
    await get_super_admin(request)
    
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    if status:
        query["status"] = status
    
    results = await db.scheduled_results.find(
        query,
        {"_id": 0}
    ).sort("scheduled_release_at", -1).limit(limit).to_list(limit)
    
    return {"scheduled_results": results, "count": len(results)}


@scheduled_results_router.put("/{result_id}")
async def update_scheduled_result(result_id: str, data: ScheduledResultUpdate, request: Request):
    """Update a scheduled result"""
    await get_super_admin(request)
    
    result = await db.scheduled_results.find_one({"scheduled_result_id": result_id})
    if not result:
        raise HTTPException(status_code=404, detail="Résultat programmé non trouvé")
    
    if result.get("status") == "RELEASED":
        raise HTTPException(status_code=400, detail="Impossible de modifier un résultat déjà publié")
    
    update_data = {"updated_at": get_current_timestamp()}
    if data.winning_numbers:
        update_data["winning_numbers"] = data.winning_numbers
    if data.draw_time:
        update_data["draw_time"] = data.draw_time
        update_data["scheduled_release_at"] = f"{result.get('draw_date')}T{data.draw_time}:00+00:00"
    if data.is_active is not None:
        update_data["status"] = "SCHEDULED" if data.is_active else "CANCELLED"
    
    await db.scheduled_results.update_one(
        {"scheduled_result_id": result_id},
        {"$set": update_data}
    )
    
    return {"message": "Résultat mis à jour", "scheduled_result_id": result_id}


@scheduled_results_router.delete("/{result_id}")
async def delete_scheduled_result(result_id: str, request: Request):
    """Cancel/delete a scheduled result"""
    await get_super_admin(request)
    
    result = await db.scheduled_results.find_one({"scheduled_result_id": result_id})
    if not result:
        raise HTTPException(status_code=404, detail="Résultat programmé non trouvé")
    
    if result.get("status") == "RELEASED":
        raise HTTPException(status_code=400, detail="Impossible de supprimer un résultat déjà publié")
    
    await db.scheduled_results.update_one(
        {"scheduled_result_id": result_id},
        {"$set": {"status": "CANCELLED", "cancelled_at": get_current_timestamp()}}
    )
    
    return {"message": "Résultat annulé", "scheduled_result_id": result_id}


# ============================================================================
# AUTO-GENERATE RESULTS FOR PLOP PLOP AND LOTO RAPID
# ============================================================================

def generate_random_winning_numbers():
    """Generate random 2-digit winning numbers for lottery"""
    first = str(random.randint(0, 99)).zfill(2)
    second = str(random.randint(0, 99)).zfill(2)
    third = str(random.randint(0, 99)).zfill(2)
    return f"{first}-{second}-{third}"


async def release_scheduled_result(scheduled_result):
    """Release a scheduled result to the actual results collection"""
    now = get_current_timestamp()
    
    # Create the result entry
    result_id = generate_id("res_")
    
    result = {
        "result_id": result_id,
        "lottery_id": scheduled_result["lottery_id"],
        "lottery_name": scheduled_result["lottery_name"],
        "draw_name": scheduled_result["draw_name"],
        "draw_date": scheduled_result["draw_date"],
        "draw_time": scheduled_result["draw_time"],
        "winning_numbers": scheduled_result["winning_numbers"],
        "source": "AUTO_SCHEDULED" if scheduled_result.get("is_auto_generated") else "SUPER_ADMIN_SCHEDULED",
        "status": "PUBLISHED",
        "created_at": now,
        "published_at": now
    }
    
    await db.lottery_results.insert_one(result)
    
    # Mark scheduled result as released
    await db.scheduled_results.update_one(
        {"scheduled_result_id": scheduled_result["scheduled_result_id"]},
        {"$set": {"status": "RELEASED", "released_at": now}}
    )
    
    return result


async def check_and_release_scheduled_results():
    """
    Background task to check for scheduled results that need to be released.
    Called every minute by the scheduler.
    """
    if db is None:
        return
    
    now = datetime.now(timezone.utc)
    now_str = now.isoformat()
    
    # Find scheduled results ready to be released
    scheduled = await db.scheduled_results.find({
        "status": "SCHEDULED",
        "scheduled_release_at": {"$lte": now_str}
    }).to_list(100)
    
    for result in scheduled:
        try:
            await release_scheduled_result(result)
            print(f"[SCHEDULER] Released result for {result.get('lottery_name')} - {result.get('draw_name')}")
        except Exception as e:
            print(f"[SCHEDULER] Error releasing result: {e}")


async def generate_plop_plop_schedules():
    """
    Generate hourly schedules for Plop Plop lottery.
    Results every hour from 8:00 to 21:00.
    Sales close 55 minutes before each draw (at XX:05).
    
    IMPORTANT: Only creates NEW schedules, NEVER modifies existing ones.
    This respects Super Admin configurations.
    """
    if db is None:
        return
    
    lottery = await db.master_lotteries.find_one(
        {"lottery_name": {"$regex": "Plop Plop", "$options": "i"}},
        {"_id": 0, "lottery_id": 1, "lottery_name": 1}
    )
    if not lottery:
        return
    
    lottery_id = lottery["lottery_id"]
    lottery_name = lottery["lottery_name"]
    created_count = 0
    
    # Generate schedules for each hour 8:00 to 21:00
    for hour in range(8, 22):  # 8:00 to 21:00
        draw_name = f"Tirage {hour:02d}h00"
        
        # Check if schedule already exists
        existing = await db.global_schedules.find_one({
            "lottery_id": lottery_id,
            "draw_name": draw_name
        })
        
        if existing:
            # NEVER modify existing schedules - respect Super Admin config
            continue
        
        # Create new schedule only
        close_time = f"{hour-1:02d}:05" if hour > 0 else "23:05"
        open_time = f"{(hour-1):02d}:00" if hour > 8 else "07:00"
        
        await db.global_schedules.insert_one({
            "schedule_id": generate_id("sch_"),
            "lottery_id": lottery_id,
            "lottery_name": lottery_name,
            "draw_name": draw_name,
            "draw_time": f"{hour:02d}:00",
            "open_time": open_time,
            "close_time": close_time,
            "is_active": True,
            "interval_type": "HOURLY",
            "created_at": get_current_timestamp()
        })
        created_count += 1
    
    if created_count > 0:
        print(f"[SCHEDULER] Created {created_count} NEW schedules for Plop Plop")


async def generate_loto_rapid_schedules():
    """
    Generate 2-hour interval schedules for Loto Rapid.
    Results every 2 hours: 8:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00.
    Sales close 5 minutes before each draw.
    
    IMPORTANT: Only creates NEW schedules, NEVER modifies existing ones.
    This respects Super Admin configurations.
    """
    if db is None:
        return
    
    lottery = await db.master_lotteries.find_one(
        {"lottery_name": {"$regex": "Loto Rapid", "$options": "i"}},
        {"_id": 0, "lottery_id": 1, "lottery_name": 1}
    )
    if not lottery:
        return
    
    lottery_id = lottery["lottery_id"]
    lottery_name = lottery["lottery_name"]
    created_count = 0
    
    # Generate schedules every 2 hours from 8:00 to 20:00
    for hour in range(8, 22, 2):  # 8, 10, 12, 14, 16, 18, 20
        draw_name = f"Tirage {hour:02d}h00"
        
        # Check if schedule already exists
        existing = await db.global_schedules.find_one({
            "lottery_id": lottery_id,
            "draw_name": draw_name
        })
        
        if existing:
            # NEVER modify existing schedules - respect Super Admin config
            continue
        
        close_time = f"{hour-1:02d}:55"  # Close 5 minutes before
        open_time = f"{(hour-2):02d}:00" if hour > 8 else "06:00"
        
        await db.global_schedules.insert_one({
            "schedule_id": generate_id("sch_"),
            "lottery_id": lottery_id,
            "lottery_name": lottery_name,
            "draw_name": draw_name,
            "draw_time": f"{hour:02d}:00",
            "open_time": open_time,
            "close_time": close_time,
            "is_active": True,
            "interval_type": "EVERY_2_HOURS",
            "created_at": get_current_timestamp()
        })
        created_count += 1
    
    if created_count > 0:
        print(f"[SCHEDULER] Created {created_count} NEW schedules for Loto Rapid")


async def auto_generate_next_results():
    """
    Auto-generate scheduled results for Plop Plop and Loto Rapid
    if none are programmed by Super Admin.
    This runs every hour to prepare the next batch.
    """
    if db is None:
        return
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Get Plop Plop and Loto Rapid lotteries
    plop_plop = await db.master_lotteries.find_one(
        {"lottery_name": {"$regex": "Plop Plop", "$options": "i"}},
        {"_id": 0, "lottery_id": 1, "lottery_name": 1}
    )
    
    loto_rapid = await db.master_lotteries.find_one(
        {"lottery_name": {"$regex": "Loto Rapid", "$options": "i"}},
        {"_id": 0, "lottery_id": 1, "lottery_name": 1}
    )
    
    # Generate for Plop Plop (hourly 8-21)
    if plop_plop:
        for date in [today, tomorrow]:
            for hour in range(8, 22):
                draw_name = f"Tirage {hour:02d}h00"
                draw_time = f"{hour:02d}:00"
                
                # Check if already scheduled
                existing = await db.scheduled_results.find_one({
                    "lottery_id": plop_plop["lottery_id"],
                    "draw_date": date,
                    "draw_name": draw_name,
                    "status": {"$ne": "CANCELLED"}
                })
                
                if not existing:
                    await db.scheduled_results.insert_one({
                        "scheduled_result_id": generate_id("schres_"),
                        "lottery_id": plop_plop["lottery_id"],
                        "lottery_name": plop_plop["lottery_name"],
                        "draw_name": draw_name,
                        "draw_date": date,
                        "draw_time": draw_time,
                        "winning_numbers": generate_random_winning_numbers(),
                        "is_auto_generated": True,
                        "status": "SCHEDULED",
                        "scheduled_release_at": f"{date}T{draw_time}:00+00:00",
                        "created_at": get_current_timestamp(),
                        "created_by": "SYSTEM_AUTO"
                    })
    
    # Generate for Loto Rapid (every 2 hours)
    if loto_rapid:
        for date in [today, tomorrow]:
            for hour in range(8, 22, 2):
                draw_name = f"Tirage {hour:02d}h00"
                draw_time = f"{hour:02d}:00"
                
                existing = await db.scheduled_results.find_one({
                    "lottery_id": loto_rapid["lottery_id"],
                    "draw_date": date,
                    "draw_name": draw_name,
                    "status": {"$ne": "CANCELLED"}
                })
                
                if not existing:
                    await db.scheduled_results.insert_one({
                        "scheduled_result_id": generate_id("schres_"),
                        "lottery_id": loto_rapid["lottery_id"],
                        "lottery_name": loto_rapid["lottery_name"],
                        "draw_name": draw_name,
                        "draw_date": date,
                        "draw_time": draw_time,
                        "winning_numbers": generate_random_winning_numbers(),
                        "is_auto_generated": True,
                        "status": "SCHEDULED",
                        "scheduled_release_at": f"{date}T{draw_time}:00+00:00",
                        "created_at": get_current_timestamp(),
                        "created_by": "SYSTEM_AUTO"
                    })
    
    print("[SCHEDULER] Auto-generated next results for Plop Plop and Loto Rapid")


# Initialize schedules on startup
async def initialize_lottery_schedules():
    """Called on app startup to ensure schedules exist"""
    await generate_plop_plop_schedules()
    await generate_loto_rapid_schedules()
    await auto_generate_next_results()
