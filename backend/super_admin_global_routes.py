from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone

from models import (
    UserRole, GlobalLottery, GlobalLotteryCreate, GlobalLotteryUpdate,
    GlobalScheduleEnhanced, GlobalScheduleCreateEnhanced, GlobalScheduleUpdateEnhanced,
    GlobalResultEnhanced, GlobalResultCreateEnhanced,
    CompanyEnhanced, CompanyUpdateSuper
)
from auth import decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

super_admin_global_router = APIRouter(prefix="/api/super")
security = HTTPBearer()

db = None
# Function to process tickets - will be set by server.py
process_tickets_for_result = None

def set_super_admin_global_db(database):
    global db
    db = database

def set_ticket_processor(processor_func):
    """Set the ticket processing function from financial_routes"""
    global process_tickets_for_result
    process_tickets_for_result = processor_func

async def get_super_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
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

# ============ GLOBAL LOTTERY CATALOG ============
@super_admin_global_router.get("/lottery-catalog", response_model=List[GlobalLottery])
async def get_lottery_catalog(
    current_user: dict = Depends(get_super_admin_user),
    state_code: Optional[str] = None,
    game_type: Optional[str] = None,
    is_active: Optional[bool] = None
):
    """Get all lotteries in the global catalog"""
    query = {}
    if state_code:
        query["state_code"] = state_code
    if game_type:
        query["game_type"] = game_type
    if is_active is not None:
        query["is_active"] = is_active
    
    lotteries = await db.global_lotteries.find(query, {"_id": 0}).sort("state_code", 1).to_list(2000)
    return [GlobalLottery(**l) for l in lotteries]

@super_admin_global_router.get("/lottery-catalog/{lottery_id}", response_model=GlobalLottery)
async def get_lottery(lottery_id: str, current_user: dict = Depends(get_super_admin_user)):
    """Get single lottery details"""
    lottery = await db.global_lotteries.find_one({"lottery_id": lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    return GlobalLottery(**lottery)

@super_admin_global_router.post("/lottery-catalog", response_model=GlobalLottery)
async def create_lottery(
    lottery_data: GlobalLotteryCreate,
    request: Request,
    current_user: dict = Depends(get_super_admin_user)
):
    """Create a new lottery in the global catalog"""
    lottery_id = generate_id("lot_")
    now = get_current_timestamp()
    
    lottery = GlobalLottery(
        lottery_id=lottery_id,
        state_code=lottery_data.state_code,
        state_name=lottery_data.state_name,
        country=lottery_data.country,
        lottery_name=lottery_data.lottery_name,
        game_type=lottery_data.game_type,
        description=lottery_data.description,
        is_active=lottery_data.is_active,
        created_at=now,
        updated_at=now
    )
    
    await db.global_lotteries.insert_one(lottery.model_dump())
    
    # Also insert into legacy lotteries collection for compatibility
    legacy_lottery = {
        "lottery_id": lottery_id,
        "region": lottery_data.state_name,
        "state_id": lottery_data.state_code,
        "lottery_name": lottery_data.lottery_name,
        "game_type": lottery_data.game_type,
        "draw_times": [],
        "sales_open_offset_minutes": 240,
        "sales_close_offset_minutes": 5,
        "description": lottery_data.description
    }
    await db.lotteries.insert_one(legacy_lottery)
    
    await log_activity(
        db=db,
        action_type="LOTTERY_CREATED",
        entity_type="lottery",
        entity_id=lottery_id,
        performed_by=current_user["user_id"],
        metadata={"lottery_name": lottery_data.lottery_name, "state": lottery_data.state_code},
        ip_address=request.client.host if request.client else None
    )
    
    return lottery

@super_admin_global_router.put("/lottery-catalog/{lottery_id}", response_model=GlobalLottery)
async def update_lottery(
    lottery_id: str,
    updates: GlobalLotteryUpdate,
    request: Request,
    current_user: dict = Depends(get_super_admin_user)
):
    """Update a lottery in the global catalog"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.global_lotteries.update_one({"lottery_id": lottery_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    # Update legacy collection too
    legacy_update = {}
    if "lottery_name" in update_data:
        legacy_update["lottery_name"] = update_data["lottery_name"]
    if "game_type" in update_data:
        legacy_update["game_type"] = update_data["game_type"]
    if "description" in update_data:
        legacy_update["description"] = update_data["description"]
    if legacy_update:
        await db.lotteries.update_one({"lottery_id": lottery_id}, {"$set": legacy_update})
    
    lottery_doc = await db.global_lotteries.find_one({"lottery_id": lottery_id}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="LOTTERY_UPDATED",
        entity_type="lottery",
        entity_id=lottery_id,
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return GlobalLottery(**lottery_doc)

@super_admin_global_router.delete("/lottery-catalog/{lottery_id}")
async def delete_lottery(
    lottery_id: str,
    request: Request,
    current_user: dict = Depends(get_super_admin_user)
):
    """Deactivate a lottery (soft delete)"""
    result = await db.global_lotteries.update_one(
        {"lottery_id": lottery_id},
        {"$set": {"is_active": False, "updated_at": get_current_timestamp()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    await log_activity(
        db=db,
        action_type="LOTTERY_DEACTIVATED",
        entity_type="lottery",
        entity_id=lottery_id,
        performed_by=current_user["user_id"],
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Lottery deactivated successfully"}

# ============ GLOBAL SCHEDULES ============
@super_admin_global_router.get("/global-schedules", response_model=List[GlobalScheduleEnhanced])
async def get_global_schedules(
    current_user: dict = Depends(get_super_admin_user),
    lottery_id: Optional[str] = None,
    is_active: Optional[bool] = None
):
    """Get all global schedules"""
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    if is_active is not None:
        query["is_active"] = is_active
    
    schedules = await db.global_schedules.find(query, {"_id": 0}).sort("lottery_id", 1).to_list(1000)
    
    # Enrich with lottery info
    for schedule in schedules:
        lottery = await db.global_lotteries.find_one({"lottery_id": schedule["lottery_id"]}, {"_id": 0})
        if lottery:
            schedule["lottery_name"] = lottery.get("lottery_name")
            schedule["state_code"] = lottery.get("state_code")
    
    return [GlobalScheduleEnhanced(**s) for s in schedules]

@super_admin_global_router.post("/global-schedules", response_model=GlobalScheduleEnhanced)
async def create_global_schedule(
    schedule_data: GlobalScheduleCreateEnhanced,
    request: Request,
    current_user: dict = Depends(get_super_admin_user)
):
    """Create a new global schedule"""
    # Verify lottery exists
    lottery = await db.global_lotteries.find_one({"lottery_id": schedule_data.lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    schedule_id = generate_id("gsched_")
    now = get_current_timestamp()
    
    schedule = GlobalScheduleEnhanced(
        schedule_id=schedule_id,
        lottery_id=schedule_data.lottery_id,
        lottery_name=lottery.get("lottery_name"),
        state_code=lottery.get("state_code"),
        draw_name=schedule_data.draw_name,
        days_of_week=schedule_data.days_of_week,
        open_time=schedule_data.open_time,
        close_time=schedule_data.close_time,
        draw_time=schedule_data.draw_time,
        is_active=schedule_data.is_active,
        created_at=now,
        updated_at=now
    )
    
    await db.global_schedules.insert_one(schedule.model_dump())
    
    await log_activity(
        db=db,
        action_type="GLOBAL_SCHEDULE_CREATED",
        entity_type="global_schedule",
        entity_id=schedule_id,
        performed_by=current_user["user_id"],
        metadata={"lottery": lottery.get("lottery_name"), "draw_name": schedule_data.draw_name},
        ip_address=request.client.host if request.client else None
    )
    
    return schedule

@super_admin_global_router.put("/global-schedules/{schedule_id}", response_model=GlobalScheduleEnhanced)
async def update_global_schedule(
    schedule_id: str,
    updates: GlobalScheduleUpdateEnhanced,
    request: Request,
    current_user: dict = Depends(get_super_admin_user)
):
    """Update a global schedule"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.global_schedules.update_one({"schedule_id": schedule_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    schedule_doc = await db.global_schedules.find_one({"schedule_id": schedule_id}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="GLOBAL_SCHEDULE_UPDATED",
        entity_type="global_schedule",
        entity_id=schedule_id,
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return GlobalScheduleEnhanced(**schedule_doc)

@super_admin_global_router.delete("/global-schedules/{schedule_id}")
async def delete_global_schedule(
    schedule_id: str,
    request: Request,
    current_user: dict = Depends(get_super_admin_user)
):
    """Delete a global schedule"""
    result = await db.global_schedules.delete_one({"schedule_id": schedule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    await log_activity(
        db=db,
        action_type="GLOBAL_SCHEDULE_DELETED",
        entity_type="global_schedule",
        entity_id=schedule_id,
        performed_by=current_user["user_id"],
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Schedule deleted successfully"}

# ============ GLOBAL RESULTS ============
@super_admin_global_router.get("/global-results", response_model=List[GlobalResultEnhanced])
async def get_global_results(
    current_user: dict = Depends(get_super_admin_user),
    lottery_id: Optional[str] = None,
    draw_date: Optional[str] = None,
    limit: int = 500
):
    """Get all global results"""
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    if draw_date:
        query["draw_date"] = draw_date
    
    results = await db.global_results.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [GlobalResultEnhanced(**r) for r in results]

@super_admin_global_router.post("/global-results", response_model=GlobalResultEnhanced)
async def create_global_result(
    result_data: GlobalResultCreateEnhanced,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_super_admin_user)
):
    """Enter a new global result - ONLY Super Admin can do this"""
    # Verify lottery exists
    lottery = await db.global_lotteries.find_one({"lottery_id": result_data.lottery_id}, {"_id": 0})
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
    
    result = GlobalResultEnhanced(
        result_id=result_id,
        lottery_id=result_data.lottery_id,
        lottery_name=lottery.get("lottery_name"),
        state_code=lottery.get("state_code"),
        draw_date=result_data.draw_date,
        draw_name=result_data.draw_name,
        winning_numbers=result_data.winning_numbers,
        winning_numbers_parsed=result_data.winning_numbers_parsed,
        bonus_number=result_data.bonus_number,
        entered_by=current_user["user_id"],
        entered_by_name=current_user.get("name"),
        is_verified=True,  # Super Admin results are auto-verified
        created_at=now,
        updated_at=now
    )
    
    await db.global_results.insert_one(result.model_dump())
    
    await log_activity(
        db=db,
        action_type="GLOBAL_RESULT_ENTERED",
        entity_type="global_result",
        entity_id=result_id,
        performed_by=current_user["user_id"],
        metadata={
            "lottery": lottery.get("lottery_name"),
            "draw_date": result_data.draw_date,
            "draw_name": result_data.draw_name,
            "winning_numbers": result_data.winning_numbers
        },
        ip_address=request.client.host if request.client else None
    )
    
    # AUTOMATIC WINNING DETECTION: Process all pending tickets for this result
    if process_tickets_for_result:
        background_tasks.add_task(process_tickets_for_result, result.model_dump())
    
    return result

@super_admin_global_router.put("/global-results/{result_id}", response_model=GlobalResultEnhanced)
async def update_global_result(
    result_id: str,
    updates: dict,
    request: Request,
    current_user: dict = Depends(get_super_admin_user)
):
    """Update a global result"""
    allowed_fields = ["winning_numbers", "winning_numbers_parsed", "bonus_number"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.global_results.update_one({"result_id": result_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Result not found")
    
    result_doc = await db.global_results.find_one({"result_id": result_id}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="GLOBAL_RESULT_UPDATED",
        entity_type="global_result",
        entity_id=result_id,
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return GlobalResultEnhanced(**result_doc)

@super_admin_global_router.delete("/global-results/{result_id}")
async def delete_global_result(
    result_id: str,
    request: Request,
    current_user: dict = Depends(get_super_admin_user)
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
        metadata={"lottery": result.get("lottery_name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Result deleted successfully"}

# ============ SUPER ADMIN COMPANY MANAGEMENT ============
@super_admin_global_router.get("/companies-enhanced", response_model=List[CompanyEnhanced])
async def get_companies_enhanced(current_user: dict = Depends(get_super_admin_user)):
    """Get all companies with enhanced info"""
    companies = await db.companies.find({}, {"_id": 0}).to_list(1000)
    
    enhanced = []
    for c in companies:
        # Get agent count
        agents_count = await db.agents.count_documents({"company_id": c["company_id"]})
        # Get POS count
        pos_count = await db.pos_devices.count_documents({"company_id": c["company_id"]})
        # Get last login of company admin
        admin = await db.users.find_one(
            {"company_id": c["company_id"], "role": "COMPANY_ADMIN"},
            {"_id": 0, "last_login": 1}
        )
        
        enhanced.append(CompanyEnhanced(
            company_id=c["company_id"],
            name=c["name"],
            slug=c["slug"],
            status=c["status"],
            plan=c.get("plan", "Basic"),
            license_start=c.get("license_start"),
            license_end=c.get("license_end"),
            currency=c.get("currency", "HTG"),
            timezone=c.get("timezone", "America/Port-au-Prince"),
            contact_email=c.get("contact_email"),
            contact_phone=c.get("contact_phone"),
            logo_url=c.get("logo_url"),
            last_login=admin.get("last_login") if admin else None,
            agents_count=agents_count,
            pos_count=pos_count,
            created_at=c["created_at"],
            updated_at=c["updated_at"]
        ))
    
    return enhanced

@super_admin_global_router.put("/companies-enhanced/{company_id}")
async def update_company_enhanced(
    company_id: str,
    updates: CompanyUpdateSuper,
    request: Request,
    current_user: dict = Depends(get_super_admin_user)
):
    """Update company with super admin powers (suspend, reactivate, change subscription)"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.companies.update_one({"company_id": company_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Log special actions
    action_type = "COMPANY_UPDATED"
    if "status" in update_data:
        if update_data["status"] == "SUSPENDED":
            action_type = "COMPANY_SUSPENDED"
        elif update_data["status"] == "ACTIVE":
            action_type = "COMPANY_REACTIVATED"
    
    await log_activity(
        db=db,
        action_type=action_type,
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    company_doc = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    return company_doc

# ============ SUPER ADMIN GLOBAL VIEWS ============
@super_admin_global_router.get("/all-agents")
async def get_all_agents(
    current_user: dict = Depends(get_super_admin_user),
    company_id: Optional[str] = None,
    status: Optional[str] = None
):
    """Get all agents across all companies"""
    query = {}
    if company_id:
        query["company_id"] = company_id
    if status:
        query["status"] = status
    
    agents = await db.agents.find(query, {"_id": 0}).to_list(5000)
    
    # Enrich with company name
    for agent in agents:
        company = await db.companies.find_one({"company_id": agent["company_id"]}, {"_id": 0, "name": 1})
        agent["company_name"] = company.get("name") if company else "Unknown"
    
    return agents

@super_admin_global_router.get("/all-pos-devices")
async def get_all_pos_devices(
    current_user: dict = Depends(get_super_admin_user),
    company_id: Optional[str] = None,
    status: Optional[str] = None
):
    """Get all POS devices across all companies"""
    query = {}
    if company_id:
        query["company_id"] = company_id
    if status:
        query["status"] = status
    
    devices = await db.pos_devices.find(query, {"_id": 0}).to_list(5000)
    
    # Enrich with company and agent names
    for device in devices:
        company = await db.companies.find_one({"company_id": device["company_id"]}, {"_id": 0, "name": 1})
        device["company_name"] = company.get("name") if company else "Unknown"
        
        if device.get("assigned_agent_id"):
            agent = await db.agents.find_one({"agent_id": device["assigned_agent_id"]}, {"_id": 0, "name": 1})
            device["assigned_agent_name"] = agent.get("name") if agent else None
    
    return devices

@super_admin_global_router.get("/all-vendors")
async def get_all_vendors(
    current_user: dict = Depends(get_super_admin_user),
    company_id: Optional[str] = None
):
    """Get all vendors across all companies"""
    query = {}
    if company_id:
        query["company_id"] = company_id
    
    vendors = await db.vendors.find(query, {"_id": 0}).to_list(5000)
    
    for vendor in vendors:
        company = await db.companies.find_one({"company_id": vendor["company_id"]}, {"_id": 0, "name": 1})
        vendor["company_name"] = company.get("name") if company else "Unknown"
    
    return vendors

@super_admin_global_router.get("/all-tickets")
async def get_all_tickets(
    current_user: dict = Depends(get_super_admin_user),
    company_id: Optional[str] = None,
    lottery_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 1000
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
    
    # Enrich with company name
    for ticket in tickets:
        company = await db.companies.find_one({"company_id": ticket["company_id"]}, {"_id": 0, "name": 1})
        ticket["company_name"] = company.get("name") if company else "Unknown"
    
    return tickets

@super_admin_global_router.get("/platform-stats")
async def get_platform_stats(current_user: dict = Depends(get_super_admin_user)):
    """Get platform-wide statistics"""
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - timedelta(days=7)).isoformat()
    month_start = (now - timedelta(days=30)).isoformat()
    
    # Company stats
    total_companies = await db.companies.count_documents({})
    active_companies = await db.companies.count_documents({"status": "ACTIVE"})
    suspended_companies = await db.companies.count_documents({"status": "SUSPENDED"})
    
    # Agent stats
    total_agents = await db.agents.count_documents({})
    active_agents = await db.agents.count_documents({"status": "ACTIVE"})
    
    # POS stats
    total_pos = await db.pos_devices.count_documents({})
    active_pos = await db.pos_devices.count_documents({"status": "ACTIVE"})
    
    # Ticket stats
    tickets_today = await db.tickets.count_documents({"created_at": {"$gte": today_start}})
    tickets_week = await db.tickets.count_documents({"created_at": {"$gte": week_start}})
    tickets_month = await db.tickets.count_documents({"created_at": {"$gte": month_start}})
    
    # Sales stats
    pipeline_today = [
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    sales_today_result = await db.tickets.aggregate(pipeline_today).to_list(1)
    sales_today = sales_today_result[0]["total"] if sales_today_result else 0.0
    
    pipeline_month = [
        {"$match": {"created_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    sales_month_result = await db.tickets.aggregate(pipeline_month).to_list(1)
    sales_month = sales_month_result[0]["total"] if sales_month_result else 0.0
    
    # Lottery catalog stats
    total_lotteries = await db.global_lotteries.count_documents({})
    active_lotteries = await db.global_lotteries.count_documents({"is_active": True})
    
    return {
        "companies": {
            "total": total_companies,
            "active": active_companies,
            "suspended": suspended_companies
        },
        "agents": {
            "total": total_agents,
            "active": active_agents
        },
        "pos_devices": {
            "total": total_pos,
            "active": active_pos
        },
        "tickets": {
            "today": tickets_today,
            "week": tickets_week,
            "month": tickets_month
        },
        "sales": {
            "today": sales_today,
            "month": sales_month
        },
        "lotteries": {
            "total": total_lotteries,
            "active": active_lotteries
        },
        "generated_at": now.isoformat()
    }

# ============ SEED LOTTERY DATA ENDPOINT ============
@super_admin_global_router.post("/seed-lottery-catalog")
async def seed_lottery_catalog(
    request: Request,
    current_user: dict = Depends(get_super_admin_user)
):
    """Seed the lottery catalog with all 50 US states data"""
    us_states = [
        ("AL", "Alabama"), ("AK", "Alaska"), ("AZ", "Arizona"), ("AR", "Arkansas"),
        ("CA", "California"), ("CO", "Colorado"), ("CT", "Connecticut"), ("DE", "Delaware"),
        ("FL", "Florida"), ("GA", "Georgia"), ("HI", "Hawaii"), ("ID", "Idaho"),
        ("IL", "Illinois"), ("IN", "Indiana"), ("IA", "Iowa"), ("KS", "Kansas"),
        ("KY", "Kentucky"), ("LA", "Louisiana"), ("ME", "Maine"), ("MD", "Maryland"),
        ("MA", "Massachusetts"), ("MI", "Michigan"), ("MN", "Minnesota"), ("MS", "Mississippi"),
        ("MO", "Missouri"), ("MT", "Montana"), ("NE", "Nebraska"), ("NV", "Nevada"),
        ("NH", "New Hampshire"), ("NJ", "New Jersey"), ("NM", "New Mexico"), ("NY", "New York"),
        ("NC", "North Carolina"), ("ND", "North Dakota"), ("OH", "Ohio"), ("OK", "Oklahoma"),
        ("OR", "Oregon"), ("PA", "Pennsylvania"), ("RI", "Rhode Island"), ("SC", "South Carolina"),
        ("SD", "South Dakota"), ("TN", "Tennessee"), ("TX", "Texas"), ("UT", "Utah"),
        ("VT", "Vermont"), ("VA", "Virginia"), ("WA", "Washington"), ("WV", "West Virginia"),
        ("WI", "Wisconsin"), ("WY", "Wyoming")
    ]
    
    game_types = ["PICK3", "PICK4", "PICK5"]
    now = get_current_timestamp()
    created_count = 0
    
    for state_code, state_name in us_states:
        for game_type in game_types:
            lottery_id = f"lot_{state_code.lower()}_{game_type.lower()}"
            lottery_name = f"{state_name} {game_type}"
            
            # Check if exists
            existing = await db.global_lotteries.find_one({"lottery_id": lottery_id})
            if existing:
                continue
            
            lottery = {
                "lottery_id": lottery_id,
                "state_code": state_code,
                "state_name": state_name,
                "country": "USA",
                "lottery_name": lottery_name,
                "game_type": game_type,
                "description": f"{state_name} official {game_type} lottery",
                "is_active": True,
                "created_at": now,
                "updated_at": now
            }
            
            await db.global_lotteries.insert_one(lottery)
            
            # Also add to legacy collection
            legacy = {
                "lottery_id": lottery_id,
                "region": state_name,
                "state_id": state_code,
                "lottery_name": lottery_name,
                "game_type": game_type,
                "draw_times": [],
                "sales_open_offset_minutes": 240,
                "sales_close_offset_minutes": 5,
                "description": f"{state_name} official {game_type} lottery"
            }
            await db.lotteries.insert_one(legacy)
            
            created_count += 1
    
    # Also add Haiti lotteries (Borlette specific)
    haiti_games = [
        ("BORLETTE", "Haiti Borlette"),
        ("LOTO3", "Haiti Loto 3"),
        ("LOTO4", "Haiti Loto 4"),
        ("LOTO5", "Haiti Loto 5"),
        ("MARIAGE", "Haiti Mariage")
    ]
    
    for game_type, lottery_name in haiti_games:
        lottery_id = f"lot_ht_{game_type.lower()}"
        
        existing = await db.global_lotteries.find_one({"lottery_id": lottery_id})
        if existing:
            continue
        
        lottery = {
            "lottery_id": lottery_id,
            "state_code": "HT",
            "state_name": "Haiti",
            "country": "Haiti",
            "lottery_name": lottery_name,
            "game_type": game_type,
            "description": f"Haiti official {game_type} lottery",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
        
        await db.global_lotteries.insert_one(lottery)
        
        legacy = {
            "lottery_id": lottery_id,
            "region": "Haiti",
            "state_id": "HT",
            "lottery_name": lottery_name,
            "game_type": game_type,
            "draw_times": [],
            "sales_open_offset_minutes": 240,
            "sales_close_offset_minutes": 5,
            "description": f"Haiti official {game_type} lottery"
        }
        await db.lotteries.insert_one(legacy)
        
        created_count += 1
    
    await log_activity(
        db=db,
        action_type="LOTTERY_CATALOG_SEEDED",
        entity_type="system",
        entity_id="lottery_catalog",
        performed_by=current_user["user_id"],
        metadata={"lotteries_created": created_count},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Lottery catalog seeded successfully. Created {created_count} lotteries."}


# ============ GLOBAL DEVICE SESSION MANAGEMENT (SUPER ADMIN) ============
@super_admin_global_router.get("/all-device-sessions")
async def get_all_device_sessions(
    current_user: dict = Depends(get_super_admin_user),
    company_id: Optional[str] = None,
    status: Optional[str] = None,
    device_type: Optional[str] = None
):
    """Get all device sessions across all companies"""
    query = {}
    if company_id:
        query["company_id"] = company_id
    if status:
        query["status"] = status
    if device_type:
        query["device_type"] = device_type
    
    sessions = await db.device_sessions.find(query, {"_id": 0}).sort("last_seen_at", -1).to_list(1000)
    
    # Enrich with company names
    company_ids = list(set(s.get("company_id") for s in sessions if s.get("company_id")))
    companies = await db.companies.find({"company_id": {"$in": company_ids}}, {"_id": 0}).to_list(100)
    company_map = {c["company_id"]: c["name"] for c in companies}
    
    for session in sessions:
        session["company_name"] = company_map.get(session.get("company_id"), "Unknown")
    
    return sessions

@super_admin_global_router.put("/device-sessions/{session_id}/block")
async def super_block_device_session(
    session_id: str,
    request: Request,
    current_user: dict = Depends(get_super_admin_user)
):
    """Block any device session globally"""
    result = await db.device_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": "blocked",
            "blocked_at": get_current_timestamp(),
            "blocked_by": current_user["user_id"],
            "blocked_by_super_admin": True
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = await db.device_sessions.find_one({"session_id": session_id}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="DEVICE_SESSION_BLOCKED_BY_SUPER",
        entity_type="device_session",
        entity_id=session_id,
        performed_by=current_user["user_id"],
        company_id=session.get("company_id") if session else None,
        metadata={"session_id": session_id, "agent_id": session.get("agent_id") if session else None},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Session blocked by Super Admin"}

@super_admin_global_router.put("/device-sessions/{session_id}/unblock")
async def super_unblock_device_session(
    session_id: str,
    request: Request,
    current_user: dict = Depends(get_super_admin_user)
):
    """Unblock any device session globally"""
    result = await db.device_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "active"}, "$unset": {"blocked_at": "", "blocked_by": "", "blocked_by_super_admin": ""}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = await db.device_sessions.find_one({"session_id": session_id}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="DEVICE_SESSION_UNBLOCKED_BY_SUPER",
        entity_type="device_session",
        entity_id=session_id,
        performed_by=current_user["user_id"],
        company_id=session.get("company_id") if session else None,
        metadata={"session_id": session_id},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Session unblocked by Super Admin"}

@super_admin_global_router.get("/device-sessions/stats")
async def get_device_sessions_stats(current_user: dict = Depends(get_super_admin_user)):
    """Get device sessions statistics"""
    total = await db.device_sessions.count_documents({})
    active = await db.device_sessions.count_documents({"status": "active"})
    blocked = await db.device_sessions.count_documents({"status": "blocked"})
    
    # By device type
    pipeline = [
        {"$group": {"_id": "$device_type", "count": {"$sum": 1}}}
    ]
    by_type = await db.device_sessions.aggregate(pipeline).to_list(10)
    
    # By company
    pipeline = [
        {"$group": {"_id": "$company_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    by_company = await db.device_sessions.aggregate(pipeline).to_list(10)
    
    # Enrich company names
    company_ids = [c["_id"] for c in by_company if c["_id"]]
    companies = await db.companies.find({"company_id": {"$in": company_ids}}, {"_id": 0}).to_list(100)
    company_map = {c["company_id"]: c["name"] for c in companies}
    
    for c in by_company:
        c["company_name"] = company_map.get(c["_id"], "Unknown")
    
    return {
        "total": total,
        "active": active,
        "blocked": blocked,
        "by_device_type": {item["_id"]: item["count"] for item in by_type},
        "top_companies": by_company
    }

