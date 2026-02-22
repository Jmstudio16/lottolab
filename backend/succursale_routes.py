"""
Succursale (Branch) Management Routes
New hierarchy: Super Admin → Company Admin → Succursales → Agents
Agents MUST belong to ONE succursale - no standalone agents allowed.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr
import os
import uuid
import shutil

from models import UserRole
from auth import decode_token, get_password_hash
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

succursale_router = APIRouter(prefix="/api/company/succursales", tags=["Succursales"])
security = HTTPBearer()

db = None
UPLOAD_DIR = "/app/backend/uploads/bank-logos"

def set_succursale_db(database):
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
    
    allowed_roles = [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER]
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


# ============================================================================
# PYDANTIC MODELS FOR SUCCURSALE
# ============================================================================

class SuccursaleCreate(BaseModel):
    # Succursale info
    nom_succursale: str
    nom_bank: str
    message: Optional[str] = None
    
    # Supervisor options
    allow_sub_supervisor: bool = False  # Possibilité d'ajouter sous-superviseur
    mariage_gratuit: bool = False  # Mariage Gratuit
    
    # Superviseur principal
    supervisor_nom: str
    supervisor_prenom: str
    supervisor_pseudo: str
    supervisor_password: str
    supervisor_password_confirm: str
    
    # Utilisateur (optional additional user)
    user_nom: Optional[str] = None
    user_prenom: Optional[str] = None
    user_pseudo: Optional[str] = None
    user_password: Optional[str] = None
    user_password_confirm: Optional[str] = None


class SuccursaleUpdate(BaseModel):
    nom_succursale: Optional[str] = None
    nom_bank: Optional[str] = None
    message: Optional[str] = None
    allow_sub_supervisor: Optional[bool] = None
    mariage_gratuit: Optional[bool] = None
    status: Optional[str] = None


class AgentInSuccursaleCreate(BaseModel):
    # Agent info
    device_id: str
    zone_adresse: Optional[str] = None
    nom_agent: str
    prenom_agent: str
    telephone: Optional[str] = None
    identifiant: str  # login username
    mot_de_passe: str
    
    # Commission & Limits
    percent_agent: float = 0.0
    percent_superviseur: float = 0.0
    limite_credit: float = 50000.0
    limite_balance_gain: float = 100000.0


class AgentUpdate(BaseModel):
    zone_adresse: Optional[str] = None
    nom_agent: Optional[str] = None
    prenom_agent: Optional[str] = None
    telephone: Optional[str] = None
    percent_agent: Optional[float] = None
    percent_superviseur: Optional[float] = None
    limite_credit: Optional[float] = None
    limite_balance_gain: Optional[float] = None
    status: Optional[str] = None


# ============================================================================
# SUCCURSALE CRUD
# ============================================================================

@succursale_router.get("")
async def get_all_succursales(current_user: dict = Depends(get_company_admin)):
    """Get all succursales for the company"""
    company_id = current_user["company_id"]
    
    succursales = await db.succursales.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(500)
    
    # Enrich with agent count and supervisor info
    for succ in succursales:
        # Count agents in this succursale
        agent_count = await db.users.count_documents({
            "succursale_id": succ["succursale_id"],
            "role": UserRole.AGENT_POS,
            "status": {"$ne": "DELETED"}
        })
        succ["agent_count"] = agent_count
        
        # Get supervisor name
        if succ.get("supervisor_id"):
            supervisor = await db.users.find_one(
                {"user_id": succ["supervisor_id"]},
                {"_id": 0, "name": 1, "email": 1}
            )
            succ["supervisor_name"] = supervisor.get("name") if supervisor else None
    
    return succursales


@succursale_router.get("/{succursale_id}")
async def get_succursale_detail(
    succursale_id: str,
    current_user: dict = Depends(get_company_admin)
):
    """Get single succursale with full details including agents"""
    company_id = current_user["company_id"]
    
    succursale = await db.succursales.find_one(
        {"succursale_id": succursale_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not succursale:
        raise HTTPException(status_code=404, detail="Succursale non trouvée")
    
    # Get all agents in this succursale
    agents = await db.users.find(
        {
            "succursale_id": succursale_id,
            "role": UserRole.AGENT_POS,
            "status": {"$ne": "DELETED"}
        },
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    
    # Enrich agents with policy data
    enriched_agents = []
    for agent in agents:
        policy = await db.agent_policies.find_one(
            {"agent_id": agent["user_id"]},
            {"_id": 0}
        )
        
        # Get today's stats
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        pipeline = [
            {"$match": {"agent_id": agent["user_id"], "created_at": {"$gte": today_start}}},
            {"$group": {
                "_id": None,
                "total_tickets": {"$sum": 1},
                "total_sales": {"$sum": "$total_amount"}
            }}
        ]
        stats = await db.lottery_transactions.aggregate(pipeline).to_list(1)
        
        enriched_agents.append({
            **agent,
            "device_id": policy.get("device_id") if policy else None,
            "zone_adresse": policy.get("zone") if policy else None,
            "percent_agent": policy.get("commission_percent", 0) if policy else 0,
            "percent_superviseur": policy.get("supervisor_percent", 0) if policy else 0,
            "limite_credit": policy.get("max_credit_limit", 50000) if policy else 50000,
            "limite_balance_gain": policy.get("max_win_limit", 100000) if policy else 100000,
            "total_sales_today": stats[0]["total_sales"] if stats else 0,
            "total_tickets_today": stats[0]["total_tickets"] if stats else 0
        })
    
    succursale["agents"] = enriched_agents
    
    # Get supervisor info
    if succursale.get("supervisor_id"):
        supervisor = await db.users.find_one(
            {"user_id": succursale["supervisor_id"]},
            {"_id": 0, "password_hash": 0}
        )
        succursale["supervisor"] = supervisor
    
    return succursale


@succursale_router.post("")
async def create_succursale(
    data: SuccursaleCreate,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Create a new succursale with supervisor"""
    company_id = require_admin(current_user)
    
    # Validate passwords match
    if data.supervisor_password != data.supervisor_password_confirm:
        raise HTTPException(status_code=400, detail="Les mots de passe du superviseur ne correspondent pas")
    
    if data.user_password and data.user_password != data.user_password_confirm:
        raise HTTPException(status_code=400, detail="Les mots de passe de l'utilisateur ne correspondent pas")
    
    # Check supervisor pseudo uniqueness
    existing_supervisor = await db.users.find_one({"email": f"{data.supervisor_pseudo}@branch.local"})
    if existing_supervisor:
        raise HTTPException(status_code=400, detail="Ce pseudo superviseur existe déjà")
    
    now = get_current_timestamp()
    succursale_id = generate_id("succ_")
    supervisor_id = generate_id("user_")
    
    # 1. Create supervisor user
    supervisor_email = f"{data.supervisor_pseudo}@branch.local"
    supervisor_name = f"{data.supervisor_prenom} {data.supervisor_nom}"
    
    supervisor_doc = {
        "user_id": supervisor_id,
        "email": supervisor_email,
        "password_hash": get_password_hash(data.supervisor_password),
        "name": supervisor_name,
        "role": "BRANCH_SUPERVISOR",
        "company_id": company_id,
        "succursale_id": succursale_id,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(supervisor_doc)
    
    # 2. Create optional additional user if provided
    additional_user_id = None
    if data.user_nom and data.user_prenom and data.user_pseudo and data.user_password:
        additional_user_id = generate_id("user_")
        user_email = f"{data.user_pseudo}@branch.local"
        user_name = f"{data.user_prenom} {data.user_nom}"
        
        user_doc = {
            "user_id": additional_user_id,
            "email": user_email,
            "password_hash": get_password_hash(data.user_password),
            "name": user_name,
            "role": "BRANCH_USER",
            "company_id": company_id,
            "succursale_id": succursale_id,
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        }
        await db.users.insert_one(user_doc)
    
    # 3. Create succursale record
    succursale_doc = {
        "succursale_id": succursale_id,
        "company_id": company_id,
        "nom_succursale": data.nom_succursale,
        "nom_bank": data.nom_bank,
        "logo_bank_url": None,  # Will be set via separate upload
        "message": data.message,
        "allow_sub_supervisor": data.allow_sub_supervisor,
        "mariage_gratuit": data.mariage_gratuit,
        "supervisor_id": supervisor_id,
        "supervisor_nom": data.supervisor_nom,
        "supervisor_prenom": data.supervisor_prenom,
        "supervisor_pseudo": data.supervisor_pseudo,
        "additional_user_id": additional_user_id,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now
    }
    await db.succursales.insert_one(succursale_doc)
    
    await log_activity(
        db=db,
        action_type="SUCCURSALE_CREATED",
        entity_type="succursale",
        entity_id=succursale_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "nom_succursale": data.nom_succursale,
            "supervisor_name": supervisor_name
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": "Succursale créée avec succès",
        "succursale_id": succursale_id,
        "supervisor_id": supervisor_id,
        "supervisor_pseudo": data.supervisor_pseudo
    }


@succursale_router.post("/{succursale_id}/logo")
async def upload_bank_logo(
    succursale_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_company_admin)
):
    """Upload bank logo (320x232) for succursale"""
    company_id = require_admin(current_user)
    
    # Verify succursale exists
    succursale = await db.succursales.find_one(
        {"succursale_id": succursale_id, "company_id": company_id}
    )
    if not succursale:
        raise HTTPException(status_code=404, detail="Succursale non trouvée")
    
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Type de fichier non supporté. Utilisez PNG, JPEG ou WebP")
    
    # Create upload directory
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{succursale_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update succursale with logo URL
    logo_url = f"/uploads/bank-logos/{filename}"
    await db.succursales.update_one(
        {"succursale_id": succursale_id},
        {"$set": {"logo_bank_url": logo_url, "updated_at": get_current_timestamp()}}
    )
    
    return {"message": "Logo téléchargé", "logo_url": logo_url}


@succursale_router.put("/{succursale_id}")
async def update_succursale(
    succursale_id: str,
    updates: SuccursaleUpdate,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Update succursale details"""
    company_id = require_admin(current_user)
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.succursales.update_one(
        {"succursale_id": succursale_id, "company_id": company_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Succursale non trouvée")
    
    await log_activity(
        db=db,
        action_type="SUCCURSALE_UPDATED",
        entity_type="succursale",
        entity_id=succursale_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Succursale mise à jour"}


@succursale_router.delete("/{succursale_id}")
async def delete_succursale(
    succursale_id: str,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Delete succursale - only if no active agents"""
    company_id = require_admin(current_user)
    
    # Check if succursale exists
    succursale = await db.succursales.find_one(
        {"succursale_id": succursale_id, "company_id": company_id},
        {"_id": 0}
    )
    if not succursale:
        raise HTTPException(status_code=404, detail="Succursale non trouvée")
    
    # Check for active agents
    active_agents = await db.users.count_documents({
        "succursale_id": succursale_id,
        "role": UserRole.AGENT_POS,
        "status": "ACTIVE"
    })
    
    if active_agents > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Impossible de supprimer: {active_agents} agent(s) actif(s) dans cette succursale. Supprimez ou transférez les agents d'abord."
        )
    
    # Soft delete succursale
    await db.succursales.update_one(
        {"succursale_id": succursale_id},
        {"$set": {"status": "DELETED", "updated_at": get_current_timestamp()}}
    )
    
    # Suspend supervisor
    if succursale.get("supervisor_id"):
        await db.users.update_one(
            {"user_id": succursale["supervisor_id"]},
            {"$set": {"status": "SUSPENDED", "updated_at": get_current_timestamp()}}
        )
    
    await log_activity(
        db=db,
        action_type="SUCCURSALE_DELETED",
        entity_type="succursale",
        entity_id=succursale_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"nom_succursale": succursale.get("nom_succursale")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Succursale supprimée"}


# ============================================================================
# AGENT MANAGEMENT WITHIN SUCCURSALE
# ============================================================================

@succursale_router.get("/{succursale_id}/agents")
async def get_succursale_agents(
    succursale_id: str,
    current_user: dict = Depends(get_company_admin)
):
    """Get all agents in a succursale"""
    company_id = current_user["company_id"]
    
    # Verify succursale exists
    succursale = await db.succursales.find_one(
        {"succursale_id": succursale_id, "company_id": company_id}
    )
    if not succursale:
        raise HTTPException(status_code=404, detail="Succursale non trouvée")
    
    agents = await db.users.find(
        {
            "succursale_id": succursale_id,
            "role": UserRole.AGENT_POS,
            "status": {"$ne": "DELETED"}
        },
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    
    # Enrich with policy and stats
    enriched = []
    for agent in agents:
        policy = await db.agent_policies.find_one(
            {"agent_id": agent["user_id"]},
            {"_id": 0}
        )
        
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        pipeline = [
            {"$match": {"agent_id": agent["user_id"], "created_at": {"$gte": today_start}}},
            {"$group": {
                "_id": None,
                "total_tickets": {"$sum": 1},
                "total_sales": {"$sum": "$total_amount"}
            }}
        ]
        stats = await db.lottery_transactions.aggregate(pipeline).to_list(1)
        
        enriched.append({
            **agent,
            "succursale_name": succursale.get("nom_succursale"),
            "device_id": policy.get("device_id") if policy else None,
            "zone_adresse": policy.get("zone") if policy else None,
            "percent_agent": policy.get("commission_percent", 0) if policy else 0,
            "percent_superviseur": policy.get("supervisor_percent", 0) if policy else 0,
            "limite_credit": policy.get("max_credit_limit", 50000) if policy else 50000,
            "limite_balance_gain": policy.get("max_win_limit", 100000) if policy else 100000,
            "total_sales_today": stats[0]["total_sales"] if stats else 0,
            "total_tickets_today": stats[0]["total_tickets"] if stats else 0
        })
    
    return enriched


@succursale_router.post("/{succursale_id}/agents")
async def create_agent_in_succursale(
    succursale_id: str,
    agent_data: AgentInSuccursaleCreate,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Create a new agent WITHIN a succursale"""
    company_id = require_admin(current_user)
    
    # Verify succursale exists and belongs to company
    succursale = await db.succursales.find_one(
        {"succursale_id": succursale_id, "company_id": company_id}
    )
    if not succursale:
        raise HTTPException(status_code=404, detail="Succursale non trouvée")
    
    # Check identifier uniqueness
    existing = await db.users.find_one({"email": f"{agent_data.identifiant}@agent.local"})
    if existing:
        raise HTTPException(status_code=400, detail="Cet identifiant existe déjà")
    
    # Check device_id uniqueness
    existing_device = await db.agent_policies.find_one({"device_id": agent_data.device_id})
    if existing_device:
        raise HTTPException(status_code=400, detail="Ce DEVICE ID est déjà utilisé")
    
    now = get_current_timestamp()
    agent_id = generate_id("user_")
    agent_email = f"{agent_data.identifiant}@agent.local"
    agent_name = f"{agent_data.prenom_agent} {agent_data.nom_agent}"
    
    # 1. Create user record for agent
    user_doc = {
        "user_id": agent_id,
        "email": agent_email,
        "password_hash": get_password_hash(agent_data.mot_de_passe),
        "name": agent_name,
        "role": UserRole.AGENT_POS,
        "company_id": company_id,
        "succursale_id": succursale_id,  # CRITICAL: Agent belongs to succursale
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(user_doc)
    
    # 2. Create agent policy with all settings
    policy_id = generate_id("policy_")
    policy_doc = {
        "id": policy_id,
        "company_id": company_id,
        "agent_id": agent_id,
        "succursale_id": succursale_id,
        "device_id": agent_data.device_id,
        "first_name": agent_data.prenom_agent,
        "last_name": agent_data.nom_agent,
        "phone": agent_data.telephone,
        "zone": agent_data.zone_adresse,
        "identifiant": agent_data.identifiant,
        "commission_percent": agent_data.percent_agent,
        "supervisor_percent": agent_data.percent_superviseur,
        "max_credit_limit": agent_data.limite_credit,
        "max_win_limit": agent_data.limite_balance_gain,
        "allowed_device_types": ["POS", "COMPUTER", "PHONE", "TABLET"],
        "can_void_ticket": True,
        "can_reprint_ticket": True,
        "status": "active",
        "created_at": now,
        "updated_at": now
    }
    await db.agent_policies.insert_one(policy_doc)
    
    # 3. Create agent balance record
    balance_id = generate_id("bal_")
    balance_doc = {
        "balance_id": balance_id,
        "agent_id": agent_id,
        "company_id": company_id,
        "succursale_id": succursale_id,
        "credit_limit": agent_data.limite_credit,
        "current_balance": 0.0,
        "available_balance": agent_data.limite_credit,
        "total_sales": 0.0,
        "total_payouts": 0.0,
        "total_winnings": 0.0,
        "created_at": now,
        "updated_at": now
    }
    await db.agent_balances.insert_one(balance_doc)
    
    await log_activity(
        db=db,
        action_type="AGENT_CREATED_IN_SUCCURSALE",
        entity_type="agent",
        entity_id=agent_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "agent_name": agent_name,
            "succursale_id": succursale_id,
            "succursale_name": succursale.get("nom_succursale"),
            "device_id": agent_data.device_id
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": "Agent créé avec succès dans la succursale",
        "agent_id": agent_id,
        "identifiant": agent_data.identifiant,
        "succursale_id": succursale_id
    }


@succursale_router.put("/{succursale_id}/agents/{agent_id}")
async def update_agent_in_succursale(
    succursale_id: str,
    agent_id: str,
    updates: AgentUpdate,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Update an agent within a succursale"""
    company_id = require_admin(current_user)
    
    # Verify agent exists in this succursale
    agent = await db.users.find_one({
        "user_id": agent_id,
        "succursale_id": succursale_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS
    })
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé dans cette succursale")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
    
    now = get_current_timestamp()
    
    # Update user record if name changed
    user_updates = {"updated_at": now}
    if "nom_agent" in update_data or "prenom_agent" in update_data:
        policy = await db.agent_policies.find_one({"agent_id": agent_id}, {"_id": 0})
        first = update_data.get("prenom_agent", policy.get("first_name", "") if policy else "")
        last = update_data.get("nom_agent", policy.get("last_name", "") if policy else "")
        user_updates["name"] = f"{first} {last}"
    
    if "status" in update_data:
        user_updates["status"] = update_data["status"]
    
    await db.users.update_one({"user_id": agent_id}, {"$set": user_updates})
    
    # Update policy
    policy_updates = {"updated_at": now}
    field_map = {
        "nom_agent": "last_name",
        "prenom_agent": "first_name",
        "telephone": "phone",
        "zone_adresse": "zone",
        "percent_agent": "commission_percent",
        "percent_superviseur": "supervisor_percent",
        "limite_credit": "max_credit_limit",
        "limite_balance_gain": "max_win_limit"
    }
    
    for src, dest in field_map.items():
        if src in update_data:
            policy_updates[dest] = update_data[src]
    
    if "status" in update_data:
        policy_updates["status"] = "active" if update_data["status"] == "ACTIVE" else "suspended"
    
    await db.agent_policies.update_one(
        {"agent_id": agent_id},
        {"$set": policy_updates}
    )
    
    # Update balance limit if changed
    if "limite_credit" in update_data:
        await db.agent_balances.update_one(
            {"agent_id": agent_id},
            {"$set": {"credit_limit": update_data["limite_credit"], "updated_at": now}}
        )
    
    await log_activity(
        db=db,
        action_type="AGENT_UPDATED",
        entity_type="agent",
        entity_id=agent_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data, "succursale_id": succursale_id},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Agent mis à jour"}


@succursale_router.delete("/{succursale_id}/agents/{agent_id}")
async def delete_agent_from_succursale(
    succursale_id: str,
    agent_id: str,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Delete (soft) an agent from succursale"""
    company_id = require_admin(current_user)
    
    # Verify agent exists in this succursale
    agent = await db.users.find_one({
        "user_id": agent_id,
        "succursale_id": succursale_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS
    })
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé dans cette succursale")
    
    now = get_current_timestamp()
    
    # Soft delete - set status to DELETED
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": {"status": "DELETED", "updated_at": now}}
    )
    
    await db.agent_policies.update_one(
        {"agent_id": agent_id},
        {"$set": {"status": "deleted", "updated_at": now}}
    )
    
    await log_activity(
        db=db,
        action_type="AGENT_DELETED",
        entity_type="agent",
        entity_id=agent_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "agent_name": agent.get("name"),
            "succursale_id": succursale_id
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Agent supprimé"}


# ============================================================================
# REPORTS - SUCCURSALE LEVEL
# ============================================================================

@succursale_router.get("/{succursale_id}/reports")
async def get_succursale_reports(
    succursale_id: str,
    current_user: dict = Depends(get_company_admin),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get sales report for a succursale"""
    company_id = current_user["company_id"]
    
    # Verify succursale exists
    succursale = await db.succursales.find_one(
        {"succursale_id": succursale_id, "company_id": company_id}
    )
    if not succursale:
        raise HTTPException(status_code=404, detail="Succursale non trouvée")
    
    # Get all agents in this succursale
    agents = await db.users.find(
        {"succursale_id": succursale_id, "role": UserRole.AGENT_POS},
        {"_id": 0, "user_id": 1}
    ).to_list(500)
    
    agent_ids = [a["user_id"] for a in agents]
    
    if not agent_ids:
        return {
            "succursale_id": succursale_id,
            "nom_succursale": succursale.get("nom_succursale"),
            "total_sales": 0,
            "total_tickets": 0,
            "total_winnings": 0,
            "by_agent": []
        }
    
    # Build date query
    now = datetime.now(timezone.utc)
    if not date_from:
        date_from = now.replace(hour=0, minute=0, second=0).isoformat()
    if not date_to:
        date_to = now.isoformat()
    
    # Aggregate sales by agent
    pipeline = [
        {"$match": {
            "agent_id": {"$in": agent_ids},
            "created_at": {"$gte": date_from, "$lte": date_to}
        }},
        {"$group": {
            "_id": "$agent_id",
            "agent_name": {"$first": "$agent_name"},
            "tickets": {"$sum": 1},
            "sales": {"$sum": "$total_amount"},
            "wins": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, "$actual_win", 0]}}
        }},
        {"$sort": {"sales": -1}}
    ]
    
    by_agent = await db.lottery_transactions.aggregate(pipeline).to_list(500)
    
    total_sales = sum(a.get("sales", 0) for a in by_agent)
    total_tickets = sum(a.get("tickets", 0) for a in by_agent)
    total_wins = sum(a.get("wins", 0) for a in by_agent)
    
    return {
        "succursale_id": succursale_id,
        "nom_succursale": succursale.get("nom_succursale"),
        "period": {"from": date_from, "to": date_to},
        "total_sales": total_sales,
        "total_tickets": total_tickets,
        "total_winnings": total_wins,
        "net_revenue": total_sales - total_wins,
        "by_agent": by_agent
    }
