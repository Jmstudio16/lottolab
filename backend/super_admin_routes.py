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

def set_db(database):
    global db
    db = database

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
