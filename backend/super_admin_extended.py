"""
SUPER ADMIN EXTENDED ROUTES
- Global Lottery Catalog (50 USA States)
- Global Schedules
- Global Results
- Global Tickets/Reports/Agents/POS views
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from datetime import datetime, timezone

from models import (
    UserRole, GlobalSchedule, GlobalScheduleCreate,
    GlobalResult, GlobalResultCreate
)
from auth import decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

super_extended_router = APIRouter(prefix="/api/super")
security = HTTPBearer()

db = None

def set_super_extended_db(database):
    global db
    db = database

async def require_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    return user

# ============ USA STATES DATA ============
USA_STATES = [
    {"code": "AL", "name": "Alabama", "timezone": "America/Chicago"},
    {"code": "AK", "name": "Alaska", "timezone": "America/Anchorage"},
    {"code": "AZ", "name": "Arizona", "timezone": "America/Phoenix"},
    {"code": "AR", "name": "Arkansas", "timezone": "America/Chicago"},
    {"code": "CA", "name": "California", "timezone": "America/Los_Angeles"},
    {"code": "CO", "name": "Colorado", "timezone": "America/Denver"},
    {"code": "CT", "name": "Connecticut", "timezone": "America/New_York"},
    {"code": "DE", "name": "Delaware", "timezone": "America/New_York"},
    {"code": "FL", "name": "Florida", "timezone": "America/New_York"},
    {"code": "GA", "name": "Georgia", "timezone": "America/New_York"},
    {"code": "HI", "name": "Hawaii", "timezone": "Pacific/Honolulu"},
    {"code": "ID", "name": "Idaho", "timezone": "America/Boise"},
    {"code": "IL", "name": "Illinois", "timezone": "America/Chicago"},
    {"code": "IN", "name": "Indiana", "timezone": "America/Indiana/Indianapolis"},
    {"code": "IA", "name": "Iowa", "timezone": "America/Chicago"},
    {"code": "KS", "name": "Kansas", "timezone": "America/Chicago"},
    {"code": "KY", "name": "Kentucky", "timezone": "America/New_York"},
    {"code": "LA", "name": "Louisiana", "timezone": "America/Chicago"},
    {"code": "ME", "name": "Maine", "timezone": "America/New_York"},
    {"code": "MD", "name": "Maryland", "timezone": "America/New_York"},
    {"code": "MA", "name": "Massachusetts", "timezone": "America/New_York"},
    {"code": "MI", "name": "Michigan", "timezone": "America/Detroit"},
    {"code": "MN", "name": "Minnesota", "timezone": "America/Chicago"},
    {"code": "MS", "name": "Mississippi", "timezone": "America/Chicago"},
    {"code": "MO", "name": "Missouri", "timezone": "America/Chicago"},
    {"code": "MT", "name": "Montana", "timezone": "America/Denver"},
    {"code": "NE", "name": "Nebraska", "timezone": "America/Chicago"},
    {"code": "NV", "name": "Nevada", "timezone": "America/Los_Angeles"},
    {"code": "NH", "name": "New Hampshire", "timezone": "America/New_York"},
    {"code": "NJ", "name": "New Jersey", "timezone": "America/New_York"},
    {"code": "NM", "name": "New Mexico", "timezone": "America/Denver"},
    {"code": "NY", "name": "New York", "timezone": "America/New_York"},
    {"code": "NC", "name": "North Carolina", "timezone": "America/New_York"},
    {"code": "ND", "name": "North Dakota", "timezone": "America/Chicago"},
    {"code": "OH", "name": "Ohio", "timezone": "America/New_York"},
    {"code": "OK", "name": "Oklahoma", "timezone": "America/Chicago"},
    {"code": "OR", "name": "Oregon", "timezone": "America/Los_Angeles"},
    {"code": "PA", "name": "Pennsylvania", "timezone": "America/New_York"},
    {"code": "RI", "name": "Rhode Island", "timezone": "America/New_York"},
    {"code": "SC", "name": "South Carolina", "timezone": "America/New_York"},
    {"code": "SD", "name": "South Dakota", "timezone": "America/Chicago"},
    {"code": "TN", "name": "Tennessee", "timezone": "America/Chicago"},
    {"code": "TX", "name": "Texas", "timezone": "America/Chicago"},
    {"code": "UT", "name": "Utah", "timezone": "America/Denver"},
    {"code": "VT", "name": "Vermont", "timezone": "America/New_York"},
    {"code": "VA", "name": "Virginia", "timezone": "America/New_York"},
    {"code": "WA", "name": "Washington", "timezone": "America/Los_Angeles"},
    {"code": "WV", "name": "West Virginia", "timezone": "America/New_York"},
    {"code": "WI", "name": "Wisconsin", "timezone": "America/Chicago"},
    {"code": "WY", "name": "Wyoming", "timezone": "America/Denver"},
    {"code": "HT", "name": "Haiti", "timezone": "America/Port-au-Prince"},
    {"code": "DO", "name": "Dominican Republic", "timezone": "America/Santo_Domingo"},
]

# ============ SEED 50 STATES LOTTERY CATALOG ============
@super_extended_router.post("/seed-lottery-catalog")
async def seed_lottery_catalog(current_user: dict = Depends(require_super_admin)):
    """Seed the database with all 50 US states + Haiti lotteries"""
    now = get_current_timestamp()
    created_count = 0
    
    for state in USA_STATES:
        state_code = state["code"]
        state_name = state["name"]
        tz = state["timezone"]
        
        # Pick 3 Midday
        lottery_id_p3m = f"lot_{state_code.lower()}_p3m"
        existing = await db.lotteries.find_one({"lottery_id": lottery_id_p3m})
        if not existing:
            await db.lotteries.insert_one({
                "lottery_id": lottery_id_p3m,
                "region": "USA" if state_code not in ["HT", "DO"] else "Caribbean",
                "state_code": state_code,
                "state_name": state_name,
                "lottery_name": f"{state_name} Pick 3 Midday",
                "game_type": "PICK3",
                "draw_type": "MIDDAY",
                "timezone": tz,
                "default_open_time": "06:00",
                "default_close_time": "12:55",
                "default_draw_time": "13:00",
                "is_active": True,
                "created_at": now
            })
            created_count += 1
        
        # Pick 3 Evening
        lottery_id_p3e = f"lot_{state_code.lower()}_p3e"
        existing = await db.lotteries.find_one({"lottery_id": lottery_id_p3e})
        if not existing:
            await db.lotteries.insert_one({
                "lottery_id": lottery_id_p3e,
                "region": "USA" if state_code not in ["HT", "DO"] else "Caribbean",
                "state_code": state_code,
                "state_name": state_name,
                "lottery_name": f"{state_name} Pick 3 Evening",
                "game_type": "PICK3",
                "draw_type": "EVENING",
                "timezone": tz,
                "default_open_time": "13:00",
                "default_close_time": "19:55",
                "default_draw_time": "20:00",
                "is_active": True,
                "created_at": now
            })
            created_count += 1
        
        # Pick 4 Midday
        lottery_id_p4m = f"lot_{state_code.lower()}_p4m"
        existing = await db.lotteries.find_one({"lottery_id": lottery_id_p4m})
        if not existing:
            await db.lotteries.insert_one({
                "lottery_id": lottery_id_p4m,
                "region": "USA" if state_code not in ["HT", "DO"] else "Caribbean",
                "state_code": state_code,
                "state_name": state_name,
                "lottery_name": f"{state_name} Pick 4 Midday",
                "game_type": "PICK4",
                "draw_type": "MIDDAY",
                "timezone": tz,
                "default_open_time": "06:00",
                "default_close_time": "12:55",
                "default_draw_time": "13:00",
                "is_active": True,
                "created_at": now
            })
            created_count += 1
        
        # Pick 4 Evening
        lottery_id_p4e = f"lot_{state_code.lower()}_p4e"
        existing = await db.lotteries.find_one({"lottery_id": lottery_id_p4e})
        if not existing:
            await db.lotteries.insert_one({
                "lottery_id": lottery_id_p4e,
                "region": "USA" if state_code not in ["HT", "DO"] else "Caribbean",
                "state_code": state_code,
                "state_name": state_name,
                "lottery_name": f"{state_name} Pick 4 Evening",
                "game_type": "PICK4",
                "draw_type": "EVENING",
                "timezone": tz,
                "default_open_time": "13:00",
                "default_close_time": "19:55",
                "default_draw_time": "20:00",
                "is_active": True,
                "created_at": now
            })
            created_count += 1
    
    return {"message": f"Seeded {created_count} lotteries for {len(USA_STATES)} states/regions"}

# ============ GLOBAL LOTTERY CATALOG CRUD ============
@super_extended_router.get("/lottery-catalog")
async def get_lottery_catalog(
    current_user: dict = Depends(require_super_admin),
    state_code: Optional[str] = None,
    game_type: Optional[str] = None,
    is_active: Optional[bool] = None
):
    """Get all lotteries in the master catalog"""
    query = {}
    if state_code:
        query["state_code"] = state_code.upper()
    if game_type:
        query["game_type"] = game_type.upper()
    if is_active is not None:
        query["is_active"] = is_active
    
    lotteries = await db.lotteries.find(query, {"_id": 0}).sort([("state_code", 1), ("game_type", 1), ("draw_type", 1)]).to_list(1000)
    return lotteries

@super_extended_router.get("/lottery-catalog/{lottery_id}")
async def get_lottery_detail(lottery_id: str, current_user: dict = Depends(require_super_admin)):
    lottery = await db.lotteries.find_one({"lottery_id": lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    return lottery

@super_extended_router.put("/lottery-catalog/{lottery_id}")
async def update_lottery(
    lottery_id: str,
    updates: dict,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Update lottery details (Super Admin only)"""
    allowed_fields = ["lottery_name", "default_open_time", "default_close_time", "default_draw_time", "is_active", "timezone"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.lotteries.update_one({"lottery_id": lottery_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    await log_activity(
        db=db,
        action_type="LOTTERY_UPDATED",
        entity_type="lottery",
        entity_id=lottery_id,
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    lottery = await db.lotteries.find_one({"lottery_id": lottery_id}, {"_id": 0})
    return lottery

@super_extended_router.put("/lottery-catalog/{lottery_id}/toggle")
async def toggle_lottery_status(
    lottery_id: str,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Enable/disable a lottery globally"""
    lottery = await db.lotteries.find_one({"lottery_id": lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    new_status = not lottery.get("is_active", True)
    await db.lotteries.update_one(
        {"lottery_id": lottery_id},
        {"$set": {"is_active": new_status, "updated_at": get_current_timestamp()}}
    )
    
    await log_activity(
        db=db,
        action_type="LOTTERY_TOGGLED",
        entity_type="lottery",
        entity_id=lottery_id,
        performed_by=current_user["user_id"],
        metadata={"is_active": new_status, "lottery_name": lottery.get("lottery_name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Lottery {'enabled' if new_status else 'disabled'}", "is_active": new_status}

# ============ GLOBAL SCHEDULES ============
@super_extended_router.get("/schedules")
async def get_global_schedules(
    current_user: dict = Depends(require_super_admin),
    lottery_id: Optional[str] = None
):
    """Get all global schedules"""
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    schedules = await db.global_schedules.find(query, {"_id": 0}).sort([("lottery_id", 1), ("day_of_week", 1)]).to_list(1000)
    return schedules

@super_extended_router.post("/schedules")
async def create_global_schedule(
    schedule_data: GlobalScheduleCreate,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Create a global schedule (Super Admin only)"""
    lottery = await db.lotteries.find_one({"lottery_id": schedule_data.lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    schedule_id = generate_id("gsched_")
    now = get_current_timestamp()
    
    schedule = GlobalSchedule(
        schedule_id=schedule_id,
        lottery_id=schedule_data.lottery_id,
        lottery_name=lottery["lottery_name"],
        day_of_week=schedule_data.day_of_week,
        draw_name=schedule_data.draw_name,
        open_time=schedule_data.open_time,
        close_time=schedule_data.close_time,
        draw_time=schedule_data.draw_time,
        is_active=schedule_data.is_active,
        created_at=now
    )
    
    await db.global_schedules.insert_one(schedule.model_dump())
    
    await log_activity(
        db=db,
        action_type="GLOBAL_SCHEDULE_CREATED",
        entity_type="global_schedule",
        entity_id=schedule_id,
        performed_by=current_user["user_id"],
        metadata={"lottery_name": lottery["lottery_name"], "draw_name": schedule_data.draw_name},
        ip_address=request.client.host if request.client else None
    )
    
    return schedule

@super_extended_router.put("/schedules/{schedule_id}")
async def update_global_schedule(
    schedule_id: str,
    updates: dict,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Update a global schedule"""
    allowed_fields = ["open_time", "close_time", "draw_time", "is_active", "draw_name"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.global_schedules.update_one({"schedule_id": schedule_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    await log_activity(
        db=db,
        action_type="GLOBAL_SCHEDULE_UPDATED",
        entity_type="global_schedule",
        entity_id=schedule_id,
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    schedule = await db.global_schedules.find_one({"schedule_id": schedule_id}, {"_id": 0})
    return schedule

@super_extended_router.delete("/schedules/{schedule_id}")
async def delete_global_schedule(
    schedule_id: str,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Delete a global schedule"""
    schedule = await db.global_schedules.find_one({"schedule_id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    await db.global_schedules.delete_one({"schedule_id": schedule_id})
    
    await log_activity(
        db=db,
        action_type="GLOBAL_SCHEDULE_DELETED",
        entity_type="global_schedule",
        entity_id=schedule_id,
        performed_by=current_user["user_id"],
        metadata={"lottery_name": schedule.get("lottery_name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Schedule deleted"}

# ============ GLOBAL RESULTS ============
@super_extended_router.get("/results")
async def get_global_results(
    current_user: dict = Depends(require_super_admin),
    lottery_id: Optional[str] = None,
    draw_date: Optional[str] = None,
    limit: int = 200
):
    """Get all global results"""
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    if draw_date:
        query["draw_date"] = draw_date
    
    results = await db.global_results.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return results

@super_extended_router.post("/results")
async def create_global_result(
    result_data: GlobalResultCreate,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Create a global result (Super Admin only)"""
    lottery = await db.lotteries.find_one({"lottery_id": result_data.lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    # Check for duplicate
    existing = await db.global_results.find_one({
        "lottery_id": result_data.lottery_id,
        "draw_date": result_data.draw_date,
        "draw_name": result_data.draw_name
    })
    if existing:
        raise HTTPException(status_code=400, detail="Result already exists for this draw")
    
    result_id = generate_id("gres_")
    now = get_current_timestamp()
    
    result = GlobalResult(
        result_id=result_id,
        lottery_id=result_data.lottery_id,
        lottery_name=lottery["lottery_name"],
        draw_date=result_data.draw_date,
        draw_name=result_data.draw_name,
        winning_numbers=result_data.winning_numbers,
        bonus_number=result_data.bonus_number,
        entered_by=current_user["user_id"],
        entered_by_name=current_user.get("name"),
        created_at=now
    )
    
    await db.global_results.insert_one(result.model_dump())
    
    await log_activity(
        db=db,
        action_type="GLOBAL_RESULT_CREATED",
        entity_type="global_result",
        entity_id=result_id,
        performed_by=current_user["user_id"],
        metadata={
            "lottery_name": lottery["lottery_name"],
            "draw_date": result_data.draw_date,
            "winning_numbers": result_data.winning_numbers
        },
        ip_address=request.client.host if request.client else None
    )
    
    return result

@super_extended_router.put("/results/{result_id}")
async def update_global_result(
    result_id: str,
    updates: dict,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Update a global result"""
    allowed_fields = ["winning_numbers", "bonus_number"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.global_results.update_one({"result_id": result_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Result not found")
    
    await log_activity(
        db=db,
        action_type="GLOBAL_RESULT_UPDATED",
        entity_type="global_result",
        entity_id=result_id,
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    result_doc = await db.global_results.find_one({"result_id": result_id}, {"_id": 0})
    return result_doc

@super_extended_router.delete("/results/{result_id}")
async def delete_global_result(
    result_id: str,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Delete a global result"""
    result = await db.global_results.find_one({"result_id": result_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    await db.global_results.delete_one({"result_id": result_id})
    
    await log_activity(
        db=db,
        action_type="GLOBAL_RESULT_DELETED",
        entity_type="global_result",
        entity_id=result_id,
        performed_by=current_user["user_id"],
        metadata={"lottery_name": result.get("lottery_name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Result deleted"}

# ============ GLOBAL VIEWS (All Companies) ============
@super_extended_router.get("/all-tickets")
async def get_all_tickets(
    current_user: dict = Depends(require_super_admin),
    company_id: Optional[str] = None,
    lottery_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 500
):
    """Get all tickets across all companies"""
    query = {}
    if company_id:
        query["company_id"] = company_id
    if lottery_id:
        query["lottery_id"] = lottery_id
    if status:
        query["status"] = status
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return tickets

@super_extended_router.get("/all-agents")
async def get_all_agents(
    current_user: dict = Depends(require_super_admin),
    company_id: Optional[str] = None,
    status: Optional[str] = None
):
    """Get all agents across all companies"""
    query = {}
    if company_id:
        query["company_id"] = company_id
    if status:
        query["status"] = status
    
    agents = await db.agents.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Add company name
    for agent in agents:
        company = await db.companies.find_one({"company_id": agent.get("company_id")}, {"_id": 0, "name": 1})
        agent["company_name"] = company.get("name") if company else "Unknown"
    
    return agents

@super_extended_router.get("/all-pos-devices")
async def get_all_pos_devices(
    current_user: dict = Depends(require_super_admin),
    company_id: Optional[str] = None,
    status: Optional[str] = None
):
    """Get all POS devices across all companies"""
    query = {}
    if company_id:
        query["company_id"] = company_id
    if status:
        query["status"] = status
    
    devices = await db.pos_devices.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for device in devices:
        company = await db.companies.find_one({"company_id": device.get("company_id")}, {"_id": 0, "name": 1})
        device["company_name"] = company.get("name") if company else "Unknown"
    
    return devices

@super_extended_router.get("/all-vendors")
async def get_all_vendors(
    current_user: dict = Depends(require_super_admin),
    company_id: Optional[str] = None
):
    """Get all vendors across all companies"""
    query = {}
    if company_id:
        query["company_id"] = company_id
    
    vendors = await db.vendors.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for vendor in vendors:
        company = await db.companies.find_one({"company_id": vendor.get("company_id")}, {"_id": 0, "name": 1})
        vendor["company_name"] = company.get("name") if company else "Unknown"
    
    return vendors

@super_extended_router.get("/company-admins")
async def get_company_admins(
    current_user: dict = Depends(require_super_admin)
):
    """Get all company admins"""
    admins = await db.users.find(
        {"role": UserRole.COMPANY_ADMIN},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(1000)
    
    for admin in admins:
        if admin.get("company_id"):
            company = await db.companies.find_one({"company_id": admin["company_id"]}, {"_id": 0, "name": 1})
            admin["company_name"] = company.get("name") if company else "Unknown"
    
    return admins

@super_extended_router.get("/global-stats")
async def get_global_stats(current_user: dict = Depends(require_super_admin)):
    """Get global platform statistics"""
    total_companies = await db.companies.count_documents({})
    active_companies = await db.companies.count_documents({"status": "ACTIVE"})
    total_agents = await db.agents.count_documents({})
    active_agents = await db.agents.count_documents({"status": "ACTIVE"})
    total_pos = await db.pos_devices.count_documents({})
    active_pos = await db.pos_devices.count_documents({"status": "ACTIVE"})
    total_lotteries = await db.lotteries.count_documents({})
    active_lotteries = await db.lotteries.count_documents({"is_active": True})
    
    # Today's stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    tickets_today = await db.tickets.count_documents({"created_at": {"$gte": today_start}})
    
    pipeline = [
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    sales_result = await db.tickets.aggregate(pipeline).to_list(1)
    sales_today = sales_result[0]["total"] if sales_result else 0.0
    
    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "total_agents": total_agents,
        "active_agents": active_agents,
        "total_pos_devices": total_pos,
        "active_pos_devices": active_pos,
        "total_lotteries": total_lotteries,
        "active_lotteries": active_lotteries,
        "tickets_today": tickets_today,
        "sales_today": sales_today
    }
