"""
Company Admin Full CRUD Routes
Complete management of Agents, POS Devices, Tickets, Reports, Activity Logs
Real-time sync configuration management
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, EmailStr

from models import (
    UserRole, AgentStatus, TicketStatus,
    Agent, AgentCreate, AgentUpdate, AgentCreateFull, AgentProfile, AgentProfileUpdate,
    POSDevice, POSDeviceCreate, POSDeviceUpdate, POSDeviceEnhanced, POSDeviceCreateEnhanced, POSDeviceUpdateEnhanced,
    AgentPolicy, AgentPolicyCreate, AgentPolicyUpdate,
    CompanyLotteryCatalog, CompanyLotteryCatalogCreate, CompanyLotteryCatalogUpdate,
    CompanyPosRules, CompanyPosRulesUpdate,
    BlockedNumber, BlockedNumberCreate, BlockedNumberUpdate,
    SalesLimit, SalesLimitCreate, SalesLimitUpdate,
    DeviceConfigResponse, DeviceSyncResponse, CompanyConfigVersion,
    TicketEnhanced, LotteryTransaction
)
from auth import decode_token, get_password_hash
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

company_admin_router = APIRouter(prefix="/api/company", tags=["Company Admin"])
security = HTTPBearer()

db = None

def set_company_admin_db(database):
    global db
    db = database


async def get_company_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Auth dependency for company admin routes"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    allowed_roles = [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.AUDITOR_READONLY]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs d'entreprise")
    
    if not user.get("company_id"):
        raise HTTPException(status_code=403, detail="Aucune entreprise associée")
    
    return user


def require_admin(user: dict):
    """Only COMPANY_ADMIN can perform admin actions"""
    if user.get("role") != UserRole.COMPANY_ADMIN:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return user["company_id"]


async def increment_config_version(company_id: str, change_type: str, user_id: str):
    """Increment company config version for sync tracking"""
    now = get_current_timestamp()
    
    result = await db.company_config_versions.find_one_and_update(
        {"company_id": company_id},
        {
            "$inc": {"version": 1},
            "$set": {
                "last_updated_at": now,
                "last_updated_by": user_id,
                "change_type": change_type
            },
            "$setOnInsert": {"company_id": company_id}
        },
        upsert=True,
        return_document=True
    )
    
    return result.get("version", 1) if result else 1


# ============================================================================
# AGENT MANAGEMENT - FULL CRUD
# ============================================================================

class AgentCreateRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    branch_id: Optional[str] = None
    zone: Optional[str] = None
    address: Optional[str] = None
    commission_percent: float = 0.0
    supervisor_percent: float = 0.0
    credit_limit: float = 50000.0
    win_limit: float = 100000.0
    allowed_device_types: List[str] = ["POS", "COMPUTER", "PHONE", "TABLET"]
    must_use_imei: bool = False
    can_void_ticket: bool = True
    can_reprint_ticket: bool = True
    status: str = "ACTIVE"


class AgentUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    branch_id: Optional[str] = None
    zone: Optional[str] = None
    address: Optional[str] = None
    commission_percent: Optional[float] = None
    supervisor_percent: Optional[float] = None
    credit_limit: Optional[float] = None
    win_limit: Optional[float] = None
    allowed_device_types: Optional[List[str]] = None
    must_use_imei: Optional[bool] = None
    can_void_ticket: Optional[bool] = None
    can_reprint_ticket: Optional[bool] = None
    status: Optional[str] = None


@company_admin_router.get("/agents")
async def get_all_agents(
    current_user: dict = Depends(get_company_admin),
    status: Optional[str] = None,
    branch_id: Optional[str] = None
):
    """Get all agents with full profile data"""
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id, "role": UserRole.AGENT_POS}
    if status:
        query["status"] = status
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    
    agents = []
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    for user in users:
        agent_id = user["user_id"]
        
        # Get agent policy
        policy = await db.agent_policies.find_one({"agent_id": agent_id}, {"_id": 0})
        
        # Get assigned POS devices
        pos_devices = await db.pos_devices.find(
            {"assigned_agent_id": agent_id}, {"_id": 0}
        ).to_list(20)
        
        # Get today's stats
        pipeline = [
            {"$match": {"agent_id": agent_id, "created_at": {"$gte": today_start}}},
            {"$group": {
                "_id": None,
                "total_tickets": {"$sum": 1},
                "total_sales": {"$sum": "$total_amount"}
            }}
        ]
        stats = await db.lottery_transactions.aggregate(pipeline).to_list(1)
        
        # Get branch name
        branch_name = None
        if policy and policy.get("branch_id"):
            branch = await db.branches.find_one({"branch_id": policy["branch_id"]}, {"_id": 0})
            branch_name = branch.get("name") if branch else None
        
        agent_profile = {
            "agent_id": agent_id,
            "user_id": agent_id,
            "company_id": company_id,
            "first_name": policy.get("first_name", user.get("name", "").split()[0] if user.get("name") else ""),
            "last_name": policy.get("last_name", " ".join(user.get("name", "").split()[1:]) if user.get("name") else ""),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "phone": policy.get("phone") if policy else None,
            "branch_id": policy.get("branch_id") if policy else None,
            "branch_name": branch_name,
            "zone": policy.get("zone") if policy else None,
            "address": policy.get("address") if policy else None,
            "commission_percent": policy.get("commission_percent", 0.0) if policy else 0.0,
            "supervisor_percent": policy.get("supervisor_percent", 0.0) if policy else 0.0,
            "credit_limit": policy.get("max_credit_limit", 50000.0) if policy else 50000.0,
            "win_limit": policy.get("max_win_limit", 100000.0) if policy else 100000.0,
            "allowed_device_types": policy.get("allowed_device_types", ["POS", "COMPUTER", "PHONE", "TABLET"]) if policy else ["POS", "COMPUTER", "PHONE", "TABLET"],
            "must_use_imei": policy.get("must_use_imei", False) if policy else False,
            "can_void_ticket": policy.get("can_void_ticket", True) if policy else True,
            "can_reprint_ticket": policy.get("can_reprint_ticket", True) if policy else True,
            "status": user.get("status", "ACTIVE"),
            "pos_devices": pos_devices,
            "total_sales_today": stats[0]["total_sales"] if stats else 0.0,
            "total_tickets_today": stats[0]["total_tickets"] if stats else 0,
            "created_at": user.get("created_at", ""),
            "updated_at": user.get("updated_at", ""),
            "last_login": user.get("last_login")
        }
        
        # Apply branch filter if requested
        if branch_id and agent_profile.get("branch_id") != branch_id:
            continue
            
        agents.append(agent_profile)
    
    return agents


@company_admin_router.get("/agents/{agent_id}")
async def get_agent_detail(agent_id: str, current_user: dict = Depends(get_company_admin)):
    """Get single agent with full profile"""
    company_id = current_user["company_id"]
    
    user = await db.users.find_one(
        {"user_id": agent_id, "company_id": company_id, "role": UserRole.AGENT_POS},
        {"_id": 0, "password_hash": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Agent non trouvé")
    
    # Get policy
    policy = await db.agent_policies.find_one({"agent_id": agent_id}, {"_id": 0})
    
    # Get POS devices
    pos_devices = await db.pos_devices.find(
        {"assigned_agent_id": agent_id}, {"_id": 0}
    ).to_list(20)
    
    # Get branch name
    branch_name = None
    if policy and policy.get("branch_id"):
        branch = await db.branches.find_one({"branch_id": policy["branch_id"]}, {"_id": 0})
        branch_name = branch.get("name") if branch else None
    
    # Today's stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    pipeline = [
        {"$match": {"agent_id": agent_id, "created_at": {"$gte": today_start}}},
        {"$group": {
            "_id": None,
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"}
        }}
    ]
    stats = await db.lottery_transactions.aggregate(pipeline).to_list(1)
    
    # Enabled lotteries count
    enabled_count = await db.company_lotteries.count_documents({
        "company_id": company_id, "enabled": True
    })
    
    return {
        "agent_id": agent_id,
        "user_id": agent_id,
        "company_id": company_id,
        "first_name": policy.get("first_name", "") if policy else "",
        "last_name": policy.get("last_name", "") if policy else "",
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "phone": policy.get("phone") if policy else None,
        "branch_id": policy.get("branch_id") if policy else None,
        "branch_name": branch_name,
        "zone": policy.get("zone") if policy else None,
        "address": policy.get("address") if policy else None,
        "commission_percent": policy.get("commission_percent", 0.0) if policy else 0.0,
        "supervisor_percent": policy.get("supervisor_percent", 0.0) if policy else 0.0,
        "credit_limit": policy.get("max_credit_limit", 50000.0) if policy else 50000.0,
        "win_limit": policy.get("max_win_limit", 100000.0) if policy else 100000.0,
        "allowed_device_types": policy.get("allowed_device_types", ["POS", "COMPUTER", "PHONE", "TABLET"]) if policy else ["POS", "COMPUTER", "PHONE", "TABLET"],
        "must_use_imei": policy.get("must_use_imei", False) if policy else False,
        "can_void_ticket": policy.get("can_void_ticket", True) if policy else True,
        "can_reprint_ticket": policy.get("can_reprint_ticket", True) if policy else True,
        "status": user.get("status", "ACTIVE"),
        "pos_devices": pos_devices,
        "enabled_lotteries_count": enabled_count,
        "total_sales_today": stats[0]["total_sales"] if stats else 0.0,
        "total_tickets_today": stats[0]["total_tickets"] if stats else 0,
        "created_at": user.get("created_at", ""),
        "updated_at": user.get("updated_at", ""),
        "last_login": user.get("last_login")
    }


@company_admin_router.post("/agents")
async def create_agent(
    agent_data: AgentCreateRequest,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Create new agent with full profile"""
    company_id = require_admin(current_user)
    
    # Check email uniqueness
    existing = await db.users.find_one({"email": agent_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email existe déjà")
    
    now = get_current_timestamp()
    user_id = generate_id("user_")
    
    full_name = f"{agent_data.first_name} {agent_data.last_name}"
    
    # Create user record
    user_doc = {
        "user_id": user_id,
        "email": agent_data.email,
        "password_hash": get_password_hash(agent_data.password),
        "name": full_name,
        "role": UserRole.AGENT_POS,
        "company_id": company_id,
        "status": agent_data.status,
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(user_doc)
    
    # Create agent policy
    policy_id = generate_id("policy_")
    policy_doc = {
        "id": policy_id,
        "company_id": company_id,
        "agent_id": user_id,
        "first_name": agent_data.first_name,
        "last_name": agent_data.last_name,
        "phone": agent_data.phone,
        "branch_id": agent_data.branch_id,
        "zone": agent_data.zone,
        "address": agent_data.address,
        "allowed_device_types": agent_data.allowed_device_types,
        "must_use_imei": agent_data.must_use_imei,
        "max_credit_limit": agent_data.credit_limit,
        "max_win_limit": agent_data.win_limit,
        "commission_percent": agent_data.commission_percent,
        "supervisor_percent": agent_data.supervisor_percent,
        "can_void_ticket": agent_data.can_void_ticket,
        "can_reprint_ticket": agent_data.can_reprint_ticket,
        "status": "active",
        "created_at": now,
        "updated_at": now
    }
    await db.agent_policies.insert_one(policy_doc)
    
    # Increment config version
    await increment_config_version(company_id, "AGENT_CREATED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type="AGENT_CREATED",
        entity_type="agent",
        entity_id=user_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"agent_name": full_name, "email": agent_data.email},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Agent créé avec succès", "agent_id": user_id}


@company_admin_router.post("/agents/full-create")
async def create_agent_full(
    data: dict,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """
    Create agent with:
    - User account
    - Agent policy with permissions
    - POS device (if IMEI provided)
    - Agent balance record
    """
    company_id = require_admin(current_user)
    
    # Validate required fields
    if not data.get("name") and not (data.get("first_name") and data.get("last_name")):
        raise HTTPException(status_code=400, detail="Le nom est requis")
    if not data.get("email"):
        raise HTTPException(status_code=400, detail="L'email est requis")
    if not data.get("password"):
        raise HTTPException(status_code=400, detail="Le mot de passe est requis")
    
    # Check email uniqueness
    existing = await db.users.find_one({"email": data["email"]})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email existe déjà")
    
    now = get_current_timestamp()
    user_id = generate_id("user_")
    
    full_name = data.get("name") or f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
    
    # 1. Create user record
    user_doc = {
        "user_id": user_id,
        "email": data["email"],
        "password_hash": get_password_hash(data["password"]),
        "name": full_name,
        "role": UserRole.AGENT_POS,
        "company_id": company_id,
        "status": data.get("status", "ACTIVE"),
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(user_doc)
    
    # 2. Create agent policy with permissions
    policy_id = generate_id("policy_")
    policy_doc = {
        "id": policy_id,
        "company_id": company_id,
        "agent_id": user_id,
        "first_name": data.get("first_name", full_name.split()[0] if full_name else ""),
        "last_name": data.get("last_name", " ".join(full_name.split()[1:]) if full_name else ""),
        "phone": data.get("phone"),
        "address": data.get("address"),
        "branch_id": data.get("branch_id"),
        "zone": data.get("zone"),
        "allowed_device_types": ["POS", "COMPUTER", "PHONE", "TABLET"],
        "must_use_imei": bool(data.get("imei")),
        "max_credit_limit": data.get("credit_limit", 50000.0),
        "max_win_limit": data.get("winning_limit", 100000.0),
        "commission_percent": data.get("commission_percent", 5.0),
        "supervisor_percent": data.get("supervisor_percent", 0.0),
        "can_void_ticket": data.get("can_cancel_tickets", True),
        "can_pay_winners": data.get("can_pay_winners", True),
        "can_reprint_ticket": data.get("can_reprint_tickets", True),
        "status": "active",
        "created_at": now,
        "updated_at": now
    }
    await db.agent_policies.insert_one(policy_doc)
    
    # 3. Create agent balance record
    balance_id = generate_id("bal_")
    balance_doc = {
        "balance_id": balance_id,
        "agent_id": user_id,
        "company_id": company_id,
        "credit_limit": data.get("credit_limit", 50000.0),
        "current_balance": 0.0,
        "available_balance": data.get("credit_limit", 50000.0),
        "total_sales": 0.0,
        "total_payouts": 0.0,
        "total_winnings": 0.0,
        "created_at": now,
        "updated_at": now
    }
    await db.agent_balances.insert_one(balance_doc)
    
    # 4. Create POS device if IMEI provided
    device_id = None
    if data.get("imei"):
        device_id = generate_id("pos_")
        device_doc = {
            "device_id": device_id,
            "company_id": company_id,
            "assigned_agent_id": user_id,
            "imei": data["imei"],
            "device_name": data.get("device_name") or f"{full_name}'s Device",
            "device_type": data.get("device_type", "MOBILE"),
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        }
        await db.pos_devices.insert_one(device_doc)
    
    # Increment config version
    await increment_config_version(company_id, "AGENT_CREATED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type="AGENT_FULL_CREATED",
        entity_type="agent",
        entity_id=user_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "agent_name": full_name,
            "email": data["email"],
            "device_id": device_id,
            "credit_limit": data.get("credit_limit", 50000.0)
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": "Agent créé avec succès avec permissions et solde",
        "agent_id": user_id,
        "balance_id": balance_id,
        "device_id": device_id,
        "email": data["email"],
        "name": full_name
    }


@company_admin_router.put("/agents/{agent_id}")
async def update_agent(
    agent_id: str,
    updates: AgentUpdateRequest,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Update agent profile"""
    company_id = require_admin(current_user)
    
    # Verify agent exists
    user = await db.users.find_one({
        "user_id": agent_id, "company_id": company_id, "role": UserRole.AGENT_POS
    })
    if not user:
        raise HTTPException(status_code=404, detail="Agent non trouvé")
    
    now = get_current_timestamp()
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
    
    # Update user record
    user_updates = {"updated_at": now}
    if "first_name" in update_data or "last_name" in update_data:
        first = update_data.get("first_name", user.get("name", "").split()[0])
        last = update_data.get("last_name", " ".join(user.get("name", "").split()[1:]))
        user_updates["name"] = f"{first} {last}"
    if "email" in update_data:
        # Check email uniqueness
        existing = await db.users.find_one({"email": update_data["email"], "user_id": {"$ne": agent_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Cet email existe déjà")
        user_updates["email"] = update_data["email"]
    if "status" in update_data:
        user_updates["status"] = update_data["status"]
    
    await db.users.update_one({"user_id": agent_id}, {"$set": user_updates})
    
    # Update policy
    policy_updates = {"updated_at": now}
    policy_fields = [
        "first_name", "last_name", "phone", "branch_id", "zone", "address",
        "allowed_device_types", "must_use_imei", "can_void_ticket", "can_reprint_ticket"
    ]
    for field in policy_fields:
        if field in update_data:
            policy_updates[field] = update_data[field]
    
    if "credit_limit" in update_data:
        policy_updates["max_credit_limit"] = update_data["credit_limit"]
    if "win_limit" in update_data:
        policy_updates["max_win_limit"] = update_data["win_limit"]
    if "commission_percent" in update_data:
        policy_updates["commission_percent"] = update_data["commission_percent"]
    if "supervisor_percent" in update_data:
        policy_updates["supervisor_percent"] = update_data["supervisor_percent"]
    if "status" in update_data:
        policy_updates["status"] = "active" if update_data["status"] == "ACTIVE" else "suspended"
    
    await db.agent_policies.update_one(
        {"agent_id": agent_id},
        {"$set": policy_updates},
        upsert=True
    )
    
    # Increment config version
    await increment_config_version(company_id, "AGENT_UPDATED", current_user["user_id"])
    
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
    
    return {"message": "Agent mis à jour avec succès"}


@company_admin_router.put("/agents/{agent_id}/status")
async def update_agent_status(
    agent_id: str,
    status: str,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Activate or suspend an agent"""
    company_id = require_admin(current_user)
    
    if status not in ["ACTIVE", "SUSPENDED"]:
        raise HTTPException(status_code=400, detail="Statut invalide. Utilisez ACTIVE ou SUSPENDED")
    
    result = await db.users.update_one(
        {"user_id": agent_id, "company_id": company_id, "role": UserRole.AGENT_POS},
        {"$set": {"status": status, "updated_at": get_current_timestamp()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent non trouvé")
    
    # Update policy status
    await db.agent_policies.update_one(
        {"agent_id": agent_id},
        {"$set": {"status": "active" if status == "ACTIVE" else "suspended"}}
    )
    
    # Increment config version
    await increment_config_version(company_id, "AGENT_STATUS_CHANGED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type=f"AGENT_{status}",
        entity_type="agent",
        entity_id=agent_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Agent {'activé' if status == 'ACTIVE' else 'suspendu'}"}


@company_admin_router.delete("/agents/{agent_id}")
async def delete_agent(
    agent_id: str,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Soft delete an agent (set status to SUSPENDED)"""
    company_id = require_admin(current_user)
    
    result = await db.users.update_one(
        {"user_id": agent_id, "company_id": company_id, "role": UserRole.AGENT_POS},
        {"$set": {"status": "SUSPENDED", "updated_at": get_current_timestamp()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent non trouvé")
    
    await db.agent_policies.update_one(
        {"agent_id": agent_id},
        {"$set": {"status": "suspended"}}
    )
    
    await increment_config_version(company_id, "AGENT_DELETED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type="AGENT_DELETED",
        entity_type="agent",
        entity_id=agent_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Agent supprimé"}


# ============================================================================
# POS DEVICE MANAGEMENT - FULL CRUD
# ============================================================================

@company_admin_router.get("/pos-devices")
async def get_all_pos_devices(
    current_user: dict = Depends(get_company_admin),
    status: Optional[str] = None,
    branch_id: Optional[str] = None
):
    """Get all POS devices with enriched data"""
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id}
    if status:
        query["status"] = status
    if branch_id:
        query["branch_id"] = branch_id
    
    devices = await db.pos_devices.find(query, {"_id": 0}).to_list(500)
    
    # Enrich with agent and branch names
    for device in devices:
        if device.get("assigned_agent_id"):
            agent = await db.users.find_one(
                {"user_id": device["assigned_agent_id"]},
                {"_id": 0, "name": 1}
            )
            device["assigned_agent_name"] = agent.get("name") if agent else None
        
        if device.get("branch_id"):
            branch = await db.branches.find_one(
                {"branch_id": device["branch_id"]},
                {"_id": 0, "name": 1}
            )
            device["branch_name"] = branch.get("name") if branch else None
    
    return devices


@company_admin_router.get("/pos-devices/{device_id}")
async def get_pos_device_detail(
    device_id: str,
    current_user: dict = Depends(get_company_admin)
):
    """Get single POS device with full details"""
    company_id = current_user["company_id"]
    
    device = await db.pos_devices.find_one(
        {"device_id": device_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not device:
        raise HTTPException(status_code=404, detail="Appareil non trouvé")
    
    # Enrich
    if device.get("assigned_agent_id"):
        agent = await db.users.find_one(
            {"user_id": device["assigned_agent_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        device["assigned_agent_name"] = agent.get("name") if agent else None
        device["assigned_agent_email"] = agent.get("email") if agent else None
    
    if device.get("branch_id"):
        branch = await db.branches.find_one(
            {"branch_id": device["branch_id"]},
            {"_id": 0, "name": 1}
        )
        device["branch_name"] = branch.get("name") if branch else None
    
    # Get recent sessions
    sessions = await db.device_sessions.find(
        {"pos_device_id": device_id},
        {"_id": 0}
    ).sort("last_seen_at", -1).limit(10).to_list(10)
    device["recent_sessions"] = sessions
    
    return device


@company_admin_router.post("/pos-devices")
async def create_pos_device(
    device_data: POSDeviceCreateEnhanced,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Register a new POS device"""
    company_id = require_admin(current_user)
    
    # Check IMEI uniqueness
    existing = await db.pos_devices.find_one({"imei": device_data.imei})
    if existing:
        raise HTTPException(status_code=400, detail="Cet IMEI est déjà enregistré")
    
    now = get_current_timestamp()
    device_id = generate_id("pos_")
    
    device_doc = {
        "device_id": device_id,
        "company_id": company_id,
        "imei": device_data.imei,
        "device_name": device_data.device_name,
        "branch_id": device_data.branch_id,
        "location": device_data.location,
        "assigned_agent_id": device_data.assigned_agent_id,
        "assigned_vendor_id": device_data.assigned_vendor_id,
        "notes": device_data.notes,
        "status": "PENDING",
        "created_at": now,
        "updated_at": now
    }
    
    await db.pos_devices.insert_one(device_doc)
    
    await increment_config_version(company_id, "POS_DEVICE_CREATED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type="POS_DEVICE_CREATED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"imei": device_data.imei, "device_name": device_data.device_name},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Appareil POS enregistré", "device_id": device_id}


@company_admin_router.put("/pos-devices/{device_id}")
async def update_pos_device(
    device_id: str,
    updates: POSDeviceUpdateEnhanced,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Update POS device"""
    company_id = require_admin(current_user)
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.pos_devices.update_one(
        {"device_id": device_id, "company_id": company_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appareil non trouvé")
    
    await increment_config_version(company_id, "POS_DEVICE_UPDATED", current_user["user_id"])
    
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
    
    return {"message": "Appareil mis à jour"}


@company_admin_router.put("/pos-devices/{device_id}/status")
async def update_pos_device_status(
    device_id: str,
    status: str,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Update POS device status (ACTIVE, BLOCKED, PENDING)"""
    company_id = require_admin(current_user)
    
    if status not in ["ACTIVE", "BLOCKED", "PENDING"]:
        raise HTTPException(status_code=400, detail="Statut invalide")
    
    result = await db.pos_devices.update_one(
        {"device_id": device_id, "company_id": company_id},
        {"$set": {"status": status, "updated_at": get_current_timestamp()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appareil non trouvé")
    
    await increment_config_version(company_id, "POS_DEVICE_STATUS_CHANGED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type=f"POS_DEVICE_{status}",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Statut de l'appareil: {status}"}


@company_admin_router.put("/pos-devices/{device_id}/assign-agent")
async def assign_agent_to_device(
    device_id: str,
    agent_id: Optional[str],
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Assign or remove agent from POS device"""
    company_id = require_admin(current_user)
    
    # Verify agent if provided
    if agent_id:
        agent = await db.users.find_one({
            "user_id": agent_id, "company_id": company_id, "role": UserRole.AGENT_POS
        })
        if not agent:
            raise HTTPException(status_code=404, detail="Agent non trouvé")
    
    result = await db.pos_devices.update_one(
        {"device_id": device_id, "company_id": company_id},
        {"$set": {"assigned_agent_id": agent_id, "updated_at": get_current_timestamp()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appareil non trouvé")
    
    await increment_config_version(company_id, "POS_AGENT_ASSIGNED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type="POS_AGENT_ASSIGNED" if agent_id else "POS_AGENT_REMOVED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"agent_id": agent_id},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Agent assigné" if agent_id else "Agent retiré"}


@company_admin_router.delete("/pos-devices/{device_id}")
async def delete_pos_device(
    device_id: str,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Delete POS device (soft delete - set BLOCKED)"""
    company_id = require_admin(current_user)
    
    result = await db.pos_devices.update_one(
        {"device_id": device_id, "company_id": company_id},
        {"$set": {"status": "BLOCKED", "updated_at": get_current_timestamp()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appareil non trouvé")
    
    await increment_config_version(company_id, "POS_DEVICE_DELETED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type="POS_DEVICE_DELETED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Appareil supprimé"}


# ============================================================================
# TICKETS - VIEW ALL COMPANY TICKETS
# ============================================================================

@company_admin_router.get("/tickets")
async def get_all_tickets(
    current_user: dict = Depends(get_company_admin),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    agent_id: Optional[str] = None,
    status: Optional[str] = None,
    lottery_id: Optional[str] = None,
    limit: int = Query(default=200, le=1000)
):
    """Get all company tickets with filters"""
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id}
    
    if date_from:
        query["created_at"] = {"$gte": f"{date_from}T00:00:00Z"}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = f"{date_to}T23:59:59Z"
        else:
            query["created_at"] = {"$lte": f"{date_to}T23:59:59Z"}
    
    if agent_id:
        query["agent_id"] = agent_id
    if status:
        query["status"] = status
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    tickets = await db.lottery_transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return tickets


@company_admin_router.get("/tickets/{ticket_id}")
async def get_ticket_detail(
    ticket_id: str,
    current_user: dict = Depends(get_company_admin)
):
    """Get single ticket with full details"""
    company_id = current_user["company_id"]
    
    ticket = await db.lottery_transactions.find_one(
        {"ticket_id": ticket_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    return ticket


@company_admin_router.get("/tickets/stats/summary")
async def get_tickets_summary(
    current_user: dict = Depends(get_company_admin),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get tickets summary statistics"""
    company_id = current_user["company_id"]
    
    now = datetime.now(timezone.utc)
    if not date_from:
        date_from = now.replace(hour=0, minute=0, second=0).isoformat()
    if not date_to:
        date_to = now.isoformat()
    
    pipeline = [
        {"$match": {
            "company_id": company_id,
            "created_at": {"$gte": date_from, "$lte": date_to}
        }},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$total_amount"}
        }}
    ]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(10)
    
    summary = {
        "total_tickets": 0,
        "total_sales": 0.0,
        "pending_result": 0,
        "winners": 0,
        "losers": 0,
        "voided": 0,
        "by_status": results
    }
    
    for r in results:
        summary["total_tickets"] += r["count"]
        summary["total_sales"] += r["total_amount"]
        if r["_id"] == "PENDING_RESULT":
            summary["pending_result"] = r["count"]
        elif r["_id"] == "WINNER":
            summary["winners"] = r["count"]
        elif r["_id"] == "LOSER":
            summary["losers"] = r["count"]
        elif r["_id"] == "VOID":
            summary["voided"] = r["count"]
    
    return summary


# ============================================================================
# ACTIVITY LOGS - FULL AUDIT TRAIL
# ============================================================================

@company_admin_router.get("/activity-logs")
async def get_activity_logs(
    current_user: dict = Depends(get_company_admin),
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    agent_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=500, le=2000)
):
    """Get all activity logs for the company"""
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id}
    
    if action_type:
        query["action_type"] = action_type
    if entity_type:
        query["entity_type"] = entity_type
    if agent_id:
        query["performed_by"] = agent_id
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    logs = await db.activity_logs.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return logs


# ============================================================================
# LOTTERY CATALOG - COMPANY LEVEL
# ============================================================================

@company_admin_router.get("/lottery-catalog")
async def get_lottery_catalog(current_user: dict = Depends(get_company_admin)):
    """Get all lotteries with company availability - synchronized with master_lotteries"""
    company_id = current_user["company_id"]
    
    # Get master lotteries (only globally active ones for company admin)
    master_lotteries = await db.master_lotteries.find(
        {"is_active_global": True}, {"_id": 0}
    ).to_list(500)
    
    # Get company lottery settings
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id}, {"_id": 0}
    ).to_list(500)
    
    enabled_map = {cl["lottery_id"]: cl for cl in company_lotteries}
    
    result = []
    for lottery in master_lotteries:
        lottery_id = lottery["lottery_id"]
        cl = enabled_map.get(lottery_id, {})
        
        # Check if disabled by super admin
        disabled_by_super_admin = cl.get("disabled_by_super_admin", False)
        
        result.append({
            **lottery,
            "enabled": cl.get("is_enabled", False) and not disabled_by_super_admin,
            "disabled_by_super_admin": disabled_by_super_admin,
            "can_toggle": not disabled_by_super_admin,  # Company can only toggle if not disabled by super admin
            "max_bet_per_ticket": cl.get("max_bet_per_ticket", 10000.0),
            "max_bet_per_number": cl.get("max_bet_per_number", 5000.0)
        })
    
    return result


@company_admin_router.put("/lottery-catalog/{lottery_id}/toggle")
async def toggle_lottery(
    lottery_id: str,
    enabled: bool,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Enable or disable a lottery for the company (respects super admin control)"""
    company_id = require_admin(current_user)
    
    # Verify lottery exists in master catalog
    lottery = await db.master_lotteries.find_one({"lottery_id": lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    # Check if globally active
    if not lottery.get("is_active_global"):
        raise HTTPException(status_code=400, detail="Cette loterie est désactivée globalement par Super Admin")
    
    # Check if disabled by super admin for this company
    cl = await db.company_lotteries.find_one(
        {"company_id": company_id, "lottery_id": lottery_id},
        {"_id": 0}
    )
    if cl and cl.get("disabled_by_super_admin") and enabled:
        raise HTTPException(status_code=400, detail="Cette loterie a été désactivée par Super Admin pour votre entreprise")
    
    now = get_current_timestamp()
    
    await db.company_lotteries.update_one(
        {"company_id": company_id, "lottery_id": lottery_id},
        {"$set": {
            "is_enabled_for_company": enabled,
            "is_enabled": enabled,  # Keep both for backward compatibility
            "lottery_name": lottery.get("lottery_name"),
            "state_code": lottery.get("state_code"),
            "updated_at": now
        },
        "$setOnInsert": {
            "id": generate_id("cla_"),
            "company_id": company_id,
            "lottery_id": lottery_id,
            "disabled_by_super_admin": False,
            "created_at": now
        }},
        upsert=True
    )
    
    # Increment config version - THIS IS CRITICAL FOR 5-SECOND SYNC
    await increment_config_version(company_id, "LOTTERY_TOGGLE", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type="LOTTERY_TOGGLED",
        entity_type="lottery",
        entity_id=lottery_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"lottery_name": lottery.get("lottery_name"), "enabled": enabled},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Loterie {'activée' if enabled else 'désactivée'}"}


# ============================================================================
# POS RULES - COMPANY LEVEL
# ============================================================================

@company_admin_router.get("/pos-rules")
async def get_pos_rules(current_user: dict = Depends(get_company_admin)):
    """Get company POS rules"""
    company_id = current_user["company_id"]
    
    rules = await db.company_pos_rules.find_one({"company_id": company_id}, {"_id": 0})
    
    if not rules:
        # Create defaults
        rules = {
            "id": generate_id("rules_"),
            "company_id": company_id,
            "block_numbers_enabled": True,
            "limits_enabled": True,
            "allow_void_ticket": True,
            "allow_reprint_ticket": True,
            "allow_manual_results_view": True,
            "ticket_format": "80MM_THERMAL",
            "config_version": 1,
            "created_at": get_current_timestamp(),
            "updated_at": get_current_timestamp()
        }
        await db.company_pos_rules.insert_one(rules)
    
    return rules


@company_admin_router.put("/pos-rules")
async def update_pos_rules(
    updates: CompanyPosRulesUpdate,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Update company POS rules"""
    company_id = require_admin(current_user)
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
    
    update_data["updated_at"] = get_current_timestamp()
    
    await db.company_pos_rules.update_one(
        {"company_id": company_id},
        {
            "$set": update_data,
            "$inc": {"config_version": 1}
        },
        upsert=True
    )
    
    await increment_config_version(company_id, "POS_RULES_UPDATED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type="POS_RULES_UPDATED",
        entity_type="pos_rules",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    rules = await db.company_pos_rules.find_one({"company_id": company_id}, {"_id": 0})
    return rules


# ============================================================================
# BLOCKED NUMBERS - REAL-TIME SYNC
# ============================================================================

@company_admin_router.get("/blocked-numbers")
async def get_blocked_numbers(
    current_user: dict = Depends(get_company_admin),
    lottery_id: Optional[str] = None
):
    """Get all blocked numbers"""
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id}
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    blocks = await db.blocked_numbers.find(query, {"_id": 0}).to_list(1000)
    return blocks


@company_admin_router.post("/blocked-numbers")
async def create_blocked_number(
    block_data: BlockedNumberCreate,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Block a number"""
    company_id = require_admin(current_user)
    
    block_id = generate_id("block_")
    now = get_current_timestamp()
    
    block_doc = {
        "block_id": block_id,
        "company_id": company_id,
        "lottery_id": block_data.lottery_id,
        "number": block_data.number,
        "block_type": block_data.block_type,
        "max_amount": block_data.max_amount,
        "reason": block_data.reason,
        "created_by": current_user["user_id"],
        "created_at": now,
        "expires_at": block_data.expires_at
    }
    
    await db.blocked_numbers.insert_one(block_doc)
    
    await increment_config_version(company_id, "NUMBER_BLOCKED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type="NUMBER_BLOCKED",
        entity_type="blocked_number",
        entity_id=block_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"number": block_data.number},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Numéro bloqué", "block_id": block_id}


@company_admin_router.delete("/blocked-numbers/{block_id}")
async def delete_blocked_number(
    block_id: str,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Unblock a number"""
    company_id = require_admin(current_user)
    
    block = await db.blocked_numbers.find_one(
        {"block_id": block_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not block:
        raise HTTPException(status_code=404, detail="Blocage non trouvé")
    
    await db.blocked_numbers.delete_one({"block_id": block_id})
    
    await increment_config_version(company_id, "NUMBER_UNBLOCKED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type="NUMBER_UNBLOCKED",
        entity_type="blocked_number",
        entity_id=block_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"number": block.get("number")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Numéro débloqué"}


# ============================================================================
# SALES LIMITS - REAL-TIME SYNC
# ============================================================================

@company_admin_router.get("/limits")
async def get_sales_limits(
    current_user: dict = Depends(get_company_admin),
    lottery_id: Optional[str] = None,
    agent_id: Optional[str] = None
):
    """Get all sales limits"""
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id}
    if lottery_id:
        query["lottery_id"] = lottery_id
    if agent_id:
        query["agent_id"] = agent_id
    
    limits = await db.sales_limits.find(query, {"_id": 0}).to_list(500)
    return limits


@company_admin_router.post("/limits")
async def create_sales_limit(
    limit_data: SalesLimitCreate,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Create a sales limit"""
    company_id = require_admin(current_user)
    
    limit_id = generate_id("limit_")
    now = get_current_timestamp()
    
    limit_doc = {
        "limit_id": limit_id,
        "company_id": company_id,
        "lottery_id": limit_data.lottery_id,
        "agent_id": limit_data.agent_id,
        "number": limit_data.number,
        "bet_type": limit_data.bet_type,
        "max_amount": limit_data.max_amount,
        "period": limit_data.period,
        "created_at": now,
        "updated_at": now
    }
    
    await db.sales_limits.insert_one(limit_doc)
    
    await increment_config_version(company_id, "LIMIT_CREATED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type="LIMIT_CREATED",
        entity_type="sales_limit",
        entity_id=limit_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"max_amount": limit_data.max_amount},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Limite créée", "limit_id": limit_id}


@company_admin_router.put("/limits/{limit_id}")
async def update_sales_limit(
    limit_id: str,
    updates: SalesLimitUpdate,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Update a sales limit"""
    company_id = require_admin(current_user)
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.sales_limits.update_one(
        {"limit_id": limit_id, "company_id": company_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Limite non trouvée")
    
    await increment_config_version(company_id, "LIMIT_UPDATED", current_user["user_id"])
    
    return {"message": "Limite mise à jour"}


@company_admin_router.delete("/limits/{limit_id}")
async def delete_sales_limit(
    limit_id: str,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Delete a sales limit"""
    company_id = require_admin(current_user)
    
    result = await db.sales_limits.delete_one(
        {"limit_id": limit_id, "company_id": company_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Limite non trouvée")
    
    await increment_config_version(company_id, "LIMIT_DELETED", current_user["user_id"])
    
    await log_activity(
        db=db,
        action_type="LIMIT_DELETED",
        entity_type="sales_limit",
        entity_id=limit_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Limite supprimée"}


# ============================================================================
# REPORTS
# ============================================================================

@company_admin_router.get("/reports/sales")
async def get_sales_report(
    current_user: dict = Depends(get_company_admin),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    group_by: str = Query(default="day", enum=["day", "agent", "lottery", "device_type"])
):
    """Generate sales report"""
    company_id = current_user["company_id"]
    
    now = datetime.now(timezone.utc)
    if not date_from:
        date_from = (now - timedelta(days=7)).isoformat()
    if not date_to:
        date_to = now.isoformat()
    
    match_stage = {
        "$match": {
            "company_id": company_id,
            "created_at": {"$gte": date_from, "$lte": date_to}
        }
    }
    
    if group_by == "day":
        group_stage = {
            "$group": {
                "_id": {"$substr": ["$created_at", 0, 10]},
                "tickets": {"$sum": 1},
                "sales": {"$sum": "$total_amount"},
                "voided": {"$sum": {"$cond": [{"$eq": ["$status", "VOID"]}, 1, 0]}}
            }
        }
    elif group_by == "agent":
        group_stage = {
            "$group": {
                "_id": "$agent_id",
                "agent_name": {"$first": "$agent_name"},
                "tickets": {"$sum": 1},
                "sales": {"$sum": "$total_amount"},
                "voided": {"$sum": {"$cond": [{"$eq": ["$status", "VOID"]}, 1, 0]}}
            }
        }
    elif group_by == "lottery":
        group_stage = {
            "$group": {
                "_id": "$lottery_id",
                "lottery_name": {"$first": "$lottery_name"},
                "tickets": {"$sum": 1},
                "sales": {"$sum": "$total_amount"},
                "voided": {"$sum": {"$cond": [{"$eq": ["$status", "VOID"]}, 1, 0]}}
            }
        }
    else:  # device_type
        group_stage = {
            "$group": {
                "_id": "$device_type",
                "tickets": {"$sum": 1},
                "sales": {"$sum": "$total_amount"},
                "voided": {"$sum": {"$cond": [{"$eq": ["$status", "VOID"]}, 1, 0]}}
            }
        }
    
    pipeline = [match_stage, group_stage, {"$sort": {"sales": -1}}]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(500)
    
    # Calculate totals
    totals = {
        "total_tickets": sum(r.get("tickets", 0) for r in results),
        "total_sales": sum(r.get("sales", 0) for r in results),
        "total_voided": sum(r.get("voided", 0) for r in results)
    }
    
    return {
        "period": {"from": date_from, "to": date_to},
        "group_by": group_by,
        "data": results,
        "totals": totals
    }


@company_admin_router.get("/reports/agents-performance")
async def get_agents_performance_report(
    current_user: dict = Depends(get_company_admin),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get detailed agent performance report"""
    company_id = current_user["company_id"]
    
    now = datetime.now(timezone.utc)
    if not date_from:
        date_from = now.replace(hour=0, minute=0, second=0).isoformat()
    if not date_to:
        date_to = now.isoformat()
    
    # Get all agents
    agents = await db.users.find(
        {"company_id": company_id, "role": UserRole.AGENT_POS},
        {"_id": 0, "password_hash": 0}
    ).to_list(200)
    
    performance = []
    for agent in agents:
        agent_id = agent["user_id"]
        
        # Sales stats
        pipeline = [
            {"$match": {
                "agent_id": agent_id,
                "created_at": {"$gte": date_from, "$lte": date_to}
            }},
            {"$group": {
                "_id": None,
                "tickets": {"$sum": 1},
                "sales": {"$sum": "$total_amount"},
                "voided": {"$sum": {"$cond": [{"$eq": ["$status", "VOID"]}, 1, 0]}},
                "winners": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, 1, 0]}}
            }}
        ]
        stats = await db.lottery_transactions.aggregate(pipeline).to_list(1)
        
        # Active sessions
        active_sessions = await db.device_sessions.count_documents({
            "agent_id": agent_id,
            "status": "active"
        })
        
        performance.append({
            "agent_id": agent_id,
            "agent_name": agent.get("name", ""),
            "email": agent.get("email", ""),
            "status": agent.get("status", ""),
            "tickets": stats[0]["tickets"] if stats else 0,
            "sales": stats[0]["sales"] if stats else 0,
            "voided": stats[0]["voided"] if stats else 0,
            "winners": stats[0]["winners"] if stats else 0,
            "active_sessions": active_sessions,
            "last_login": agent.get("last_login")
        })
    
    # Sort by sales descending
    performance.sort(key=lambda x: x["sales"], reverse=True)
    
    return {
        "period": {"from": date_from, "to": date_to},
        "agents": performance,
        "totals": {
            "total_agents": len(performance),
            "total_tickets": sum(p["tickets"] for p in performance),
            "total_sales": sum(p["sales"] for p in performance)
        }
    }


# ============================================================================
# CONFIG VERSION CHECK
# ============================================================================

@company_admin_router.get("/config-version")
async def get_config_version(current_user: dict = Depends(get_company_admin)):
    """Get current config version for sync checking"""
    company_id = current_user["company_id"]
    
    version = await db.company_config_versions.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    if not version:
        return {"version": 1, "company_id": company_id}
    
    return version


# ============================================================================
# RAPPORT DE VENTES DETAILLE - Avec pourcentages agents et superviseurs
# ============================================================================

@company_admin_router.get("/reports/ventes-detaillees")
async def get_rapport_ventes_detaillees(
    current_user: dict = Depends(get_company_admin),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """
    Get detailed sales report with agent and supervisor percentages
    Columns: No, Agent, Tfiche, Tfiche gagnant, Vente, A payé, %Agent, P/P sans %agent, P/P avec %agent, %Sup, B.Final
    """
    company_id = current_user["company_id"]
    
    # Build date filter
    query = {"company_id": company_id}
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from + "T00:00:00"
        if date_to:
            date_query["$lte"] = date_to + "T23:59:59"
        if date_query:
            query["created_at"] = date_query
    
    # Get all tickets for this company in the date range
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).to_list(10000)
    
    # Group by agent
    agents_data = {}
    for ticket in tickets:
        agent_id = ticket.get("agent_id") or ticket.get("vendeur_id") or "unknown"
        if agent_id not in agents_data:
            agents_data[agent_id] = {
                "agent_id": agent_id,
                "agent_name": ticket.get("agent_name") or "Agent",
                "total_tickets": 0,
                "tickets_gagnants": 0,
                "total_ventes": 0,
                "total_paye": 0,
                "pourcentage_agent": 10,  # Default, will be updated
                "pourcentage_superviseur": 10  # Default, will be updated
            }
        
        agents_data[agent_id]["total_tickets"] += 1
        agents_data[agent_id]["total_ventes"] += ticket.get("total_amount", 0)
        
        if ticket.get("status") == "WINNER":
            agents_data[agent_id]["tickets_gagnants"] += 1
            agents_data[agent_id]["total_paye"] += ticket.get("winnings", 0) or ticket.get("payout_amount", 0) or 0
    
    # Get agent policies for percentages
    for agent_id in agents_data:
        policy = await db.agent_policies.find_one(
            {"agent_id": agent_id},
            {"_id": 0, "commission_percent": 1}
        )
        if policy:
            agents_data[agent_id]["pourcentage_agent"] = policy.get("commission_percent", 10)
        
        # Get agent's succursale to find supervisor percentage
        agent = await db.users.find_one(
            {"user_id": agent_id},
            {"_id": 0, "succursale_id": 1}
        )
        if agent and agent.get("succursale_id"):
            succursale = await db.succursales.find_one(
                {"succursale_id": agent["succursale_id"]},
                {"_id": 0, "supervisor_commission_percent": 1}
            )
            if succursale:
                agents_data[agent_id]["pourcentage_superviseur"] = succursale.get("supervisor_commission_percent", 10)
    
    # Calculate totals
    agents_list = list(agents_data.values())
    totals = {
        "total_tickets": sum(a["total_tickets"] for a in agents_list),
        "total_gagnants": sum(a["tickets_gagnants"] for a in agents_list),
        "total_ventes": sum(a["total_ventes"] for a in agents_list),
        "total_paye": sum(a["total_paye"] for a in agents_list),
        "total_apres_commission": 0,
        "balance_final": 0
    }
    
    # Calculate total after commissions
    for agent in agents_list:
        vente = agent["total_ventes"]
        pct_agent = agent["pourcentage_agent"]
        pct_sup = agent["pourcentage_superviseur"]
        comm_agent = (vente * pct_agent) / 100
        comm_sup = (vente * pct_sup) / 100
        totals["total_apres_commission"] += (vente - comm_agent)
        totals["balance_final"] += (vente - comm_agent - comm_sup)
    
    return {
        "agents": agents_list,
        "totals": totals,
        "period": {
            "from": date_from,
            "to": date_to
        }
    }



# ==================== FLAG-BASED LOTTERY MANAGEMENT ====================

class LotteryFlagAssignment(BaseModel):
    lottery_id: str
    flag_type: str  # "HAITI" or "USA"

class BulkFlagAssignment(BaseModel):
    assignments: List[LotteryFlagAssignment]


@company_admin_router.get("/available-lotteries")
async def get_available_lotteries(current_user: dict = Depends(get_company_admin)):
    """Get all available lotteries from master catalog with their flag assignments"""
    company_id = current_user.get("company_id")
    
    # Get all master lotteries
    master_lotteries = await db.master_lotteries.find(
        {"$or": [{"is_active": True}, {"is_active_global": True}, {"status": "ACTIVE"}]},
        {"_id": 0}
    ).to_list(500)
    
    # Get company lottery assignments
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id},
        {"_id": 0, "lottery_id": 1, "flag_type": 1, "is_enabled": 1, "enabled": 1}
    ).to_list(500)
    
    # Create lookup
    company_lottery_map = {cl.get("lottery_id"): cl for cl in company_lotteries}
    
    # Enrich master lotteries with company assignments
    result = []
    for master in master_lotteries:
        lottery_id = master.get("lottery_id")
        company_data = company_lottery_map.get(lottery_id, {})
        
        result.append({
            "lottery_id": lottery_id,
            "lottery_name": master.get("lottery_name") or master.get("name"),
            "state_code": master.get("state_code"),
            "state_name": master.get("state_name"),
            "country": master.get("country"),
            "flag_type": company_data.get("flag_type") or master.get("flag_type") or "USA",
            "draws": master.get("draws", []),
            "open_time": master.get("open_time"),
            "close_time": master.get("close_time"),
            "is_enabled": company_data.get("is_enabled", False) or company_data.get("enabled", False),
            "is_assigned": lottery_id in company_lottery_map
        })
    
    # Sort: Haiti first, then by name
    result.sort(key=lambda x: (0 if x.get("flag_type") == "HAITI" else 1, x.get("lottery_name", "")))
    
    return result


@company_admin_router.get("/flag-lotteries/{flag_type}")
async def get_flag_lotteries(flag_type: str, current_user: dict = Depends(get_company_admin)):
    """Get lotteries assigned to a specific flag (HAITI or USA)"""
    company_id = current_user.get("company_id")
    
    # Get company lotteries with this flag
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "flag_type": flag_type.upper()},
        {"_id": 0}
    ).to_list(200)
    
    lottery_ids = [cl.get("lottery_id") for cl in company_lotteries]
    
    # Enrich with master data
    result = []
    for cl in company_lotteries:
        lottery_id = cl.get("lottery_id")
        master = await db.master_lotteries.find_one(
            {"lottery_id": lottery_id},
            {"_id": 0}
        )
        
        if master:
            result.append({
                "lottery_id": lottery_id,
                "lottery_name": cl.get("lottery_name") or master.get("lottery_name") or master.get("name"),
                "state_code": master.get("state_code"),
                "draws": master.get("draws", []),
                "open_time": master.get("open_time"),
                "close_time": master.get("close_time"),
                "is_enabled": cl.get("is_enabled", True) or cl.get("enabled", True),
                "flag_type": flag_type.upper()
            })
    
    return result


@company_admin_router.post("/assign-lottery-flag")
async def assign_lottery_to_flag(
    assignment: LotteryFlagAssignment,
    current_user: dict = Depends(get_company_admin)
):
    """Assign a lottery to a specific flag (HAITI or USA)"""
    company_id = current_user.get("company_id")
    now = get_current_timestamp()
    
    flag_type = assignment.flag_type.upper()
    if flag_type not in ["HAITI", "USA"]:
        raise HTTPException(status_code=400, detail="Flag type must be HAITI or USA")
    
    # Check if lottery exists in master
    master = await db.master_lotteries.find_one(
        {"lottery_id": assignment.lottery_id},
        {"_id": 0}
    )
    if not master:
        raise HTTPException(status_code=404, detail="Lottery not found in master catalog")
    
    # Check if company lottery entry exists
    existing = await db.company_lotteries.find_one({
        "company_id": company_id,
        "lottery_id": assignment.lottery_id
    })
    
    if existing:
        # Update flag
        await db.company_lotteries.update_one(
            {"company_id": company_id, "lottery_id": assignment.lottery_id},
            {"$set": {
                "flag_type": flag_type,
                "is_enabled": True,
                "enabled": True,
                "updated_at": now
            }}
        )
    else:
        # Create new entry
        new_lottery = {
            "company_lottery_id": generate_id("cl"),
            "company_id": company_id,
            "lottery_id": assignment.lottery_id,
            "lottery_name": master.get("lottery_name") or master.get("name"),
            "state_code": master.get("state_code"),
            "flag_type": flag_type,
            "is_enabled": True,
            "enabled": True,
            "disabled_by_super_admin": False,
            "created_at": now,
            "updated_at": now
        }
        await db.company_lotteries.insert_one(new_lottery)
    
    await log_activity(
        db, company_id, current_user.get("user_id"),
        "LOTTERY_FLAG_ASSIGNED",
        f"Lottery {master.get('lottery_name')} assigned to {flag_type} flag"
    )
    
    return {"message": f"Lottery assigned to {flag_type} flag", "lottery_id": assignment.lottery_id}


@company_admin_router.post("/bulk-assign-flags")
async def bulk_assign_lottery_flags(
    data: BulkFlagAssignment,
    current_user: dict = Depends(get_company_admin)
):
    """Bulk assign multiple lotteries to flags"""
    company_id = current_user.get("company_id")
    now = get_current_timestamp()
    
    assigned_count = 0
    for assignment in data.assignments:
        flag_type = assignment.flag_type.upper()
        if flag_type not in ["HAITI", "USA"]:
            continue
        
        master = await db.master_lotteries.find_one(
            {"lottery_id": assignment.lottery_id},
            {"_id": 0}
        )
        if not master:
            continue
        
        existing = await db.company_lotteries.find_one({
            "company_id": company_id,
            "lottery_id": assignment.lottery_id
        })
        
        if existing:
            await db.company_lotteries.update_one(
                {"company_id": company_id, "lottery_id": assignment.lottery_id},
                {"$set": {"flag_type": flag_type, "is_enabled": True, "enabled": True, "updated_at": now}}
            )
        else:
            await db.company_lotteries.insert_one({
                "company_lottery_id": generate_id("cl"),
                "company_id": company_id,
                "lottery_id": assignment.lottery_id,
                "lottery_name": master.get("lottery_name") or master.get("name"),
                "state_code": master.get("state_code"),
                "flag_type": flag_type,
                "is_enabled": True,
                "enabled": True,
                "disabled_by_super_admin": False,
                "created_at": now,
                "updated_at": now
            })
        assigned_count += 1
    
    return {"message": f"{assigned_count} lotteries assigned", "count": assigned_count}


@company_admin_router.delete("/remove-lottery-flag/{lottery_id}")
async def remove_lottery_from_flags(
    lottery_id: str,
    current_user: dict = Depends(get_company_admin)
):
    """Remove a lottery from company (disable it)"""
    company_id = current_user.get("company_id")
    now = get_current_timestamp()
    
    result = await db.company_lotteries.update_one(
        {"company_id": company_id, "lottery_id": lottery_id},
        {"$set": {"is_enabled": False, "enabled": False, "updated_at": now}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    return {"message": "Lottery disabled", "lottery_id": lottery_id}
