"""
LOTTOLAB SaaS Enterprise Core System
Multi-tenant isolation, centralized lottery catalog, global schedules
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, EmailStr
import asyncio

from models import UserRole
from auth import decode_token, get_password_hash
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

saas_core_router = APIRouter(prefix="/api/saas", tags=["SaaS Core"])
security = HTTPBearer()

db = None

def set_saas_core_db(database):
    global db
    db = database


# ============================================================================
# MULTI-TENANT MIDDLEWARE / GUARDS
# ============================================================================

class MultiTenantGuard:
    """
    Enforces company_id isolation on all queries.
    Super Admin bypasses all restrictions.
    """
    
    @staticmethod
    async def get_user_context(token: str) -> dict:
        """Extract user context from token"""
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Token invalide")
        
        user_id = payload.get("user_id")
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
        
        # Check if user is suspended or deleted
        if user.get("status") in ["SUSPENDED", "DELETED"]:
            raise HTTPException(status_code=403, detail="Compte suspendu ou supprimé")
        
        return user
    
    @staticmethod
    def is_super_admin(user: dict) -> bool:
        return user.get("role") == UserRole.SUPER_ADMIN
    
    @staticmethod
    def get_company_id(user: dict) -> Optional[str]:
        """Get company_id - None for super admin (can see all)"""
        if MultiTenantGuard.is_super_admin(user):
            return None  # Super admin sees all
        return user.get("company_id")
    
    @staticmethod
    def enforce_company_access(user: dict, target_company_id: str):
        """Raise error if user tries to access another company's data"""
        if MultiTenantGuard.is_super_admin(user):
            return  # Super admin can access any
        
        if user.get("company_id") != target_company_id:
            raise HTTPException(status_code=403, detail="Accès interdit à cette entreprise")
    
    @staticmethod
    async def check_license_valid(company_id: str) -> bool:
        """Check if company license is valid"""
        company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
        if not company:
            return False
        
        # Check status
        if company.get("status") in ["SUSPENDED", "EXPIRED"]:
            return False
        
        # Check expiration date
        exp_date = company.get("license_end") or company.get("expiration_date")
        if exp_date:
            try:
                exp = datetime.fromisoformat(exp_date.replace("Z", "+00:00"))
                if exp < datetime.now(timezone.utc):
                    # Auto-update status to EXPIRED
                    await db.companies.update_one(
                        {"company_id": company_id},
                        {"$set": {"status": "EXPIRED", "updated_at": get_current_timestamp()}}
                    )
                    return False
            except:
                pass
        
        return True


async def get_authenticated_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Standard auth dependency with license check"""
    user = await MultiTenantGuard.get_user_context(credentials.credentials)
    
    # Check license for non-super-admin users
    if not MultiTenantGuard.is_super_admin(user) and user.get("company_id"):
        if not await MultiTenantGuard.check_license_valid(user["company_id"]):
            raise HTTPException(status_code=403, detail="License expirée ou suspendue. Contactez l'administrateur.")
    
    return user


async def require_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require SUPER_ADMIN role"""
    user = await MultiTenantGuard.get_user_context(credentials.credentials)
    if not MultiTenantGuard.is_super_admin(user):
        raise HTTPException(status_code=403, detail="Accès Super Admin requis")
    return user


# ============================================================================
# MASTER LOTTERIES (190 GLOBAL LOTTERIES)
# ============================================================================

class MasterLotteryCreate(BaseModel):
    lottery_name: str
    state_code: str
    state_name: str
    country: str = "USA"
    game_type: str  # PICK3, PICK4, BORLETTE, etc.
    category: str = "STANDARD"  # STANDARD, PREMIUM, SPECIAL
    default_draw_times: List[str] = []  # ["12:00", "19:00", "21:00"]
    description: Optional[str] = None
    is_active_global: bool = True


class MasterLotteryUpdate(BaseModel):
    lottery_name: Optional[str] = None
    game_type: Optional[str] = None
    category: Optional[str] = None
    default_draw_times: Optional[List[str]] = None
    description: Optional[str] = None
    is_active_global: Optional[bool] = None


@saas_core_router.get("/master-lotteries")
async def get_master_lotteries(
    current_user: dict = Depends(get_authenticated_user),
    active_only: bool = False
):
    """
    Get all master lotteries.
    Super Admin: sees all (190)
    Company Admin/Agent: sees only globally active ones
    """
    query = {}
    
    # Non-super-admin only sees active lotteries
    if not MultiTenantGuard.is_super_admin(current_user):
        query["is_active_global"] = True
    elif active_only:
        query["is_active_global"] = True
    
    lotteries = await db.master_lotteries.find(query, {"_id": 0}).sort("lottery_name", 1).to_list(500)
    return lotteries


@saas_core_router.get("/master-lotteries/{lottery_id}")
async def get_master_lottery(lottery_id: str, current_user: dict = Depends(get_authenticated_user)):
    """Get single master lottery"""
    lottery = await db.master_lotteries.find_one({"lottery_id": lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    # Non-super-admin can't see inactive lotteries
    if not MultiTenantGuard.is_super_admin(current_user) and not lottery.get("is_active_global"):
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    return lottery


@saas_core_router.post("/master-lotteries")
async def create_master_lottery(
    data: MasterLotteryCreate,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Create new master lottery (Super Admin only)"""
    lottery_id = generate_id("lot_")
    now = get_current_timestamp()
    
    lottery_doc = {
        "lottery_id": lottery_id,
        "lottery_name": data.lottery_name,
        "state_code": data.state_code,
        "state_name": data.state_name,
        "country": data.country,
        "game_type": data.game_type,
        "category": data.category,
        "default_draw_times": data.default_draw_times,
        "description": data.description,
        "is_active_global": data.is_active_global,
        "created_at": now,
        "updated_at": now
    }
    
    await db.master_lotteries.insert_one(lottery_doc)
    
    # If active, auto-enable for all companies
    if data.is_active_global:
        await sync_lottery_to_all_companies(lottery_id, data.lottery_name, data.state_code)
    
    await log_activity(
        db=db,
        action_type="MASTER_LOTTERY_CREATED",
        entity_type="master_lottery",
        entity_id=lottery_id,
        performed_by=current_user["user_id"],
        metadata={"lottery_name": data.lottery_name, "state_code": data.state_code},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Loterie créée", "lottery_id": lottery_id}


@saas_core_router.put("/master-lotteries/{lottery_id}")
async def update_master_lottery(
    lottery_id: str,
    updates: MasterLotteryUpdate,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Update master lottery (Super Admin only)"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ à modifier")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.master_lotteries.update_one(
        {"lottery_id": lottery_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    # If is_active_global changed, sync to all companies
    if "is_active_global" in update_data:
        if update_data["is_active_global"]:
            # Activating - enable for all companies
            lottery = await db.master_lotteries.find_one({"lottery_id": lottery_id}, {"_id": 0})
            await sync_lottery_to_all_companies(lottery_id, lottery.get("lottery_name"), lottery.get("state_code"))
        else:
            # Deactivating - disable for ALL companies automatically
            await db.company_lotteries.update_many(
                {"lottery_id": lottery_id},
                {"$set": {
                    "is_enabled": False,
                    "disabled_by_super_admin": True,
                    "updated_at": get_current_timestamp()
                }}
            )
    
    await log_activity(
        db=db,
        action_type="MASTER_LOTTERY_UPDATED",
        entity_type="master_lottery",
        entity_id=lottery_id,
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Loterie mise à jour"}


@saas_core_router.put("/master-lotteries/{lottery_id}/toggle-global")
async def toggle_lottery_global(
    lottery_id: str,
    is_active: bool,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """
    Toggle global lottery status.
    If deactivated: AUTO-DISABLE for ALL companies.
    If activated: Make available for companies to enable.
    """
    lottery = await db.master_lotteries.find_one({"lottery_id": lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    now = get_current_timestamp()
    
    # Update master lottery
    await db.master_lotteries.update_one(
        {"lottery_id": lottery_id},
        {"$set": {"is_active_global": is_active, "updated_at": now}}
    )
    
    if is_active:
        # Make available to all companies
        await sync_lottery_to_all_companies(lottery_id, lottery.get("lottery_name"), lottery.get("state_code"))
        message = "Loterie activée globalement"
    else:
        # Force disable for ALL companies
        result = await db.company_lotteries.update_many(
            {"lottery_id": lottery_id},
            {"$set": {
                "is_enabled": False,
                "disabled_by_super_admin": True,
                "updated_at": now
            }}
        )
        message = f"Loterie désactivée globalement ({result.modified_count} companies affectées)"
    
    await log_activity(
        db=db,
        action_type="LOTTERY_GLOBAL_TOGGLED",
        entity_type="master_lottery",
        entity_id=lottery_id,
        performed_by=current_user["user_id"],
        metadata={"is_active": is_active, "lottery_name": lottery.get("lottery_name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": message}


async def sync_lottery_to_all_companies(lottery_id: str, lottery_name: str, state_code: str):
    """Create company_lottery entry for all active companies"""
    companies = await db.companies.find(
        {"status": {"$in": ["ACTIVE", "TRIAL"]}},
        {"_id": 0, "company_id": 1}
    ).to_list(1000)
    
    now = get_current_timestamp()
    
    for company in companies:
        # Upsert - create if not exists
        await db.company_lotteries.update_one(
            {"company_id": company["company_id"], "lottery_id": lottery_id},
            {"$set": {
                "lottery_name": lottery_name,
                "state_code": state_code,
                "disabled_by_super_admin": False,
                "updated_at": now
            },
            "$setOnInsert": {
                "id": generate_id("cl_"),
                "company_id": company["company_id"],
                "lottery_id": lottery_id,
                "is_enabled": True,  # Default enabled when synced
                "created_at": now
            }},
            upsert=True
        )


# ============================================================================
# COMPANY LOTTERY MANAGEMENT (PIVOT TABLE)
# ============================================================================

@saas_core_router.get("/company-lotteries")
async def get_company_lotteries(
    current_user: dict = Depends(get_authenticated_user),
    company_id: Optional[str] = None
):
    """
    Get lotteries available for a company.
    Company Admin: sees own company's lotteries
    Super Admin: can specify company_id to see any company
    """
    # Determine which company to query
    if MultiTenantGuard.is_super_admin(current_user):
        target_company = company_id
        if not target_company:
            raise HTTPException(status_code=400, detail="company_id requis pour Super Admin")
    else:
        target_company = current_user["company_id"]
        if company_id and company_id != target_company:
            raise HTTPException(status_code=403, detail="Accès interdit")
    
    # Get company lotteries with master lottery join
    company_lotteries = await db.company_lotteries.find(
        {"company_id": target_company},
        {"_id": 0}
    ).to_list(500)
    
    # Enrich with master lottery data
    enriched = []
    for cl in company_lotteries:
        master = await db.master_lotteries.find_one(
            {"lottery_id": cl["lottery_id"]},
            {"_id": 0}
        )
        if master:
            enriched.append({
                **cl,
                "lottery_name": master.get("lottery_name"),
                "state_code": master.get("state_code"),
                "state_name": master.get("state_name"),
                "game_type": master.get("game_type"),
                "category": master.get("category"),
                "is_active_global": master.get("is_active_global", False),
                # Company can only enable if global is active AND not disabled by super admin
                "can_enable": master.get("is_active_global", False) and not cl.get("disabled_by_super_admin", False)
            })
    
    return enriched


@saas_core_router.put("/company-lotteries/{lottery_id}/toggle")
async def toggle_company_lottery(
    lottery_id: str,
    is_enabled: bool,
    request: Request,
    current_user: dict = Depends(get_authenticated_user),
    company_id: Optional[str] = None
):
    """
    Enable/disable lottery for company.
    Company Admin: can only toggle for own company
    Super Admin: can toggle for any company
    """
    # Determine target company
    if MultiTenantGuard.is_super_admin(current_user):
        target_company = company_id or current_user.get("company_id")
        if not target_company:
            raise HTTPException(status_code=400, detail="company_id requis")
    else:
        target_company = current_user["company_id"]
    
    # Check if master lottery is active
    master = await db.master_lotteries.find_one({"lottery_id": lottery_id}, {"_id": 0})
    if not master:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    if not master.get("is_active_global") and is_enabled:
        raise HTTPException(status_code=400, detail="Cette loterie est désactivée globalement par Super Admin")
    
    # Check if disabled by super admin
    cl = await db.company_lotteries.find_one(
        {"company_id": target_company, "lottery_id": lottery_id},
        {"_id": 0}
    )
    
    if cl and cl.get("disabled_by_super_admin") and is_enabled and not MultiTenantGuard.is_super_admin(current_user):
        raise HTTPException(status_code=400, detail="Cette loterie a été désactivée par Super Admin")
    
    now = get_current_timestamp()
    
    # Update or create
    await db.company_lotteries.update_one(
        {"company_id": target_company, "lottery_id": lottery_id},
        {"$set": {
            "is_enabled": is_enabled,
            "updated_at": now,
            "lottery_name": master.get("lottery_name"),
            "state_code": master.get("state_code")
        },
        "$setOnInsert": {
            "id": generate_id("cl_"),
            "company_id": target_company,
            "lottery_id": lottery_id,
            "disabled_by_super_admin": False,
            "created_at": now
        }},
        upsert=True
    )
    
    await log_activity(
        db=db,
        action_type="COMPANY_LOTTERY_TOGGLED",
        entity_type="company_lottery",
        entity_id=lottery_id,
        performed_by=current_user["user_id"],
        company_id=target_company,
        metadata={"is_enabled": is_enabled, "lottery_name": master.get("lottery_name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Loterie {'activée' if is_enabled else 'désactivée'} pour l'entreprise"}


# ============================================================================
# GLOBAL SCHEDULES (SUPER ADMIN ONLY - CRUD)
# ============================================================================

class GlobalScheduleCreate(BaseModel):
    lottery_id: str
    draw_name: str  # "Midday", "Evening", "Night"
    days_of_week: List[int] = []  # 0=Monday, 6=Sunday, empty=all
    open_time: str  # HH:MM
    close_time: str  # HH:MM
    draw_time: str  # HH:MM
    stop_sales_before_minutes: int = 5
    is_active: bool = True


class GlobalScheduleUpdate(BaseModel):
    draw_name: Optional[str] = None
    days_of_week: Optional[List[int]] = None
    open_time: Optional[str] = None
    close_time: Optional[str] = None
    draw_time: Optional[str] = None
    stop_sales_before_minutes: Optional[int] = None
    is_active: Optional[bool] = None


@saas_core_router.get("/global-schedules")
async def get_global_schedules(
    current_user: dict = Depends(get_authenticated_user),
    lottery_id: Optional[str] = None,
    active_only: bool = True
):
    """
    Get global schedules.
    Super Admin: sees all
    Company Admin/Agent: sees only schedules for lotteries they have enabled
    """
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    if active_only:
        query["is_active"] = True
    
    # Non-super-admin: filter by company's enabled lotteries
    if not MultiTenantGuard.is_super_admin(current_user):
        company_id = current_user["company_id"]
        enabled_lotteries = await db.company_lotteries.distinct(
            "lottery_id",
            {"company_id": company_id, "is_enabled": True}
        )
        query["lottery_id"] = {"$in": enabled_lotteries}
    
    schedules = await db.global_schedules.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with lottery names
    for schedule in schedules:
        lottery = await db.master_lotteries.find_one(
            {"lottery_id": schedule["lottery_id"]},
            {"_id": 0, "lottery_name": 1, "state_code": 1}
        )
        if lottery:
            schedule["lottery_name"] = lottery.get("lottery_name")
            schedule["state_code"] = lottery.get("state_code")
    
    return schedules


@saas_core_router.get("/global-schedules/{schedule_id}")
async def get_global_schedule(
    schedule_id: str,
    current_user: dict = Depends(get_authenticated_user)
):
    """Get single global schedule"""
    schedule = await db.global_schedules.find_one({"schedule_id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule non trouvé")
    
    # Non-super-admin: verify they have access to this lottery
    if not MultiTenantGuard.is_super_admin(current_user):
        company_id = current_user["company_id"]
        cl = await db.company_lotteries.find_one({
            "company_id": company_id,
            "lottery_id": schedule["lottery_id"],
            "is_enabled": True
        })
        if not cl:
            raise HTTPException(status_code=403, detail="Accès non autorisé à ce schedule")
    
    return schedule


@saas_core_router.post("/global-schedules")
async def create_global_schedule(
    data: GlobalScheduleCreate,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Create global schedule (Super Admin ONLY)"""
    # Verify lottery exists
    lottery = await db.master_lotteries.find_one({"lottery_id": data.lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    schedule_id = generate_id("sched_")
    now = get_current_timestamp()
    
    schedule_doc = {
        "schedule_id": schedule_id,
        "lottery_id": data.lottery_id,
        "lottery_name": lottery.get("lottery_name"),
        "draw_name": data.draw_name,
        "days_of_week": data.days_of_week,
        "open_time": data.open_time,
        "close_time": data.close_time,
        "draw_time": data.draw_time,
        "stop_sales_before_minutes": data.stop_sales_before_minutes,
        "is_active": data.is_active,
        "created_by": current_user["user_id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.global_schedules.insert_one(schedule_doc)
    
    await log_activity(
        db=db,
        action_type="GLOBAL_SCHEDULE_CREATED",
        entity_type="global_schedule",
        entity_id=schedule_id,
        performed_by=current_user["user_id"],
        metadata={
            "lottery_name": lottery.get("lottery_name"),
            "draw_name": data.draw_name,
            "draw_time": data.draw_time
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Schedule créé", "schedule_id": schedule_id}


@saas_core_router.put("/global-schedules/{schedule_id}")
async def update_global_schedule(
    schedule_id: str,
    updates: GlobalScheduleUpdate,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Update global schedule (Super Admin ONLY)"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ à modifier")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.master_lotteries.update_one(
        {"schedule_id": schedule_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Schedule non trouvé")
    
    await log_activity(
        db=db,
        action_type="GLOBAL_SCHEDULE_UPDATED",
        entity_type="global_schedule",
        entity_id=schedule_id,
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Schedule mis à jour"}


@saas_core_router.delete("/global-schedules/{schedule_id}")
async def delete_global_schedule(
    schedule_id: str,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Delete global schedule (Super Admin ONLY)"""
    result = await db.global_schedules.delete_one({"schedule_id": schedule_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule non trouvé")
    
    await log_activity(
        db=db,
        action_type="GLOBAL_SCHEDULE_DELETED",
        entity_type="global_schedule",
        entity_id=schedule_id,
        performed_by=current_user["user_id"],
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Schedule supprimé"}


# ============================================================================
# COMPANY SCHEDULES - READ ONLY FOR COMPANY ADMIN
# ============================================================================

@saas_core_router.get("/company-schedules")
async def get_company_schedules(
    current_user: dict = Depends(get_authenticated_user),
    lottery_id: Optional[str] = None
):
    """
    Get schedules available for a company (READ ONLY).
    Returns global schedules filtered by company's enabled lotteries.
    """
    if MultiTenantGuard.is_super_admin(current_user):
        raise HTTPException(status_code=400, detail="Utilisez /global-schedules pour Super Admin")
    
    company_id = current_user["company_id"]
    
    # Get enabled lotteries for this company
    query = {"company_id": company_id, "is_enabled": True}
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    enabled_lotteries = await db.company_lotteries.distinct("lottery_id", query)
    
    # Get global schedules for these lotteries
    schedules = await db.global_schedules.find(
        {"lottery_id": {"$in": enabled_lotteries}, "is_active": True},
        {"_id": 0}
    ).to_list(500)
    
    return schedules


# ============================================================================
# COMPANY CREATION WITH FULL AUTO-SETUP
# ============================================================================

class CompanyFullCreate(BaseModel):
    company_name: str
    slogan: Optional[str] = None
    contact_email: EmailStr  # This becomes admin login
    admin_password: str
    admin_name: Optional[str] = None
    plan_id: Optional[str] = None
    timezone: str = "America/Port-au-Prince"
    currency: str = "HTG"
    default_commission_rate: float = 10.0
    max_agents: int = 50
    max_daily_sales: float = 1000000.0


@saas_core_router.post("/companies/full-create")
async def create_company_full(
    data: CompanyFullCreate,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """
    Create company with FULL auto-setup:
    1. Create company record
    2. Create Company Admin user
    3. Create default configuration
    4. Link ALL active global lotteries
    5. Create activity logs
    """
    # Check if company name exists
    existing = await db.companies.find_one({"name": data.company_name})
    if existing:
        raise HTTPException(status_code=400, detail="Ce nom d'entreprise existe déjà")
    
    # Check if email exists
    existing_user = await db.users.find_one({"email": data.contact_email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    now = get_current_timestamp()
    company_id = generate_id("comp_")
    admin_user_id = generate_id("user_")
    
    # 1. Create company
    slug = data.company_name.lower().replace(" ", "-").replace("'", "")
    company_doc = {
        "company_id": company_id,
        "name": data.company_name,
        "slug": slug,
        "slogan": data.slogan,
        "contact_email": data.contact_email,
        "timezone": data.timezone,
        "currency": data.currency,
        "default_commission_rate": data.default_commission_rate,
        "max_agents": data.max_agents,
        "max_daily_sales": data.max_daily_sales,
        "plan": data.plan_id or "Basic",
        "status": "ACTIVE",
        "license_start": now,
        "license_end": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
        "agents_count": 0,
        "tickets_today": 0,
        "total_sales": 0.0,
        "is_online": False,
        "last_heartbeat": None,
        "created_at": now,
        "updated_at": now
    }
    await db.companies.insert_one(company_doc)
    
    # 2. Create Company Admin user
    admin_doc = {
        "user_id": admin_user_id,
        "email": data.contact_email,
        "password_hash": get_password_hash(data.admin_password),
        "name": data.admin_name or f"Admin {data.company_name}",
        "role": UserRole.COMPANY_ADMIN,
        "company_id": company_id,
        "status": "ACTIVE",
        "permissions": ["full_access"],
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(admin_doc)
    
    # 3. Create default company configuration
    config_id = generate_id("config_")
    config_doc = {
        "config_id": config_id,
        "company_id": company_id,
        "min_bet_amount": 10.0,
        "max_bet_amount": 10000.0,
        "max_bet_per_number": 5000.0,
        "max_bet_per_agent": 50000.0,
        "agent_commission_percent": data.default_commission_rate,
        "stop_sales_before_draw_minutes": 5,
        "allow_ticket_void": True,
        "void_window_minutes": 5,
        "auto_print_ticket": True,
        "receipt_header": data.company_name,
        "receipt_footer": "Merci pour votre achat!",
        "created_at": now,
        "updated_at": now
    }
    await db.company_configurations.insert_one(config_doc)
    
    # 4. Link ALL active global lotteries
    active_lotteries = await db.master_lotteries.find(
        {"is_active_global": True},
        {"_id": 0, "lottery_id": 1, "lottery_name": 1, "state_code": 1}
    ).to_list(500)
    
    for lottery in active_lotteries:
        cl_doc = {
            "id": generate_id("cl_"),
            "company_id": company_id,
            "lottery_id": lottery["lottery_id"],
            "lottery_name": lottery.get("lottery_name"),
            "state_code": lottery.get("state_code"),
            "is_enabled": True,
            "disabled_by_super_admin": False,
            "created_at": now,
            "updated_at": now
        }
        await db.company_lotteries.insert_one(cl_doc)
    
    # 5. Create config version tracker
    await db.company_config_versions.insert_one({
        "company_id": company_id,
        "version": 1,
        "last_updated_at": now
    })
    
    # 6. Log activity
    await log_activity(
        db=db,
        action_type="COMPANY_FULL_CREATED",
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "company_name": data.company_name,
            "admin_email": data.contact_email,
            "lotteries_linked": len(active_lotteries)
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": "Entreprise créée avec succès",
        "company_id": company_id,
        "admin_user_id": admin_user_id,
        "admin_email": data.contact_email,
        "lotteries_enabled": len(active_lotteries)
    }


# ============================================================================
# HEARTBEAT ONLINE SYSTEM
# ============================================================================

@saas_core_router.post("/heartbeat/company")
async def company_heartbeat(current_user: dict = Depends(get_authenticated_user)):
    """Company heartbeat - call every 30 seconds"""
    if MultiTenantGuard.is_super_admin(current_user):
        return {"status": "ok", "role": "super_admin"}
    
    company_id = current_user["company_id"]
    now = get_current_timestamp()
    
    await db.companies.update_one(
        {"company_id": company_id},
        {"$set": {"last_heartbeat": now, "is_online": True}}
    )
    
    return {"status": "ok", "timestamp": now}


@saas_core_router.post("/heartbeat/agent")
async def agent_heartbeat(current_user: dict = Depends(get_authenticated_user)):
    """Agent heartbeat - call every 30 seconds"""
    user_id = current_user["user_id"]
    now = get_current_timestamp()
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"last_heartbeat": now, "is_online": True}}
    )
    
    return {"status": "ok", "timestamp": now}


@saas_core_router.get("/online-status")
async def get_online_status(current_user: dict = Depends(require_super_admin)):
    """Get online status of all companies and agents (Super Admin only)"""
    now = datetime.now(timezone.utc)
    offline_threshold = now - timedelta(minutes=2)
    threshold_str = offline_threshold.isoformat()
    
    # Update offline status for companies
    await db.companies.update_many(
        {"last_heartbeat": {"$lt": threshold_str}, "is_online": True},
        {"$set": {"is_online": False}}
    )
    
    # Update offline status for agents
    await db.users.update_many(
        {"last_heartbeat": {"$lt": threshold_str}, "is_online": True, "role": UserRole.AGENT_POS},
        {"$set": {"is_online": False}}
    )
    
    # Get online companies
    online_companies = await db.companies.find(
        {"is_online": True},
        {"_id": 0, "company_id": 1, "name": 1, "last_heartbeat": 1}
    ).to_list(500)
    
    # Get online agents
    online_agents = await db.users.find(
        {"is_online": True, "role": UserRole.AGENT_POS},
        {"_id": 0, "user_id": 1, "name": 1, "company_id": 1, "last_heartbeat": 1}
    ).to_list(500)
    
    # Enrich agents with company names
    for agent in online_agents:
        company = await db.companies.find_one(
            {"company_id": agent.get("company_id")},
            {"_id": 0, "name": 1}
        )
        agent["company_name"] = company.get("name") if company else "N/A"
    
    return {
        "companies_online": len(online_companies),
        "agents_online": len(online_agents),
        "companies": online_companies,
        "agents": online_agents
    }


# ============================================================================
# LICENSE MANAGEMENT
# ============================================================================

@saas_core_router.put("/companies/{company_id}/suspend")
async def suspend_company(
    company_id: str,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Suspend a company (Super Admin only)"""
    result = await db.companies.update_one(
        {"company_id": company_id},
        {"$set": {"status": "SUSPENDED", "updated_at": get_current_timestamp()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    await log_activity(
        db=db,
        action_type="COMPANY_SUSPENDED",
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Entreprise suspendue"}


@saas_core_router.put("/companies/{company_id}/activate")
async def activate_company(
    company_id: str,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Activate a company (Super Admin only)"""
    result = await db.companies.update_one(
        {"company_id": company_id},
        {"$set": {"status": "ACTIVE", "updated_at": get_current_timestamp()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    await log_activity(
        db=db,
        action_type="COMPANY_ACTIVATED",
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Entreprise activée"}


@saas_core_router.put("/companies/{company_id}/extend-license")
async def extend_company_license(
    company_id: str,
    days: int,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Extend company license (Super Admin only)"""
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    # Calculate new expiration
    current_end = company.get("license_end")
    if current_end:
        try:
            base = datetime.fromisoformat(current_end.replace("Z", "+00:00"))
        except:
            base = datetime.now(timezone.utc)
    else:
        base = datetime.now(timezone.utc)
    
    new_end = (base + timedelta(days=days)).isoformat()
    
    await db.companies.update_one(
        {"company_id": company_id},
        {"$set": {
            "license_end": new_end,
            "status": "ACTIVE",
            "updated_at": get_current_timestamp()
        }}
    )
    
    await log_activity(
        db=db,
        action_type="LICENSE_EXTENDED",
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"days_added": days, "new_expiration": new_end},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"License étendue de {days} jours", "new_expiration": new_end}



# ============================================================================
# COMPANY CRUD - EDIT / DELETE
# ============================================================================

class CompanyUpdate(BaseModel):
    """Update company details"""
    company_name: Optional[str] = None
    slogan: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    plan: Optional[str] = None
    default_commission_rate: Optional[float] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    max_agents: Optional[int] = None
    max_daily_sales: Optional[float] = None


@saas_core_router.get("/companies")
async def get_all_companies(current_user: dict = Depends(require_super_admin)):
    """Get all companies with full stats (Super Admin only)"""
    companies = await db.companies.find(
        {"status": {"$ne": "DELETED"}},
        {"_id": 0}
    ).to_list(500)
    
    now = datetime.now(timezone.utc)
    
    for company in companies:
        company_id = company["company_id"]
        
        # Agent count
        agents_count = await db.users.count_documents({
            "company_id": company_id,
            "role": UserRole.AGENT_POS,
            "status": {"$ne": "DELETED"}
        })
        company["agents_count"] = agents_count
        
        # Active agents
        active_agents = await db.users.count_documents({
            "company_id": company_id,
            "role": UserRole.AGENT_POS,
            "status": "ACTIVE"
        })
        company["active_agents"] = active_agents
        
        # Suspended agents
        company["suspended_agents"] = agents_count - active_agents
        
        # Succursales count
        succursales_count = await db.succursales.count_documents({
            "company_id": company_id,
            "status": {"$ne": "DELETED"}
        })
        company["succursales_count"] = succursales_count
        
        # Calculate remaining days
        license_end = company.get("license_end") or company.get("subscription_end_date")
        if license_end:
            try:
                end_date = datetime.fromisoformat(license_end.replace("Z", "+00:00"))
                remaining = (end_date - now).days
                company["remaining_days"] = max(0, remaining)
                
                # Auto-expire if needed
                if remaining < 0 and company.get("status") == "ACTIVE":
                    await db.companies.update_one(
                        {"company_id": company_id},
                        {"$set": {"status": "EXPIRED", "updated_at": get_current_timestamp()}}
                    )
                    company["status"] = "EXPIRED"
            except:
                company["remaining_days"] = 30
        else:
            company["remaining_days"] = 30
        
        # Today's sales (simplified)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        pipeline = [
            {"$match": {"company_id": company_id, "created_at": {"$gte": today_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]
        sales = await db.lottery_transactions.aggregate(pipeline).to_list(1)
        company["sales_today"] = sales[0]["total"] if sales else 0
    
    return companies


@saas_core_router.get("/companies/{company_id}")
async def get_company_detail(
    company_id: str,
    current_user: dict = Depends(require_super_admin)
):
    """Get single company details with all stats"""
    company = await db.companies.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    now = datetime.now(timezone.utc)
    
    # All agents
    agents = await db.users.find(
        {"company_id": company_id, "role": UserRole.AGENT_POS, "status": {"$ne": "DELETED"}},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    company["agents"] = agents
    company["agents_count"] = len(agents)
    company["active_agents"] = len([a for a in agents if a.get("status") == "ACTIVE"])
    company["suspended_agents"] = len([a for a in agents if a.get("status") == "SUSPENDED"])
    
    # Succursales
    succursales = await db.succursales.find(
        {"company_id": company_id, "status": {"$ne": "DELETED"}},
        {"_id": 0}
    ).to_list(100)
    company["succursales"] = succursales
    company["succursales_count"] = len(succursales)
    
    # Remaining days
    license_end = company.get("license_end") or company.get("subscription_end_date")
    if license_end:
        try:
            end_date = datetime.fromisoformat(license_end.replace("Z", "+00:00"))
            company["remaining_days"] = max(0, (end_date - now).days)
        except:
            company["remaining_days"] = 30
    else:
        company["remaining_days"] = 30
    
    return company


@saas_core_router.put("/companies/{company_id}")
async def update_company(
    company_id: str,
    updates: CompanyUpdate,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Update company details (Super Admin only)"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ à modifier")
    
    # Map field names if needed
    if "company_name" in update_data:
        update_data["name"] = update_data.pop("company_name")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.companies.update_one(
        {"company_id": company_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    await log_activity(
        db=db,
        action_type="COMPANY_UPDATED",
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Entreprise mise à jour"}


@saas_core_router.delete("/companies/{company_id}")
async def delete_company(
    company_id: str,
    hard_delete: bool = False,
    request: Request = None,
    current_user: dict = Depends(require_super_admin)
):
    """Delete company (soft or hard delete)"""
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    now = get_current_timestamp()
    
    if hard_delete:
        # Hard delete - remove all data
        await db.companies.delete_one({"company_id": company_id})
        await db.users.delete_many({"company_id": company_id})
        await db.succursales.delete_many({"company_id": company_id})
        await db.agent_policies.delete_many({"company_id": company_id})
        await db.agent_balances.delete_many({"company_id": company_id})
        await db.company_lotteries.delete_many({"company_id": company_id})
        await db.company_configurations.delete_many({"company_id": company_id})
        message = "Entreprise supprimée définitivement"
    else:
        # Soft delete - mark as deleted
        await db.companies.update_one(
            {"company_id": company_id},
            {"$set": {"status": "DELETED", "updated_at": now}}
        )
        
        # Suspend all users
        await db.users.update_many(
            {"company_id": company_id},
            {"$set": {"status": "SUSPENDED", "updated_at": now}}
        )
        message = "Entreprise désactivée"
    
    await log_activity(
        db=db,
        action_type="COMPANY_DELETED",
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"hard_delete": hard_delete, "company_name": company.get("name")},
        ip_address=request.client.host if request and request.client else None
    )
    
    return {"message": message}


# ============================================================================
# SUBSCRIPTION MANAGEMENT
# ============================================================================

@saas_core_router.get("/companies/{company_id}/subscription")
async def get_company_subscription(
    company_id: str,
    current_user: dict = Depends(require_super_admin)
):
    """Get company subscription details"""
    company = await db.companies.find_one(
        {"company_id": company_id},
        {"_id": 0, "company_id": 1, "name": 1, "plan": 1, "status": 1, 
         "license_start": 1, "license_end": 1, "subscription_start_date": 1, 
         "subscription_end_date": 1, "subscription_status": 1}
    )
    
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    now = datetime.now(timezone.utc)
    
    # Get dates
    start_date = company.get("license_start") or company.get("subscription_start_date")
    end_date = company.get("license_end") or company.get("subscription_end_date")
    
    remaining_days = 0
    if end_date:
        try:
            end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            remaining_days = max(0, (end - now).days)
        except:
            remaining_days = 30
    
    return {
        "company_id": company_id,
        "company_name": company.get("name"),
        "plan": company.get("plan", "Basic"),
        "status": company.get("status"),
        "subscription_start": start_date,
        "subscription_end": end_date,
        "remaining_days": remaining_days,
        "is_expired": remaining_days <= 0,
        "is_expiring_soon": 0 < remaining_days <= 7
    }


@saas_core_router.put("/companies/{company_id}/subscription")
async def update_subscription(
    company_id: str,
    plan: str,
    days: int = 30,
    request: Request = None,
    current_user: dict = Depends(require_super_admin)
):
    """Set or renew company subscription"""
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    now = datetime.now(timezone.utc)
    start_date = now.isoformat()
    end_date = (now + timedelta(days=days)).isoformat()
    
    await db.companies.update_one(
        {"company_id": company_id},
        {"$set": {
            "plan": plan,
            "license_start": start_date,
            "license_end": end_date,
            "subscription_start_date": start_date,
            "subscription_end_date": end_date,
            "subscription_status": "ACTIVE",
            "status": "ACTIVE",
            "updated_at": get_current_timestamp()
        }}
    )
    
    await log_activity(
        db=db,
        action_type="SUBSCRIPTION_UPDATED",
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"plan": plan, "days": days, "end_date": end_date},
        ip_address=request.client.host if request and request.client else None
    )
    
    return {
        "message": f"Abonnement {plan} activé pour {days} jours",
        "subscription_end": end_date,
        "remaining_days": days
    }


# ============================================================================
# SUPER ADMIN NOTIFICATIONS
# ============================================================================

@saas_core_router.get("/notifications")
async def get_admin_notifications(
    current_user: dict = Depends(require_super_admin),
    unread_only: bool = False
):
    """Get notifications for Super Admin"""
    query = {"target_role": "SUPER_ADMIN"}
    if unread_only:
        query["read"] = False
    
    notifications = await db.admin_notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    return notifications


@saas_core_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(require_super_admin)
):
    """Mark notification as read"""
    await db.admin_notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marquée comme lue"}


# ============================================================================
# SUPER ADMIN SUCCURSALES VIEW (ALL COMPANIES)
# ============================================================================

@saas_core_router.get("/all-succursales")
async def get_all_succursales(current_user: dict = Depends(require_super_admin)):
    """Get all succursales across all companies (Super Admin view)"""
    succursales = await db.succursales.find(
        {"status": {"$ne": "DELETED"}},
        {"_id": 0}
    ).to_list(1000)
    
    for succ in succursales:
        # Agent count
        agent_count = await db.users.count_documents({
            "succursale_id": succ["succursale_id"],
            "role": UserRole.AGENT_POS,
            "status": {"$ne": "DELETED"}
        })
        succ["agent_count"] = agent_count
    
    return succursales


# ============================================================================
# SUPER ADMIN AGENTS VIEW (ALL COMPANIES)
# ============================================================================

@saas_core_router.get("/all-agents")
async def get_all_agents(
    current_user: dict = Depends(require_super_admin),
    company_id: Optional[str] = None
):
    """Get all agents across all companies (Super Admin view)"""
    query = {"role": UserRole.AGENT_POS, "status": {"$ne": "DELETED"}}
    if company_id:
        query["company_id"] = company_id
    
    agents = await db.users.find(
        query,
        {"_id": 0, "password_hash": 0}
    ).to_list(5000)
    
    # Enrich with company and succursale names
    for agent in agents:
        if agent.get("company_id"):
            company = await db.companies.find_one(
                {"company_id": agent["company_id"]},
                {"_id": 0, "name": 1}
            )
            agent["company_name"] = company.get("name") if company else "N/A"
        
        if agent.get("succursale_id"):
            succursale = await db.succursales.find_one(
                {"succursale_id": agent["succursale_id"]},
                {"_id": 0, "nom_succursale": 1}
            )
            agent["succursale_name"] = succursale.get("nom_succursale") if succursale else "N/A"
    
    return agents


# ============================================================================
# DASHBOARD STATS
# ============================================================================

@saas_core_router.get("/dashboard-stats")
async def get_dashboard_stats(current_user: dict = Depends(require_super_admin)):
    """Get platform-wide statistics for Super Admin dashboard"""
    
    # Companies
    total_companies = await db.companies.count_documents({"status": {"$ne": "DELETED"}})
    active_companies = await db.companies.count_documents({"status": "ACTIVE"})
    suspended_companies = await db.companies.count_documents({"status": "SUSPENDED"})
    expired_companies = await db.companies.count_documents({"status": "EXPIRED"})
    
    # Agents
    total_agents = await db.users.count_documents({"role": UserRole.AGENT_POS, "status": {"$ne": "DELETED"}})
    active_agents = await db.users.count_documents({"role": UserRole.AGENT_POS, "status": "ACTIVE"})
    suspended_agents = await db.users.count_documents({"role": UserRole.AGENT_POS, "status": "SUSPENDED"})
    online_agents = await db.users.count_documents({"role": UserRole.AGENT_POS, "is_online": True})
    
    # Succursales
    total_succursales = await db.succursales.count_documents({"status": {"$ne": "DELETED"}})
    
    # Lotteries
    total_lotteries = await db.master_lotteries.count_documents({})
    active_lotteries = await db.master_lotteries.count_documents({"is_active_global": True})
    
    # Schedules
    total_schedules = await db.global_schedules.count_documents({"is_active": True})
    
    # Unread notifications
    unread_notifications = await db.admin_notifications.count_documents({"read": False})
    
    return {
        "companies": {
            "total": total_companies,
            "active": active_companies,
            "suspended": suspended_companies,
            "expired": expired_companies
        },
        "agents": {
            "total": total_agents,
            "active": active_agents,
            "suspended": suspended_agents,
            "online": online_agents
        },
        "succursales": {
            "total": total_succursales
        },
        "lotteries": {
            "total": total_lotteries,
            "active": active_lotteries
        },
        "schedules": {
            "active": total_schedules
        },
        "notifications": {
            "unread": unread_notifications
        }
    }
