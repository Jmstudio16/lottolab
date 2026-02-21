from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from models import (
    UserRole, User, UserCreate, Agent, AgentCreate, AgentUpdate, AgentStatus,
    POSDevice, POSDeviceCreate, POSDeviceUpdate,
    Schedule, ScheduleCreate, ScheduleUpdate,
    Ticket, Result, ResultCreate, ActivityLog,
    CompanySettings, CompanySettingsUpdate, SalesReport
)
from auth import get_password_hash, decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

company_router = APIRouter(prefix="/api/company")
security = HTTPBearer()

db = None

def set_company_db(database):
    global db
    db = database

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

def require_company_access(user: dict, allowed_roles: List[str] = None):
    """
    STRICT RBAC: Only Company Admin, Manager, and Auditor can access company routes.
    Agents (AGENT_POS) are EXPLICITLY DENIED access to company admin routes.
    """
    # STRICT: Agents cannot access company admin routes
    if user.get("role") == UserRole.AGENT_POS:
        raise HTTPException(status_code=403, detail="Access denied. Company Admin role required.")
    
    if not user.get("company_id"):
        raise HTTPException(status_code=403, detail="No company access")
    
    # Default allowed roles for company routes (excludes AGENT_POS)
    default_allowed = [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.AUDITOR_READONLY]
    
    if allowed_roles:
        # Use provided roles, but ensure AGENT_POS is never allowed
        check_roles = [r for r in allowed_roles if r != UserRole.AGENT_POS]
    else:
        check_roles = default_allowed
    
    if user.get("role") not in check_roles:
        raise HTTPException(status_code=403, detail="Access denied for this role")
    
    return user["company_id"]

# ============ POS DEVICES CRUD ============
@company_router.get("/pos-devices", response_model=List[POSDevice])
async def get_pos_devices(current_user: dict = Depends(get_current_user)):
    company_id = require_company_access(current_user)
    devices = await db.pos_devices.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    return [POSDevice(**d) for d in devices]

@company_router.post("/pos-devices", response_model=POSDevice)
async def create_pos_device(
    device_data: POSDeviceCreate, 
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER])
    
    # Check IMEI uniqueness within company
    existing = await db.pos_devices.find_one({"company_id": company_id, "imei": device_data.imei})
    if existing:
        raise HTTPException(status_code=400, detail="IMEI already registered in your company")
    
    device_id = generate_id("dev_")
    now = get_current_timestamp()
    
    device = POSDevice(
        device_id=device_id,
        company_id=company_id,
        imei=device_data.imei,
        device_name=device_data.device_name,
        branch=device_data.branch,
        location=device_data.location,
        assigned_agent_id=device_data.assigned_agent_id,
        status="PENDING",
        notes=device_data.notes,
        created_at=now,
        updated_at=now
    )
    
    await db.pos_devices.insert_one(device.model_dump())
    
    await log_activity(
        db=db,
        action_type="POS_DEVICE_CREATED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"device_name": device_data.device_name, "imei": device_data.imei},
        ip_address=request.client.host if request.client else None
    )
    
    return device

@company_router.put("/pos-devices/{device_id}", response_model=POSDevice)
async def update_pos_device(
    device_id: str,
    updates: POSDeviceUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER])
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.pos_devices.update_one(
        {"device_id": device_id, "company_id": company_id}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="POS device not found")
    
    device_doc = await db.pos_devices.find_one({"device_id": device_id}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="POS_DEVICE_UPDATED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return POSDevice(**device_doc)

@company_router.delete("/pos-devices/{device_id}")
async def delete_pos_device(
    device_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    device = await db.pos_devices.find_one({"device_id": device_id, "company_id": company_id}, {"_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="POS device not found")
    
    await db.pos_devices.delete_one({"device_id": device_id, "company_id": company_id})
    
    await log_activity(
        db=db,
        action_type="POS_DEVICE_DELETED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"device_name": device.get("device_name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "POS device deleted successfully"}

@company_router.put("/pos-devices/{device_id}/activate")
async def activate_pos_device(
    device_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER])
    
    result = await db.pos_devices.update_one(
        {"device_id": device_id, "company_id": company_id},
        {"$set": {"status": "ACTIVE", "updated_at": get_current_timestamp()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="POS device not found")
    
    await log_activity(
        db=db,
        action_type="POS_DEVICE_ACTIVATED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "POS device activated"}

@company_router.put("/pos-devices/{device_id}/block")
async def block_pos_device(
    device_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER])
    
    result = await db.pos_devices.update_one(
        {"device_id": device_id, "company_id": company_id},
        {"$set": {"status": "BLOCKED", "updated_at": get_current_timestamp()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="POS device not found")
    
    await log_activity(
        db=db,
        action_type="POS_DEVICE_BLOCKED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "POS device blocked"}

@company_router.put("/pos-devices/{device_id}/assign/{agent_id}")
async def assign_agent_to_device(
    device_id: str,
    agent_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER])
    
    # Verify agent exists
    agent = await db.agents.find_one({"agent_id": agent_id, "company_id": company_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    result = await db.pos_devices.update_one(
        {"device_id": device_id, "company_id": company_id},
        {"$set": {"assigned_agent_id": agent_id, "updated_at": get_current_timestamp()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="POS device not found")
    
    await log_activity(
        db=db,
        action_type="POS_DEVICE_ASSIGNED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"agent_id": agent_id, "agent_name": agent.get("name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Agent {agent.get('name')} assigned to device"}

@company_router.put("/pos-devices/{device_id}/unassign")
async def unassign_agent_from_device(
    device_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER])
    
    result = await db.pos_devices.update_one(
        {"device_id": device_id, "company_id": company_id},
        {"$set": {"assigned_agent_id": None, "updated_at": get_current_timestamp()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="POS device not found")
    
    await log_activity(
        db=db,
        action_type="POS_DEVICE_UNASSIGNED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Agent unassigned from device"}

# ============ AGENTS CRUD ============
@company_router.get("/agents", response_model=List[Agent])
async def get_agents(current_user: dict = Depends(get_current_user)):
    company_id = require_company_access(current_user)
    agents = await db.agents.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    return [Agent(**a) for a in agents]

@company_router.post("/agents", response_model=Agent)
async def create_agent(
    agent_data: AgentCreate, 
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER])
    
    if not agent_data.email:
        raise HTTPException(status_code=400, detail="Email is required for agent creation")
    
    # Check username uniqueness within company
    existing = await db.agents.find_one({"company_id": company_id, "username": agent_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists in your company")
    
    # Check email uniqueness globally
    existing_email = await db.users.find_one({"email": agent_data.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    agent_id = generate_id("agent_")
    user_id = generate_id("user_")
    now = get_current_timestamp()
    
    # Create user account for agent
    user_doc = {
        "user_id": user_id,
        "email": agent_data.email,
        "password_hash": get_password_hash(agent_data.password),
        "name": agent_data.name,
        "role": UserRole.AGENT_POS,
        "company_id": company_id,
        "status": "ACTIVE",
        "last_login": None,
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(user_doc)
    
    agent = Agent(
        agent_id=agent_id,
        company_id=company_id,
        name=agent_data.name,
        username=agent_data.username,
        phone=agent_data.phone,
        email=agent_data.email,
        status=AgentStatus.ACTIVE,
        can_void_ticket=agent_data.can_void_ticket,
        user_id=user_id,
        created_at=now,
        updated_at=now
    )
    
    await db.agents.insert_one(agent.model_dump())
    
    await log_activity(
        db=db,
        action_type="AGENT_CREATED",
        entity_type="agent",
        entity_id=agent_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"agent_name": agent_data.name, "username": agent_data.username},
        ip_address=request.client.host if request.client else None
    )
    
    return agent

@company_router.put("/agents/{agent_id}", response_model=Agent)
async def update_agent(
    agent_id: str,
    updates: AgentUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER])
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.agents.update_one(
        {"agent_id": agent_id, "company_id": company_id}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent_doc = await db.agents.find_one({"agent_id": agent_id}, {"_id": 0})
    
    # Also update user status if agent status changed
    if "status" in update_data and agent_doc.get("user_id"):
        user_status = "ACTIVE" if update_data["status"] == "ACTIVE" else "SUSPENDED"
        await db.users.update_one(
            {"user_id": agent_doc["user_id"]},
            {"$set": {"status": user_status, "updated_at": get_current_timestamp()}}
        )
    
    await log_activity(
        db=db,
        action_type="AGENT_UPDATED",
        entity_type="agent",
        entity_id=agent_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return Agent(**agent_doc)

@company_router.delete("/agents/{agent_id}")
async def delete_agent(
    agent_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    agent = await db.agents.find_one({"agent_id": agent_id, "company_id": company_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Soft delete - set status to SUSPENDED
    await db.agents.update_one(
        {"agent_id": agent_id},
        {"$set": {"status": "SUSPENDED", "updated_at": get_current_timestamp()}}
    )
    
    # Also suspend user account
    if agent.get("user_id"):
        await db.users.update_one(
            {"user_id": agent["user_id"]},
            {"$set": {"status": "SUSPENDED", "updated_at": get_current_timestamp()}}
        )
    
    await log_activity(
        db=db,
        action_type="AGENT_DELETED",
        entity_type="agent",
        entity_id=agent_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"agent_name": agent.get("name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Agent deleted successfully"}

# ============ SCHEDULES CRUD ============
@company_router.get("/schedules", response_model=List[Schedule])
async def get_schedules(current_user: dict = Depends(get_current_user)):
    company_id = require_company_access(current_user)
    schedules = await db.schedules.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    return [Schedule(**s) for s in schedules]

@company_router.post("/schedules", response_model=Schedule)
async def create_schedule(
    schedule_data: ScheduleCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER])
    
    # Verify lottery exists
    lottery = await db.lotteries.find_one({"lottery_id": schedule_data.lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    # Check for duplicate schedule
    existing = await db.schedules.find_one({
        "company_id": company_id,
        "lottery_id": schedule_data.lottery_id,
        "day_of_week": schedule_data.day_of_week
    })
    if existing:
        raise HTTPException(status_code=400, detail="Schedule already exists for this lottery and day")
    
    schedule_id = generate_id("sched_")
    now = get_current_timestamp()
    
    schedule = Schedule(
        schedule_id=schedule_id,
        company_id=company_id,
        lottery_id=schedule_data.lottery_id,
        lottery_name=lottery["lottery_name"],
        day_of_week=schedule_data.day_of_week,
        open_time=schedule_data.open_time,
        close_time=schedule_data.close_time,
        draw_time=schedule_data.draw_time,
        is_active=schedule_data.is_active,
        created_at=now,
        updated_at=now
    )
    
    await db.schedules.insert_one(schedule.model_dump())
    
    await log_activity(
        db=db,
        action_type="SCHEDULE_CREATED",
        entity_type="schedule",
        entity_id=schedule_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"lottery_name": lottery["lottery_name"], "day": schedule_data.day_of_week},
        ip_address=request.client.host if request.client else None
    )
    
    return schedule

@company_router.put("/schedules/{schedule_id}", response_model=Schedule)
async def update_schedule(
    schedule_id: str,
    updates: ScheduleUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER])
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.schedules.update_one(
        {"schedule_id": schedule_id, "company_id": company_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    schedule_doc = await db.schedules.find_one({"schedule_id": schedule_id}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="SCHEDULE_UPDATED",
        entity_type="schedule",
        entity_id=schedule_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return Schedule(**schedule_doc)

@company_router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    schedule = await db.schedules.find_one({"schedule_id": schedule_id, "company_id": company_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    await db.schedules.delete_one({"schedule_id": schedule_id, "company_id": company_id})
    
    await log_activity(
        db=db,
        action_type="SCHEDULE_DELETED",
        entity_type="schedule",
        entity_id=schedule_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"lottery_name": schedule.get("lottery_name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Schedule deleted successfully"}

# ============ TICKETS ============
@company_router.get("/tickets", response_model=List[Ticket])
async def get_tickets(
    current_user: dict = Depends(get_current_user),
    agent_id: Optional[str] = None,
    lottery_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 500
):
    company_id = require_company_access(current_user)
    
    query = {"company_id": company_id}
    if agent_id:
        query["agent_id"] = agent_id
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
    return [Ticket(**t) for t in tickets]

@company_router.get("/tickets/{ticket_id}", response_model=Ticket)
async def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    company_id = require_company_access(current_user)
    
    ticket = await db.tickets.find_one({"ticket_id": ticket_id, "company_id": company_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return Ticket(**ticket)

# ============ RESULTS ============
@company_router.get("/results", response_model=List[Result])
async def get_results(
    current_user: dict = Depends(get_current_user),
    lottery_id: Optional[str] = None,
    limit: int = 200
):
    company_id = require_company_access(current_user)
    
    query = {"company_id": company_id}
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    results = await db.results.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [Result(**r) for r in results]

@company_router.post("/results", response_model=Result)
async def create_result(
    result_data: ResultCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER])
    
    lottery = await db.lotteries.find_one({"lottery_id": result_data.lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    # Check for duplicate result
    existing = await db.results.find_one({
        "company_id": company_id,
        "lottery_id": result_data.lottery_id,
        "draw_datetime": result_data.draw_datetime
    })
    if existing:
        raise HTTPException(status_code=400, detail="Result already exists for this draw")
    
    result_id = generate_id("res_")
    now = get_current_timestamp()
    
    result = Result(
        result_id=result_id,
        lottery_id=result_data.lottery_id,
        lottery_name=lottery["lottery_name"],
        company_id=company_id,
        draw_datetime=result_data.draw_datetime,
        winning_numbers=result_data.winning_numbers,
        source="MANUAL",
        entered_by=current_user["user_id"],
        created_at=now
    )
    
    await db.results.insert_one(result.model_dump())
    
    await log_activity(
        db=db,
        action_type="RESULT_CREATED",
        entity_type="result",
        entity_id=result_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"lottery_name": lottery["lottery_name"], "numbers": result_data.winning_numbers},
        ip_address=request.client.host if request.client else None
    )
    
    return result

@company_router.delete("/results/{result_id}")
async def delete_result(
    result_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    result = await db.results.find_one({"result_id": result_id, "company_id": company_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    await db.results.delete_one({"result_id": result_id, "company_id": company_id})
    
    await log_activity(
        db=db,
        action_type="RESULT_DELETED",
        entity_type="result",
        entity_id=result_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"lottery_name": result.get("lottery_name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Result deleted successfully"}

# ============ REPORTS ============
@company_router.get("/reports/summary", response_model=SalesReport)
async def get_sales_summary(
    current_user: dict = Depends(get_current_user),
    period: str = Query("today", regex="^(today|week|month|custom)$"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    company_id = require_company_access(current_user)
    
    now = datetime.now(timezone.utc)
    
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now
    elif period == "week":
        start_date = now - timedelta(days=7)
        end_date = now
    elif period == "month":
        start_date = now - timedelta(days=30)
        end_date = now
    else:
        start_date = datetime.fromisoformat(date_from) if date_from else now - timedelta(days=1)
        end_date = datetime.fromisoformat(date_to) if date_to else now
    
    start_str = start_date.isoformat()
    end_str = end_date.isoformat()
    
    # Total tickets and sales
    pipeline = [
        {"$match": {
            "company_id": company_id,
            "created_at": {"$gte": start_str, "$lte": end_str}
        }},
        {"$group": {
            "_id": None,
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"}
        }}
    ]
    total_result = await db.tickets.aggregate(pipeline).to_list(1)
    total_tickets = total_result[0]["total_tickets"] if total_result else 0
    total_sales = total_result[0]["total_sales"] if total_result else 0.0
    
    # Sales by agent
    agent_pipeline = [
        {"$match": {
            "company_id": company_id,
            "created_at": {"$gte": start_str, "$lte": end_str}
        }},
        {"$group": {
            "_id": "$agent_id",
            "tickets": {"$sum": 1},
            "sales": {"$sum": "$total_amount"}
        }},
        {"$sort": {"sales": -1}},
        {"$limit": 10}
    ]
    agent_results = await db.tickets.aggregate(agent_pipeline).to_list(10)
    
    sales_by_agent = []
    for ar in agent_results:
        agent = await db.agents.find_one({"agent_id": ar["_id"]}, {"_id": 0, "name": 1})
        if not agent:
            agent = await db.users.find_one({"user_id": ar["_id"]}, {"_id": 0, "name": 1})
        sales_by_agent.append({
            "agent_id": ar["_id"],
            "agent_name": agent.get("name", "Unknown") if agent else "Unknown",
            "tickets": ar["tickets"],
            "sales": ar["sales"]
        })
    
    # Sales by lottery
    lottery_pipeline = [
        {"$match": {
            "company_id": company_id,
            "created_at": {"$gte": start_str, "$lte": end_str}
        }},
        {"$group": {
            "_id": "$lottery_id",
            "lottery_name": {"$first": "$lottery_name"},
            "tickets": {"$sum": 1},
            "sales": {"$sum": "$total_amount"}
        }},
        {"$sort": {"sales": -1}},
        {"$limit": 10}
    ]
    lottery_results = await db.tickets.aggregate(lottery_pipeline).to_list(10)
    
    sales_by_lottery = [
        {
            "lottery_id": lr["_id"],
            "lottery_name": lr["lottery_name"],
            "tickets": lr["tickets"],
            "sales": lr["sales"]
        }
        for lr in lottery_results
    ]
    
    return SalesReport(
        total_tickets=total_tickets,
        total_sales=total_sales,
        total_wins=0.0,
        net_revenue=total_sales,
        sales_by_agent=sales_by_agent,
        sales_by_lottery=sales_by_lottery,
        period_start=start_str,
        period_end=end_str
    )

# ============ COMPANY USERS ============
@company_router.get("/users", response_model=List[User])
async def get_company_users(current_user: dict = Depends(get_current_user)):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    # Get company staff users (not agents)
    users = await db.users.find(
        {
            "company_id": company_id,
            "role": {"$in": [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.AUDITOR_READONLY]}
        },
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    return [User(**u) for u in users]

@company_router.post("/users", response_model=User)
async def create_company_user(
    user_data: UserCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    # Only allow creating company-level roles
    allowed_roles = [UserRole.COMPANY_MANAGER, UserRole.AUDITOR_READONLY]
    if user_data.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Can only create Manager or Auditor roles")
    
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_id = generate_id("user_")
    now = get_current_timestamp()
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "company_id": company_id,
        "status": "ACTIVE",
        "last_login": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    await log_activity(
        db=db,
        action_type="COMPANY_USER_CREATED",
        entity_type="user",
        entity_id=user_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"user_name": user_data.name, "role": user_data.role},
        ip_address=request.client.host if request.client else None
    )
    
    user_doc.pop("password_hash")
    return User(**user_doc)

@company_router.put("/users/{user_id}", response_model=User)
async def update_company_user(
    user_id: str,
    updates: dict,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    # Cannot update your own account this way
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot update your own account here")
    
    allowed_fields = ["name", "status", "role"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Only allow changing to allowed roles
    if "role" in update_data:
        allowed_roles = [UserRole.COMPANY_MANAGER, UserRole.AUDITOR_READONLY]
        if update_data["role"] not in allowed_roles:
            raise HTTPException(status_code=400, detail="Can only set Manager or Auditor roles")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.users.update_one(
        {"user_id": user_id, "company_id": company_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    
    await log_activity(
        db=db,
        action_type="COMPANY_USER_UPDATED",
        entity_type="user",
        entity_id=user_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return User(**user_doc)

@company_router.delete("/users/{user_id}")
async def delete_company_user(
    user_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    user = await db.users.find_one({"user_id": user_id, "company_id": company_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Soft delete
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"status": "DELETED", "updated_at": get_current_timestamp()}}
    )
    
    await log_activity(
        db=db,
        action_type="COMPANY_USER_DELETED",
        entity_type="user",
        entity_id=user_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"user_name": user.get("name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "User deleted successfully"}

# ============ ACTIVITY LOGS ============
@company_router.get("/activity-logs", response_model=List[ActivityLog])
async def get_activity_logs(
    current_user: dict = Depends(get_current_user),
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 200
):
    company_id = require_company_access(current_user)
    
    query = {"company_id": company_id}
    if action_type:
        query["action_type"] = action_type
    if entity_type:
        query["entity_type"] = entity_type
    
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [ActivityLog(**log) for log in logs]

# ============ COMPANY SETTINGS ============
@company_router.get("/settings", response_model=CompanySettings)
async def get_company_settings(current_user: dict = Depends(get_current_user)):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    settings = await db.company_settings.find_one({"company_id": company_id}, {"_id": 0})
    
    if not settings:
        # Create default settings
        now = get_current_timestamp()
        default_settings = CompanySettings(
            settings_id=generate_id("settings_"),
            company_id=company_id,
            timezone="America/Port-au-Prince",
            currency="HTG",
            stop_sales_before_draw_minutes=5,
            allow_ticket_void=True,
            max_ticket_amount=10000.0,
            min_ticket_amount=10.0,
            auto_print_ticket=True,
            updated_at=now
        )
        await db.company_settings.insert_one(default_settings.model_dump())
        return default_settings
    
    return CompanySettings(**settings)

@company_router.put("/settings", response_model=CompanySettings)
async def update_company_settings(
    updates: CompanySettingsUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    update_data["updated_by"] = current_user["user_id"]
    
    # Upsert settings
    await db.company_settings.update_one(
        {"company_id": company_id},
        {"$set": update_data, "$setOnInsert": {"settings_id": generate_id("settings_"), "company_id": company_id}},
        upsert=True
    )
    
    settings = await db.company_settings.find_one({"company_id": company_id}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="COMPANY_SETTINGS_UPDATED",
        entity_type="settings",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return CompanySettings(**settings)
