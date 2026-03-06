from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional

from models import *
from auth import get_password_hash, decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

super_admin_router = APIRouter(prefix="/api/super")
security = HTTPBearer()

# Will be set from server.py
db = None

# Import will be done after db is set
activate_lotteries_func = None

def set_db(database):
    global db, activate_lotteries_func
    db = database
    # Import here to avoid circular imports
    from validation_routes import activate_all_lotteries_for_company
    activate_lotteries_func = activate_all_lotteries_for_company

# Auth dependency for super admin routes
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

# ============ USERS MANAGEMENT ============
@super_admin_router.get("/users", response_model=List[User])
async def get_all_platform_users(
    current_user: dict = Depends(get_current_user),
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    company_id: Optional[str] = None
):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    if role:
        query["role"] = role
    if status:
        query["status"] = status
    if company_id:
        query["company_id"] = company_id
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return [User(**u) for u in users]

@super_admin_router.post("/users", response_model=User)
async def create_platform_user(
    user_data: UserCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
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
        "company_id": user_data.company_id,
        "status": "ACTIVE",
        "last_login": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    await log_activity(
        db=db,
        action_type="USER_CREATED",
        entity_type="user",
        entity_id=user_id,
        performed_by=current_user["user_id"],
        company_id=user_data.company_id,
        metadata={"user_name": user_data.name, "role": user_data.role},
        ip_address=request.client.host if request.client else None
    )
    
    user_doc.pop("password_hash")
    return User(**user_doc)

@super_admin_router.put("/users/{user_id}", response_model=User)
async def update_platform_user(
    user_id: str,
    updates: UserUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    await db.users.update_one({"user_id": user_id}, {"$set": update_data})
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_activity(
        db=db,
        action_type="USER_UPDATED",
        entity_type="user",
        entity_id=user_id,
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return User(**user_doc)

@super_admin_router.delete("/users/{user_id}")
async def delete_platform_user(
    user_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Soft delete by setting status to DELETED
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": "DELETED", "updated_at": get_current_timestamp()}})
    
    await log_activity(
        db=db,
        action_type="USER_DELETED",
        entity_type="user",
        entity_id=user_id,
        performed_by=current_user["user_id"],
        metadata={"user_name": user.get("name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "User deleted successfully"}

# ============ PLANS MANAGEMENT ============
@super_admin_router.get("/plans", response_model=List[Plan])
async def get_all_plans(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    plans = await db.plans.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [Plan(**p) for p in plans]

@super_admin_router.post("/plans", response_model=Plan)
async def create_plan(
    plan_data: PlanCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    plan_id = generate_id("plan_")
    now = get_current_timestamp()
    
    plan = Plan(
        plan_id=plan_id,
        name=plan_data.name,
        price=plan_data.price,
        max_agents=plan_data.max_agents,
        max_tickets_per_day=plan_data.max_tickets_per_day,
        max_lotteries=plan_data.max_lotteries,
        max_pos_devices=plan_data.max_pos_devices,
        features=plan_data.features,
        status="ACTIVE",
        created_at=now,
        updated_at=now
    )
    
    await db.plans.insert_one(plan.model_dump())
    
    await log_activity(
        db=db,
        action_type="PLAN_CREATED",
        entity_type="plan",
        entity_id=plan_id,
        performed_by=current_user["user_id"],
        metadata={"plan_name": plan_data.name, "price": plan_data.price},
        ip_address=request.client.host if request.client else None
    )
    
    return plan

@super_admin_router.put("/plans/{plan_id}", response_model=Plan)
async def update_plan(
    plan_id: str,
    updates: PlanUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    await db.plans.update_one({"plan_id": plan_id}, {"$set": update_data})
    
    plan_doc = await db.plans.find_one({"plan_id": plan_id}, {"_id": 0})
    if not plan_doc:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    await log_activity(
        db=db,
        action_type="PLAN_UPDATED",
        entity_type="plan",
        entity_id=plan_id,
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return Plan(**plan_doc)

# ============ LICENSES MANAGEMENT ============
@super_admin_router.get("/licenses", response_model=List[License])
async def get_all_licenses(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    licenses = await db.licenses.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [License(**l) for l in licenses]

@super_admin_router.post("/licenses", response_model=License)
async def create_license(
    license_data: LicenseCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Verify company exists
    company = await db.companies.find_one({"company_id": license_data.company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Verify plan exists
    plan = await db.plans.find_one({"plan_id": license_data.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    license_id = generate_id("lic_")
    now = get_current_timestamp()
    
    license_obj = License(
        license_id=license_id,
        company_id=license_data.company_id,
        company_name=company["name"],
        plan_id=license_data.plan_id,
        plan_name=plan["name"],
        start_date=license_data.start_date,
        expiry_date=license_data.expiry_date,
        status="ACTIVE",
        created_at=now,
        updated_at=now
    )
    
    await db.licenses.insert_one(license_obj.model_dump())
    
    # Update company license dates
    await db.companies.update_one(
        {"company_id": license_data.company_id},
        {"$set": {
            "plan": plan["name"],
            "license_start": license_data.start_date,
            "license_end": license_data.expiry_date,
            "updated_at": now
        }}
    )
    
    await log_activity(
        db=db,
        action_type="LICENSE_CREATED",
        entity_type="license",
        entity_id=license_id,
        performed_by=current_user["user_id"],
        company_id=license_data.company_id,
        metadata={"plan": plan["name"], "expiry": license_data.expiry_date},
        ip_address=request.client.host if request.client else None
    )
    
    return license_obj

# ============ ACTIVITY LOGS ============
@super_admin_router.get("/activity-logs", response_model=List[ActivityLog])
async def get_activity_logs(
    current_user: dict = Depends(get_current_user),
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    company_id: Optional[str] = None,
    limit: int = 500
):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if action_type:
        query["action_type"] = action_type
    if entity_type:
        query["entity_type"] = entity_type
    if company_id:
        query["company_id"] = company_id
    
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [ActivityLog(**log) for log in logs]

# ============ SYSTEM SETTINGS ============
@super_admin_router.get("/settings", response_model=SystemSettings)
async def get_system_settings(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    settings = await db.system_settings.find_one({"settings_id": "system_settings"}, {"_id": 0})
    if not settings:
        # Create default settings if not exists
        now = get_current_timestamp()
        default_settings = SystemSettings(
            settings_id="system_settings",
            platform_name="LOTTOLAB",
            default_currency="HTG",
            default_timezone="America/Port-au-Prince",
            ticket_code_length=12,
            verification_code_length=12,
            maintenance_mode=False,
            allow_company_registration=False,
            updated_at=now,
            updated_by=None
        )
        await db.system_settings.insert_one(default_settings.model_dump())
        return default_settings
    
    return SystemSettings(**settings)

@super_admin_router.put("/settings", response_model=SystemSettings)
async def update_system_settings(
    updates: SettingsUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    update_data["updated_by"] = current_user["user_id"]
    
    await db.system_settings.update_one(
        {"settings_id": "system_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    settings = await db.system_settings.find_one({"settings_id": "system_settings"}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="SETTINGS_UPDATED",
        entity_type="settings",
        entity_id="system_settings",
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return SystemSettings(**settings)



# ============ COMPANY FULL CREATE WITH ADMIN ============
@super_admin_router.post("/companies/full-create")
async def create_company_with_admin(
    data: dict,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a complete company with:
    - Company record
    - Company Admin user
    - Default settings and permissions
    """
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Validate required fields
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Company name is required")
    if not data.get("admin_email"):
        raise HTTPException(status_code=400, detail="Admin email is required")
    if not data.get("admin_password"):
        raise HTTPException(status_code=400, detail="Admin password is required")
    
    # Check if company slug exists
    slug = data.get("slug", data["name"].lower().replace(" ", "-"))
    existing_company = await db.companies.find_one({"slug": slug})
    if existing_company:
        raise HTTPException(status_code=400, detail="Une entreprise avec ce nom existe déjà")
    
    # Check if admin email exists
    existing_user = await db.users.find_one({"email": data["admin_email"]})
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    now = get_current_timestamp()
    company_id = generate_id("comp_")
    admin_user_id = generate_id("user_")
    
    # Create company
    company_doc = {
        "company_id": company_id,
        "name": data["name"],
        "slug": slug,
        "contact_email": data.get("contact_email", data["admin_email"]),
        "contact_phone": data.get("contact_phone", ""),
        "address": data.get("address", ""),
        "country": data.get("country", "HT"),
        "timezone": data.get("timezone", "America/Port-au-Prince"),
        "currency": data.get("currency", "HTG"),
        "plan": data.get("plan", "Basic"),
        "status": data.get("status", "ACTIVE"),
        "activation_date": data.get("activation_date", now),
        "expiration_date": data.get("expiration_date"),
        "max_agents": data.get("max_agents", 5),
        "max_pos_devices": data.get("max_pos_devices", 10),
        "max_daily_sales": data.get("max_daily_sales", 100000),
        "company_logo_url": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.companies.insert_one(company_doc)
    
    # Create admin user
    admin_doc = {
        "user_id": admin_user_id,
        "email": data["admin_email"],
        "password_hash": get_password_hash(data["admin_password"]),
        "name": data.get("admin_name", "Admin"),
        "role": UserRole.COMPANY_ADMIN,
        "status": "ACTIVE",
        "company_id": company_id,
        "permissions": ["full_access"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(admin_doc)
    
    # Create default company config version
    await db.company_config_versions.insert_one({
        "company_id": company_id,
        "version": 1,
        "last_changed": now
    })
    
    # Auto-activate all lotteries for the new company
    lotteries_activated = 0
    if activate_lotteries_func:
        lotteries_activated = await activate_lotteries_func(company_id)
    
    # Log activity
    await log_activity(
        db=db,
        action_type="COMPANY_CREATED_WITH_ADMIN",
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "company_name": data["name"],
            "admin_email": data["admin_email"],
            "plan": data.get("plan", "Basic"),
            "lotteries_activated": lotteries_activated
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": "Entreprise et compte admin créés avec succès",
        "company_id": company_id,
        "admin_user_id": admin_user_id,
        "company_name": data["name"],
        "admin_email": data["admin_email"]
    }


# ============ LOGIN AS COMPANY ADMIN ============
@super_admin_router.post("/companies/{company_id}/impersonate")
async def login_as_company_admin(
    company_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Super Admin can impersonate any Company Admin for debugging/support.
    Returns a token that allows Super Admin to access company as admin.
    """
    from auth import create_token
    
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Find company
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Find company admin
    company_admin = await db.users.find_one({
        "company_id": company_id,
        "role": UserRole.COMPANY_ADMIN
    }, {"_id": 0})
    
    if not company_admin:
        raise HTTPException(status_code=404, detail="Company admin not found")
    
    # Create impersonation token
    token = create_token({
        "user_id": company_admin["user_id"],
        "email": company_admin["email"],
        "role": UserRole.COMPANY_ADMIN,
        "company_id": company_id,
        "impersonated_by": current_user["user_id"]
    })
    
    # Log activity
    await log_activity(
        db=db,
        action_type="SUPER_ADMIN_IMPERSONATE",
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "company_name": company["name"],
            "impersonated_user": company_admin["email"]
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "token": token,
        "company_id": company_id,
        "company_name": company["name"],
        "admin_email": company_admin["email"],
        "admin_name": company_admin.get("name"),
        "redirect_url": "/company/dashboard"
    }


# ============ GET COMPANY FULL DETAILS ============
@super_admin_router.get("/companies/{company_id}/full")
async def get_company_full_details(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get full details of a company including agents, POS, stats"""
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get counts
    agents_count = await db.users.count_documents({
        "company_id": company_id,
        "role": UserRole.AGENT_POS
    })
    
    pos_count = await db.pos_devices.count_documents({
        "company_id": company_id
    })
    
    admin = await db.users.find_one({
        "company_id": company_id,
        "role": UserRole.COMPANY_ADMIN
    }, {"_id": 0, "password_hash": 0})
    
    # Get recent tickets count
    tickets_today = await db.lottery_transactions.count_documents({
        "company_id": company_id,
        "created_at": {"$gte": get_current_timestamp()[:10]}
    })
    
    # Get balance summary
    balances = await db.agent_balances.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(100)
    
    total_balance = sum(b.get("current_balance", 0) for b in balances)
    total_sales = sum(b.get("total_sales", 0) for b in balances)
    
    return {
        **company,
        "stats": {
            "agents_count": agents_count,
            "pos_devices_count": pos_count,
            "tickets_today": tickets_today,
            "total_agent_balance": total_balance,
            "total_sales": total_sales
        },
        "admin": admin
    }


# ============ UPLOAD COMPANY LOGO (SUPER ADMIN) ============
@super_admin_router.post("/companies/{company_id}/logo")
async def upload_company_logo_super(
    company_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Super Admin can upload logo for any company"""
    from fastapi import UploadFile, File
    import os
    import shutil
    
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Note: This endpoint requires form data handling
    # The actual file upload is handled in settings_routes.py
    # This is a placeholder that can be enhanced
    
    return {"message": "Use /api/settings/logo/company endpoint for logo upload"}


# ============ GLOBAL VISIBILITY - ALL DATA ============
@super_admin_router.get("/global/stats")
async def get_global_stats(current_user: dict = Depends(get_current_user)):
    """Get global platform statistics"""
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Count all entities
    companies_count = await db.companies.count_documents({"status": "ACTIVE"})
    agents_count = await db.users.count_documents({"role": UserRole.AGENT_POS, "status": "ACTIVE"})
    pos_count = await db.pos_devices.count_documents({"status": "ACTIVE"})
    tickets_today = await db.lottery_transactions.count_documents({
        "created_at": {"$gte": get_current_timestamp()[:10]}
    })
    
    # Get total sales
    total_sales_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    sales_result = await db.lottery_transactions.aggregate(total_sales_pipeline).to_list(1)
    total_sales = sales_result[0]["total"] if sales_result else 0
    
    # Get results count
    results_count = await db.global_results.count_documents({})
    lotteries_count = await db.global_lotteries.count_documents({"is_active": True})
    
    return {
        "companies": companies_count,
        "agents": agents_count,
        "pos_devices": pos_count,
        "tickets_today": tickets_today,
        "total_sales": total_sales,
        "results_published": results_count,
        "lotteries_active": lotteries_count
    }


@super_admin_router.get("/global/all-agents")
async def get_all_agents_global(
    current_user: dict = Depends(get_current_user),
    company_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 500
):
    """Get all agents across all companies"""
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {"role": UserRole.AGENT_POS}
    if company_id:
        query["company_id"] = company_id
    if status:
        query["status"] = status
    
    agents = await db.users.find(
        query,
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with company names and balances
    for agent in agents:
        company = await db.companies.find_one(
            {"company_id": agent.get("company_id")},
            {"_id": 0, "name": 1}
        )
        agent["company_name"] = company.get("name") if company else "N/A"
        
        balance = await db.agent_balances.find_one(
            {"agent_id": agent["user_id"]},
            {"_id": 0}
        )
        agent["balance"] = balance if balance else None
    
    return agents


@super_admin_router.get("/global/all-pos")
async def get_all_pos_global(
    current_user: dict = Depends(get_current_user),
    company_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 500
):
    """Get all POS devices across all companies"""
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if company_id:
        query["company_id"] = company_id
    if status:
        query["status"] = status
    
    devices = await db.pos_devices.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with company names
    for device in devices:
        company = await db.companies.find_one(
            {"company_id": device.get("company_id")},
            {"_id": 0, "name": 1}
        )
        device["company_name"] = company.get("name") if company else "N/A"
    
    return devices


@super_admin_router.get("/global/all-tickets")
async def get_all_tickets_global(
    current_user: dict = Depends(get_current_user),
    company_id: Optional[str] = None,
    status: Optional[str] = None,
    date: Optional[str] = None,
    limit: int = 500
):
    """Get all tickets across all companies"""
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if company_id:
        query["company_id"] = company_id
    if status:
        query["status"] = status
    if date:
        query["created_at"] = {"$gte": date, "$lt": date + "T23:59:59"}
    
    tickets = await db.lottery_transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return tickets
