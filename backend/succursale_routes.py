"""
Succursale (Branch) Management Routes - RESTRUCTURED
- Email-based login ONLY (no pseudo/identifiant)
- Supervisor with full details
- Agent under succursale only
- Auto-sync to Super Admin
- Multi-tenant isolation
"""

from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
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
    """Auth dependency for company admin routes with suspension check"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    # Check if user is suspended
    if user.get("status") in ["SUSPENDED", "DELETED"]:
        raise HTTPException(status_code=403, detail="Compte suspendu. Contactez l'administrateur.")
    
    # Check if company is suspended
    if user.get("company_id"):
        company = await db.companies.find_one({"company_id": user["company_id"]}, {"_id": 0})
        if company and company.get("status") in ["SUSPENDED", "EXPIRED"]:
            raise HTTPException(status_code=403, detail="Entreprise suspendue ou expirée. Contactez l'administrateur.")
    
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
# PYDANTIC MODELS - EMAIL BASED (NO PSEUDO/IDENTIFIANT)
# ============================================================================

class SuccursaleCreate(BaseModel):
    """New Succursale form with EMAIL-based supervisor"""
    # SECTION 1 - SUPERVISEUR
    supervisor_nom: str
    supervisor_prenom: str
    supervisor_email: EmailStr  # REQUIRED - replaces pseudo
    supervisor_telephone: str  # REQUIRED
    supervisor_password: str
    supervisor_password_confirm: str
    
    # SECTION 2 - PARAMÈTRES
    allow_sub_supervisor: bool = False
    superviseur_principal: bool = True
    mariage_gratuit: bool = False
    nom_succursale: str
    nom_bank: str
    message: Optional[str] = None


class SuccursaleUpdate(BaseModel):
    nom_succursale: Optional[str] = None
    nom_bank: Optional[str] = None
    message: Optional[str] = None
    allow_sub_supervisor: Optional[bool] = None
    mariage_gratuit: Optional[bool] = None
    status: Optional[str] = None


class AgentCreate(BaseModel):
    """New Agent form - EMAIL based, under succursale"""
    # Agent info
    nom_agent: str
    prenom_agent: str
    email: EmailStr  # REQUIRED - replaces identifiant
    telephone: Optional[str] = None
    password: str
    password_confirm: str
    
    # Commission & Limits
    commission_percent: float = 0.0
    limite_credit: float = 50000.0
    limite_gain: float = 100000.0
    status: str = "ACTIVE"


class AgentUpdate(BaseModel):
    nom_agent: Optional[str] = None
    prenom_agent: Optional[str] = None
    telephone: Optional[str] = None
    commission_percent: Optional[float] = None
    limite_credit: Optional[float] = None
    limite_gain: Optional[float] = None
    status: Optional[str] = None


# ============================================================================
# HELPER: UPDATE COMPANY AGENT COUNT
# ============================================================================

async def update_company_agent_count(company_id: str):
    """Update agent count in company document"""
    count = await db.users.count_documents({
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "status": {"$ne": "DELETED"}
    })
    
    succursale_count = await db.succursales.count_documents({
        "company_id": company_id,
        "status": {"$ne": "DELETED"}
    })
    
    await db.companies.update_one(
        {"company_id": company_id},
        {"$set": {
            "agents_count": count,
            "succursales_count": succursale_count,
            "updated_at": get_current_timestamp()
        }}
    )


# ============================================================================
# SUCCURSALE CRUD
# ============================================================================

@succursale_router.get("")
async def get_all_succursales(current_user: dict = Depends(get_company_admin)):
    """Get all succursales for the company"""
    company_id = current_user["company_id"]
    
    succursales = await db.succursales.find(
        {"company_id": company_id, "status": {"$ne": "DELETED"}},
        {"_id": 0}
    ).to_list(500)
    
    # Enrich with agent count and supervisor info
    for succ in succursales:
        agent_count = await db.users.count_documents({
            "succursale_id": succ["succursale_id"],
            "role": UserRole.AGENT_POS,
            "status": {"$ne": "DELETED"}
        })
        succ["agent_count"] = agent_count
        
        if succ.get("supervisor_id"):
            supervisor = await db.users.find_one(
                {"user_id": succ["supervisor_id"]},
                {"_id": 0, "name": 1, "email": 1}
            )
            succ["supervisor_name"] = supervisor.get("name") if supervisor else None
            succ["supervisor_email"] = supervisor.get("email") if supervisor else None
    
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
        
        enriched_agents.append({
            **agent,
            "commission_percent": policy.get("commission_percent", 0) if policy else 0,
            "limite_credit": policy.get("max_credit_limit", 50000) if policy else 50000,
            "limite_gain": policy.get("max_win_limit", 100000) if policy else 100000
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
    """Create a new succursale with EMAIL-based supervisor"""
    company_id = require_admin(current_user)
    
    # Validate passwords match
    if data.supervisor_password != data.supervisor_password_confirm:
        raise HTTPException(status_code=400, detail="Les mots de passe ne correspondent pas")
    
    # Check supervisor email uniqueness GLOBALLY
    existing_email = await db.users.find_one({"email": data.supervisor_email.lower()})
    if existing_email:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    now = get_current_timestamp()
    succursale_id = generate_id("succ_")
    supervisor_id = generate_id("user_")
    
    # Get company name for notification
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0, "name": 1})
    company_name = company.get("name", "Unknown") if company else "Unknown"
    
    # 1. Create supervisor user with EMAIL login
    supervisor_name = f"{data.supervisor_prenom} {data.supervisor_nom}"
    
    supervisor_doc = {
        "user_id": supervisor_id,
        "email": data.supervisor_email.lower(),  # Normalized email
        "password_hash": get_password_hash(data.supervisor_password),
        "name": supervisor_name,
        "telephone": data.supervisor_telephone,
        "role": "BRANCH_SUPERVISOR",
        "company_id": company_id,
        "succursale_id": succursale_id,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(supervisor_doc)
    
    # 2. Create succursale record
    succursale_doc = {
        "succursale_id": succursale_id,
        "company_id": company_id,
        "company_name": company_name,
        "nom_succursale": data.nom_succursale,
        "nom_bank": data.nom_bank,
        "logo_bank_url": None,
        "message": data.message,
        "allow_sub_supervisor": data.allow_sub_supervisor,
        "superviseur_principal": data.superviseur_principal,
        "mariage_gratuit": data.mariage_gratuit,
        "supervisor_id": supervisor_id,
        "supervisor_nom": data.supervisor_nom,
        "supervisor_prenom": data.supervisor_prenom,
        "supervisor_email": data.supervisor_email.lower(),
        "supervisor_telephone": data.supervisor_telephone,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now
    }
    await db.succursales.insert_one(succursale_doc)
    
    # 3. Update company counters
    await update_company_agent_count(company_id)
    
    # 4. Log activity
    await log_activity(
        db=db,
        action_type="SUCCURSALE_CREATED",
        entity_type="succursale",
        entity_id=succursale_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "nom_succursale": data.nom_succursale,
            "supervisor_name": supervisor_name,
            "supervisor_email": data.supervisor_email,
            "company_name": company_name
        },
        ip_address=request.client.host if request.client else None
    )
    
    # 5. Create notification for Super Admin
    notification_doc = {
        "notification_id": generate_id("notif_"),
        "type": "SUCCURSALE_CREATED",
        "target_role": "SUPER_ADMIN",
        "company_id": company_id,
        "company_name": company_name,
        "message": f"Nouvelle succursale '{data.nom_succursale}' créée par {company_name}",
        "metadata": {
            "succursale_id": succursale_id,
            "supervisor_email": data.supervisor_email
        },
        "read": False,
        "created_at": now
    }
    await db.admin_notifications.insert_one(notification_doc)
    
    return {
        "message": "Succursale créée avec succès",
        "succursale_id": succursale_id,
        "supervisor_id": supervisor_id,
        "supervisor_email": data.supervisor_email.lower()
    }


@succursale_router.post("/{succursale_id}/logo")
async def upload_bank_logo(
    succursale_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_company_admin)
):
    """Upload bank logo for succursale"""
    company_id = require_admin(current_user)
    
    succursale = await db.succursales.find_one(
        {"succursale_id": succursale_id, "company_id": company_id}
    )
    if not succursale:
        raise HTTPException(status_code=404, detail="Succursale non trouvée")
    
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Type de fichier non supporté")
    
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{succursale_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
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
    
    succursale = await db.succursales.find_one(
        {"succursale_id": succursale_id, "company_id": company_id},
        {"_id": 0}
    )
    if not succursale:
        raise HTTPException(status_code=404, detail="Succursale non trouvée")
    
    active_agents = await db.users.count_documents({
        "succursale_id": succursale_id,
        "role": UserRole.AGENT_POS,
        "status": "ACTIVE"
    })
    
    if active_agents > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Impossible de supprimer: {active_agents} agent(s) actif(s). Supprimez les agents d'abord."
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
    
    # Update company counters
    await update_company_agent_count(company_id)
    
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
# AGENT MANAGEMENT WITHIN SUCCURSALE - EMAIL BASED
# ============================================================================

@succursale_router.get("/{succursale_id}/agents")
async def get_succursale_agents(
    succursale_id: str,
    current_user: dict = Depends(get_company_admin)
):
    """Get all agents in a succursale"""
    company_id = current_user["company_id"]
    
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
    
    enriched = []
    for agent in agents:
        policy = await db.agent_policies.find_one(
            {"agent_id": agent["user_id"]},
            {"_id": 0}
        )
        
        enriched.append({
            **agent,
            "succursale_name": succursale.get("nom_succursale"),
            "commission_percent": policy.get("commission_percent", 0) if policy else 0,
            "limite_credit": policy.get("max_credit_limit", 50000) if policy else 50000,
            "limite_gain": policy.get("max_win_limit", 100000) if policy else 100000
        })
    
    return enriched


@succursale_router.post("/{succursale_id}/agents")
async def create_agent_in_succursale(
    succursale_id: str,
    agent_data: AgentCreate,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Create a new agent with EMAIL-based login"""
    company_id = require_admin(current_user)
    
    # Validate passwords
    if agent_data.password != agent_data.password_confirm:
        raise HTTPException(status_code=400, detail="Les mots de passe ne correspondent pas")
    
    # Verify succursale exists
    succursale = await db.succursales.find_one(
        {"succursale_id": succursale_id, "company_id": company_id}
    )
    if not succursale:
        raise HTTPException(status_code=404, detail="Succursale non trouvée")
    
    # Check email uniqueness GLOBALLY
    existing = await db.users.find_one({"email": agent_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    now = get_current_timestamp()
    agent_id = generate_id("user_")
    agent_name = f"{agent_data.prenom_agent} {agent_data.nom_agent}"
    
    # Get company name for notification
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0, "name": 1})
    company_name = company.get("name", "Unknown") if company else "Unknown"
    
    # 1. Create user record with EMAIL login
    user_doc = {
        "user_id": agent_id,
        "email": agent_data.email.lower(),  # EMAIL as login
        "password_hash": get_password_hash(agent_data.password),
        "name": agent_name,
        "telephone": agent_data.telephone,
        "role": UserRole.AGENT_POS,
        "company_id": company_id,
        "succursale_id": succursale_id,
        "status": agent_data.status,
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(user_doc)
    
    # 2. Create agent policy
    policy_id = generate_id("policy_")
    policy_doc = {
        "id": policy_id,
        "company_id": company_id,
        "agent_id": agent_id,
        "succursale_id": succursale_id,
        "first_name": agent_data.prenom_agent,
        "last_name": agent_data.nom_agent,
        "email": agent_data.email.lower(),
        "phone": agent_data.telephone,
        "commission_percent": agent_data.commission_percent,
        "max_credit_limit": agent_data.limite_credit,
        "max_win_limit": agent_data.limite_gain,
        "status": "active" if agent_data.status == "ACTIVE" else "suspended",
        "created_at": now,
        "updated_at": now
    }
    await db.agent_policies.insert_one(policy_doc)
    
    # 3. Create agent balance
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
        "created_at": now,
        "updated_at": now
    }
    await db.agent_balances.insert_one(balance_doc)
    
    # 4. Update company counters
    await update_company_agent_count(company_id)
    
    # 5. Log activity
    await log_activity(
        db=db,
        action_type="AGENT_CREATED",
        entity_type="agent",
        entity_id=agent_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "agent_name": agent_name,
            "agent_email": agent_data.email,
            "succursale_id": succursale_id,
            "succursale_name": succursale.get("nom_succursale"),
            "company_name": company_name
        },
        ip_address=request.client.host if request.client else None
    )
    
    # 6. Notification for Super Admin
    notification_doc = {
        "notification_id": generate_id("notif_"),
        "type": "AGENT_CREATED",
        "target_role": "SUPER_ADMIN",
        "company_id": company_id,
        "company_name": company_name,
        "message": f"Nouvel agent '{agent_name}' créé dans {succursale.get('nom_succursale')}",
        "metadata": {
            "agent_id": agent_id,
            "agent_email": agent_data.email,
            "succursale_id": succursale_id
        },
        "read": False,
        "created_at": now
    }
    await db.admin_notifications.insert_one(notification_doc)
    
    return {
        "message": "Agent créé avec succès",
        "agent_id": agent_id,
        "email": agent_data.email.lower(),
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
    
    agent = await db.users.find_one({
        "user_id": agent_id,
        "succursale_id": succursale_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS
    })
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
    
    now = get_current_timestamp()
    
    # Update user record
    user_updates = {"updated_at": now}
    if "nom_agent" in update_data or "prenom_agent" in update_data:
        policy = await db.agent_policies.find_one({"agent_id": agent_id}, {"_id": 0})
        first = update_data.get("prenom_agent", policy.get("first_name", "") if policy else "")
        last = update_data.get("nom_agent", policy.get("last_name", "") if policy else "")
        user_updates["name"] = f"{first} {last}"
    
    if "status" in update_data:
        user_updates["status"] = update_data["status"]
    
    if "telephone" in update_data:
        user_updates["telephone"] = update_data["telephone"]
    
    await db.users.update_one({"user_id": agent_id}, {"$set": user_updates})
    
    # Update policy
    policy_updates = {"updated_at": now}
    field_map = {
        "nom_agent": "last_name",
        "prenom_agent": "first_name",
        "telephone": "phone",
        "commission_percent": "commission_percent",
        "limite_credit": "max_credit_limit",
        "limite_gain": "max_win_limit"
    }
    
    for src, dest in field_map.items():
        if src in update_data:
            policy_updates[dest] = update_data[src]
    
    if "status" in update_data:
        policy_updates["status"] = "active" if update_data["status"] == "ACTIVE" else "suspended"
    
    await db.agent_policies.update_one({"agent_id": agent_id}, {"$set": policy_updates})
    
    # Update balance limit
    if "limite_credit" in update_data:
        await db.agent_balances.update_one(
            {"agent_id": agent_id},
            {"$set": {"credit_limit": update_data["limite_credit"], "updated_at": now}}
        )
    
    # Update company counters
    await update_company_agent_count(company_id)
    
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


@succursale_router.put("/{succursale_id}/agents/{agent_id}/suspend")
async def suspend_agent(
    succursale_id: str,
    agent_id: str,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Suspend an agent"""
    company_id = require_admin(current_user)
    
    agent = await db.users.find_one({
        "user_id": agent_id,
        "succursale_id": succursale_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS
    })
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé")
    
    now = get_current_timestamp()
    
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": {"status": "SUSPENDED", "updated_at": now}}
    )
    
    await db.agent_policies.update_one(
        {"agent_id": agent_id},
        {"$set": {"status": "suspended", "updated_at": now}}
    )
    
    await update_company_agent_count(company_id)
    
    await log_activity(
        db=db,
        action_type="AGENT_SUSPENDED",
        entity_type="agent",
        entity_id=agent_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"agent_name": agent.get("name"), "succursale_id": succursale_id},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Agent suspendu"}


@succursale_router.delete("/{succursale_id}/agents/{agent_id}")
async def delete_agent_from_succursale(
    succursale_id: str,
    agent_id: str,
    request: Request,
    current_user: dict = Depends(get_company_admin)
):
    """Delete (soft) an agent"""
    company_id = require_admin(current_user)
    
    agent = await db.users.find_one({
        "user_id": agent_id,
        "succursale_id": succursale_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS
    })
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé")
    
    now = get_current_timestamp()
    
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": {"status": "DELETED", "updated_at": now}}
    )
    
    await db.agent_policies.update_one(
        {"agent_id": agent_id},
        {"$set": {"status": "deleted", "updated_at": now}}
    )
    
    await update_company_agent_count(company_id)
    
    await log_activity(
        db=db,
        action_type="AGENT_DELETED",
        entity_type="agent",
        entity_id=agent_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"agent_name": agent.get("name"), "succursale_id": succursale_id},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Agent supprimé"}
