from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from models import (
    UserRole, User, UserCreate, Agent, AgentCreate, AgentUpdate, AgentStatus,
    POSDevice, POSDeviceCreate, POSDeviceUpdate,
    Ticket, ActivityLog,
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


# ============================================================================
# COMPANY PROFILE / SETTINGS
# ============================================================================

class CompanyProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    company_address: Optional[str] = None
    logo_url: Optional[str] = None
    ticket_header_text: Optional[str] = None
    ticket_footer_text: Optional[str] = None
    ticket_legal_text: Optional[str] = None
    ticket_thank_you_text: Optional[str] = None
    qr_code_enabled: Optional[bool] = True
    min_bet_amount: Optional[float] = 1.0
    max_bet_amount: Optional[float] = 999999.0


@company_router.get("/profile")
async def get_company_profile(current_user: dict = Depends(get_current_user)):
    """Get company profile and settings for ticket customization.
    
    Accessible to:
    - Company Admin, Manager, Auditor: Full access
    - Agents (AGENT_POS), Supervisors: Read-only basic info
    """
    company_id = current_user.get("company_id")
    
    if not company_id:
        raise HTTPException(status_code=403, detail="No company access")
    
    company = await db.companies.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    if not company:
        raise HTTPException(status_code=404, detail="Compagnie non trouvée")
    
    return {
        "company_id": company_id,
        "company_name": company.get("name", ""),
        "company_phone": company.get("phone", ""),
        "company_email": company.get("email", ""),
        "company_address": company.get("address", ""),
        "company_logo_url": company.get("logo_url", ""),
        "display_logo_url": company.get("logo_url", ""),
        "ticket_header_text": company.get("ticket_header_text", ""),
        "ticket_footer_text": company.get("ticket_footer_text", ""),
        "ticket_legal_text": company.get("ticket_legal_text", ""),
        "ticket_thank_you_text": company.get("ticket_thank_you_text", ""),
        "qr_code_enabled": company.get("qr_code_enabled", True),
        "min_bet_amount": company.get("min_bet_amount", 1.0),
        "max_bet_amount": company.get("max_bet_amount", 999999.0),
        "currency": company.get("currency", "HTG"),
        "timezone": company.get("timezone", "America/Port-au-Prince")
    }


@company_router.put("/profile")
async def update_company_profile(
    data: CompanyProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update company profile and ticket settings"""
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    update_data = {"updated_at": get_current_timestamp()}
    
    if data.company_name is not None:
        update_data["name"] = data.company_name
    if data.company_phone is not None:
        update_data["phone"] = data.company_phone
    if data.company_email is not None:
        update_data["email"] = data.company_email
    if data.company_address is not None:
        update_data["address"] = data.company_address
    if data.logo_url is not None:
        update_data["logo_url"] = data.logo_url
    if data.ticket_header_text is not None:
        update_data["ticket_header_text"] = data.ticket_header_text
    if data.ticket_footer_text is not None:
        update_data["ticket_footer_text"] = data.ticket_footer_text
    if data.ticket_legal_text is not None:
        update_data["ticket_legal_text"] = data.ticket_legal_text
    if data.ticket_thank_you_text is not None:
        update_data["ticket_thank_you_text"] = data.ticket_thank_you_text
    if data.min_bet_amount is not None:
        update_data["min_bet_amount"] = data.min_bet_amount
    if data.max_bet_amount is not None:
        update_data["max_bet_amount"] = data.max_bet_amount
    if data.qr_code_enabled is not None:
        update_data["qr_code_enabled"] = data.qr_code_enabled
    
    result = await db.companies.update_one(
        {"company_id": company_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Compagnie non trouvée")
    
    return {
        "message": "Profil mis à jour avec succès",
        "updated_fields": list(update_data.keys())
    }


@company_router.post("/upload-logo")
async def upload_company_logo(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Upload company logo - accepts base64 encoded image"""
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    try:
        body = await request.json()
        logo_data = body.get("logo_data")  # Base64 encoded image
        
        if not logo_data:
            raise HTTPException(status_code=400, detail="logo_data requis")
        
        # Store the base64 logo directly (for small logos)
        # Or you can upload to a storage service and store the URL
        
        await db.companies.update_one(
            {"company_id": company_id},
            {"$set": {
                "logo_url": logo_data,
                "updated_at": get_current_timestamp()
            }}
        )
        
        return {"message": "Logo téléchargé avec succès", "logo_url": logo_data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@company_router.delete("/delete-logo")
async def delete_company_logo(current_user: dict = Depends(get_current_user)):
    """Delete company logo"""
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN])
    
    await db.companies.update_one(
        {"company_id": company_id},
        {"$set": {
            "logo_url": None,
            "updated_at": get_current_timestamp()
        }}
    )
    
    return {"message": "Logo supprimé"}

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

@company_router.get("/agents/{agent_id}", response_model=Agent)
async def get_agent_detail(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Get single agent by agent_id"""
    company_id = require_company_access(current_user)
    
    agent_doc = await db.agents.find_one({"agent_id": agent_id, "company_id": company_id}, {"_id": 0})
    if not agent_doc:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return Agent(**agent_doc)

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


# ============ LOTTERIES (READ FROM GLOBAL with Company Customization) ============
@company_router.get("/lotteries")
async def get_company_lotteries(current_user: dict = Depends(get_current_user)):
    """
    Get lotteries for this company.
    Returns master_lotteries filtered by is_active_global=True,
    with company-specific customizations from company_lotteries.
    """
    require_company_access(current_user)
    company_id = current_user["company_id"]
    
    # Get all globally active lotteries
    master_lotteries = await db.master_lotteries.find(
        {"is_active_global": True},
        {"_id": 0}
    ).to_list(500)
    
    # Get company customizations
    company_customizations = await db.company_lotteries.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(500)
    
    customization_map = {cl["lottery_id"]: cl for cl in company_customizations}
    
    result = []
    for lottery in master_lotteries:
        lottery_id = lottery.get("lottery_id")
        custom = customization_map.get(lottery_id, {})
        
        result.append({
            **lottery,
            "is_enabled": custom.get("is_enabled", False),
            "flag_type": custom.get("flag_type") or lottery.get("flag_type", "USA"),
            "max_bet_per_ticket": custom.get("max_bet_per_ticket", 10000),
            "max_bet_per_number": custom.get("max_bet_per_number", 5000),
            "disabled_by_super_admin": custom.get("disabled_by_super_admin", False),
            "can_enable": lottery.get("is_active_global", False) and not custom.get("disabled_by_super_admin", False)
        })
    
    return result


# ============ SCHEDULES (READ-ONLY - Global schedules managed by Super Admin) ============
@company_router.get("/schedules")
async def get_schedules(current_user: dict = Depends(get_current_user)):
    """View schedules - READ ONLY. Schedules are managed globally by Super Admin."""
    require_company_access(current_user)
    
    # Get global schedules
    global_schedules = await db.global_schedules.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    # Enrich with lottery info
    for schedule in global_schedules:
        lottery = await db.global_lotteries.find_one({"lottery_id": schedule["lottery_id"]}, {"_id": 0})
        if lottery:
            schedule["lottery_name"] = lottery.get("lottery_name")
            schedule["state_code"] = lottery.get("state_code")
    
    return global_schedules

# NOTE: POST, PUT, DELETE for schedules have been REMOVED
# Schedules are now managed globally by Super Admin only

# ============ TICKETS ============
@company_router.get("/tickets")
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
    
    # Use lottery_transactions collection (where vendeur tickets are stored)
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return tickets

@company_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    company_id = require_company_access(current_user)
    
    # Use lottery_transactions collection (where vendeur tickets are stored)
    ticket = await db.lottery_transactions.find_one({"ticket_id": ticket_id, "company_id": company_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return ticket

# ============ RESULTS (READ-ONLY - Global results managed by Super Admin) ============
@company_router.get("/results")
async def get_results(
    current_user: dict = Depends(get_current_user),
    lottery_id: Optional[str] = None,
    draw_date: Optional[str] = None,
    limit: int = 200
):
    """View results - READ ONLY. Results are entered globally by Super Admin."""
    require_company_access(current_user)
    
    # Get global results
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    if draw_date:
        query["draw_date"] = draw_date
    
    results = await db.global_results.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return results

# NOTE: POST, PUT, DELETE for results have been REMOVED
# Results are now entered globally by Super Admin only

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
            min_ticket_amount=1.0,
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


# ============== FICHES JOUEES ENDPOINT ==============

@company_router.get("/admin/fiches-jouees")
async def get_fiches_jouees(
    period: str = "today",
    status: str = "all",
    current_user: dict = Depends(get_current_user)
):
    """Get all played tickets (fiches jouées) for admins/supervisors"""
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.BRANCH_SUPERVISOR])
    
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    
    # Date filter
    date_filter = {}
    if period == "today":
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        date_filter = {"created_at": {"$gte": start_of_day.isoformat()}}
    elif period == "week":
        start_of_week = now - timedelta(days=7)
        date_filter = {"created_at": {"$gte": start_of_week.isoformat()}}
    elif period == "month":
        start_of_month = now - timedelta(days=30)
        date_filter = {"created_at": {"$gte": start_of_month.isoformat()}}
    
    # Status filter
    status_filter = {}
    if status == "active":
        status_filter = {"deleted": {"$ne": True}, "status": {"$nin": ["VOID", "CANCELLED"]}}
    elif status == "deleted":
        status_filter = {"$or": [{"deleted": True}, {"status": {"$in": ["VOID", "CANCELLED"]}}]}
    elif status == "winner":
        status_filter = {"status": {"$in": ["WINNER", "WON", "PAID"]}}
    
    # Combine filters
    query = {"company_id": company_id, **date_filter, **status_filter}
    
    # Fetch from lottery_transactions
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    
    # Calculate stats
    all_query = {"company_id": company_id, **date_filter}
    all_tickets = await db.lottery_transactions.find(all_query, {"_id": 0, "status": 1, "deleted": 1}).to_list(1000)
    stats = {
        "total": len(all_tickets),
        "active": len([t for t in all_tickets if not t.get("deleted") and t.get("status") not in ["VOID", "CANCELLED"]]),
        "deleted": len([t for t in all_tickets if t.get("deleted") or t.get("status") in ["VOID", "CANCELLED"]]),
        "winners": len([t for t in all_tickets if t.get("status") in ["WINNER", "WON", "PAID"]])
    }
    
    return {"tickets": tickets, "stats": stats}

@company_router.get("/admin/fiches-jouees/search")
async def search_fiche_jouee(
    code: str,
    current_user: dict = Depends(get_current_user)
):
    """Search for a specific ticket by code"""
    company_id = require_company_access(current_user, [UserRole.COMPANY_ADMIN, UserRole.BRANCH_SUPERVISOR])
    
    ticket = await db.lottery_transactions.find_one({
        "company_id": company_id,
        "$or": [
            {"ticket_code": code},
            {"ticket_code": {"$regex": code, "$options": "i"}},
            {"ticket_id": {"$regex": code, "$options": "i"}}
        ]
    }, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    return ticket

