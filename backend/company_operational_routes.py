from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from models import (
    UserRole, Branch, BranchCreate, BranchUpdate,
    Vendor, VendorCreateModel, VendorUpdate,
    PrimeConfigEnhanced, PrimeConfigCreateEnhanced, PrimeConfigUpdateEnhanced,
    BlockedNumber, BlockedNumberCreate, SalesLimit, SalesLimitCreate, CompanyConfiguration, CompanyConfigurationUpdate,
    EliminationRequest, EliminationRequestCreate,
    DailyReport
)
from auth import decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

company_operational_router = APIRouter(prefix="/api/company")
security = HTTPBearer()

db = None

def set_company_operational_db(database):
    global db
    db = database

async def get_company_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # STRICT: Only company roles allowed
    allowed_roles = [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.AUDITOR_READONLY]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Company access required")
    
    if not user.get("company_id"):
        raise HTTPException(status_code=403, detail="No company assigned")
    
    return user

def require_write_access(user: dict):
    """Only COMPANY_ADMIN and COMPANY_MANAGER can write"""
    if user.get("role") == UserRole.AUDITOR_READONLY:
        raise HTTPException(status_code=403, detail="Read-only access")
    return user["company_id"]

def require_admin_access(user: dict):
    """Only COMPANY_ADMIN can perform admin actions"""
    if user.get("role") != UserRole.COMPANY_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user["company_id"]

# ============ BRANCHES (SUCCURSALES) ============
@company_operational_router.get("/branches", response_model=List[Branch])
async def get_branches(current_user: dict = Depends(get_company_user)):
    company_id = current_user["company_id"]
    branches = await db.branches.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    return [Branch(**b) for b in branches]

@company_operational_router.get("/branches/{branch_id}", response_model=Branch)
async def get_branch(branch_id: str, current_user: dict = Depends(get_company_user)):
    company_id = current_user["company_id"]
    branch = await db.branches.find_one({"branch_id": branch_id, "company_id": company_id}, {"_id": 0})
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return Branch(**branch)

@company_operational_router.post("/branches", response_model=Branch)
async def create_branch(
    branch_data: BranchCreate,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_write_access(current_user)
    
    # Check code uniqueness
    existing = await db.branches.find_one({"company_id": company_id, "code": branch_data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Branch code already exists")
    
    branch_id = generate_id("branch_")
    now = get_current_timestamp()
    
    # Get manager name if provided
    manager_name = None
    if branch_data.manager_id:
        manager = await db.users.find_one({"user_id": branch_data.manager_id}, {"_id": 0, "name": 1})
        manager_name = manager.get("name") if manager else None
    
    branch = Branch(
        branch_id=branch_id,
        company_id=company_id,
        name=branch_data.name,
        code=branch_data.code,
        address=branch_data.address,
        city=branch_data.city,
        phone=branch_data.phone,
        manager_id=branch_data.manager_id,
        manager_name=manager_name,
        status="ACTIVE",
        created_at=now,
        updated_at=now
    )
    
    await db.branches.insert_one(branch.model_dump())
    
    await log_activity(
        db=db,
        action_type="BRANCH_CREATED",
        entity_type="branch",
        entity_id=branch_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"branch_name": branch_data.name, "code": branch_data.code},
        ip_address=request.client.host if request.client else None
    )
    
    return branch

@company_operational_router.put("/branches/{branch_id}", response_model=Branch)
async def update_branch(
    branch_id: str,
    updates: BranchUpdate,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_write_access(current_user)
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Update manager name if manager_id changed
    if "manager_id" in update_data and update_data["manager_id"]:
        manager = await db.users.find_one({"user_id": update_data["manager_id"]}, {"_id": 0, "name": 1})
        update_data["manager_name"] = manager.get("name") if manager else None
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.branches.update_one(
        {"branch_id": branch_id, "company_id": company_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    branch_doc = await db.branches.find_one({"branch_id": branch_id}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="BRANCH_UPDATED",
        entity_type="branch",
        entity_id=branch_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return Branch(**branch_doc)

@company_operational_router.delete("/branches/{branch_id}")
async def delete_branch(
    branch_id: str,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_admin_access(current_user)
    
    branch = await db.branches.find_one({"branch_id": branch_id, "company_id": company_id}, {"_id": 0})
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    # Soft delete
    await db.branches.update_one(
        {"branch_id": branch_id},
        {"$set": {"status": "INACTIVE", "updated_at": get_current_timestamp()}}
    )
    
    await log_activity(
        db=db,
        action_type="BRANCH_DELETED",
        entity_type="branch",
        entity_id=branch_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"branch_name": branch.get("name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Branch deleted successfully"}

# ============ VENDORS (VENDEURS) ============
@company_operational_router.get("/vendors", response_model=List[Vendor])
async def get_vendors(current_user: dict = Depends(get_company_user)):
    company_id = current_user["company_id"]
    vendors = await db.vendors.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    return [Vendor(**v) for v in vendors]

@company_operational_router.post("/vendors", response_model=Vendor)
async def create_vendor(
    vendor_data: VendorCreateModel,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_write_access(current_user)
    
    vendor_id = generate_id("vendor_")
    now = get_current_timestamp()
    
    vendor = Vendor(
        vendor_id=vendor_id,
        company_id=company_id,
        branch_id=vendor_data.branch_id,
        name=vendor_data.name,
        phone=vendor_data.phone,
        email=vendor_data.email,
        commission_rate=vendor_data.commission_rate,
        status="ACTIVE",
        created_at=now,
        updated_at=now
    )
    
    await db.vendors.insert_one(vendor.model_dump())
    
    await log_activity(
        db=db,
        action_type="VENDOR_CREATED",
        entity_type="vendor",
        entity_id=vendor_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"vendor_name": vendor_data.name},
        ip_address=request.client.host if request.client else None
    )
    
    return vendor

@company_operational_router.put("/vendors/{vendor_id}", response_model=Vendor)
async def update_vendor(
    vendor_id: str,
    updates: VendorUpdate,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_write_access(current_user)
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.vendors.update_one(
        {"vendor_id": vendor_id, "company_id": company_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor_doc = await db.vendors.find_one({"vendor_id": vendor_id}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="VENDOR_UPDATED",
        entity_type="vendor",
        entity_id=vendor_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return Vendor(**vendor_doc)

@company_operational_router.delete("/vendors/{vendor_id}")
async def delete_vendor(
    vendor_id: str,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_admin_access(current_user)
    
    vendor = await db.vendors.find_one({"vendor_id": vendor_id, "company_id": company_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    await db.vendors.update_one(
        {"vendor_id": vendor_id},
        {"$set": {"status": "INACTIVE", "updated_at": get_current_timestamp()}}
    )
    
    await log_activity(
        db=db,
        action_type="VENDOR_DELETED",
        entity_type="vendor",
        entity_id=vendor_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"vendor_name": vendor.get("name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Vendor deleted successfully"}

# ============ PRIME CONFIG (PAYOUT TABLE) ============
@company_operational_router.get("/prime-configs", response_model=List[PrimeConfigEnhanced])
async def get_prime_configs(current_user: dict = Depends(get_company_user)):
    company_id = current_user["company_id"]
    configs = await db.prime_configs.find({"company_id": company_id}, {"_id": 0}).to_list(100)
    return [PrimeConfigEnhanced(**c) for c in configs]

@company_operational_router.post("/prime-configs", response_model=PrimeConfigEnhanced)
async def create_prime_config(
    config_data: PrimeConfigCreateEnhanced,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_admin_access(current_user)
    
    # Check for duplicate
    existing = await db.prime_configs.find_one({
        "company_id": company_id,
        "bet_code": config_data.bet_code
    })
    if existing:
        raise HTTPException(status_code=400, detail="Prime config with this bet code already exists")
    
    prime_id = generate_id("prime_")
    now = get_current_timestamp()
    
    config = PrimeConfigEnhanced(
        prime_id=prime_id,
        company_id=company_id,
        bet_type=config_data.bet_type,
        bet_code=config_data.bet_code,
        bet_name=config_data.bet_name,
        payout_formula=config_data.payout_formula,
        description=config_data.description,
        is_active=True,
        updated_at=now
    )
    
    await db.prime_configs.insert_one(config.model_dump())
    
    await log_activity(
        db=db,
        action_type="PRIME_CONFIG_CREATED",
        entity_type="prime_config",
        entity_id=prime_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"bet_name": config_data.bet_name, "payout": config_data.payout_formula},
        ip_address=request.client.host if request.client else None
    )
    
    return config

@company_operational_router.put("/prime-configs/{prime_id}", response_model=PrimeConfigEnhanced)
async def update_prime_config(
    prime_id: str,
    updates: PrimeConfigUpdateEnhanced,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_admin_access(current_user)
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.prime_configs.update_one(
        {"prime_id": prime_id, "company_id": company_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prime config not found")
    
    config_doc = await db.prime_configs.find_one({"prime_id": prime_id}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="PRIME_CONFIG_UPDATED",
        entity_type="prime_config",
        entity_id=prime_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return PrimeConfigEnhanced(**config_doc)

@company_operational_router.post("/prime-configs/seed-defaults")
async def seed_default_prime_configs(
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    """Seed default prime configurations for the company"""
    company_id = require_admin_access(current_user)
    now = get_current_timestamp()
    
    defaults = [
        {"bet_code": "20", "bet_type": "BORLETTE", "bet_name": "Borlette", "payout_formula": "60|20|10"},
        {"bet_code": "30", "bet_type": "LOTO3", "bet_name": "Loto 3", "payout_formula": "500"},
        {"bet_code": "40", "bet_type": "MARIAGE", "bet_name": "Mariage", "payout_formula": "750"},
        {"bet_code": "41", "bet_type": "L4O1", "bet_name": "L4O1", "payout_formula": "750"},
        {"bet_code": "42", "bet_type": "L4O2", "bet_name": "L4O2", "payout_formula": "750"},
        {"bet_code": "43", "bet_type": "L4O3", "bet_name": "L4O3", "payout_formula": "750"},
        {"bet_code": "51", "bet_type": "L5O1", "bet_name": "L5O1", "payout_formula": "750"},
        {"bet_code": "52", "bet_type": "L5O2", "bet_name": "L5O2", "payout_formula": "750"},
        {"bet_code": "53", "bet_type": "L5O3", "bet_name": "L5O3", "payout_formula": "750"},
        {"bet_code": "44", "bet_type": "MARIAGE_GRATUIT", "bet_name": "Mariage Gratuit", "payout_formula": "750"},
        {"bet_code": "105", "bet_type": "TET_FICH_LOTO3_DWAT", "bet_name": "Tet fich loto3 dwat", "payout_formula": "0"},
        {"bet_code": "106", "bet_type": "TET_FICH_MARIAJ_DWAT", "bet_name": "Tet fich mariaj dwat", "payout_formula": "0"},
        {"bet_code": "107", "bet_type": "TET_FICH_LOTO3_GAUCH", "bet_name": "Tet fich loto3 gauch", "payout_formula": "0"},
        {"bet_code": "108", "bet_type": "TET_FICH_MARIAJ_GAUCH", "bet_name": "Tet fich mariaj gauch", "payout_formula": "0"},
    ]
    
    created_count = 0
    for d in defaults:
        existing = await db.prime_configs.find_one({"company_id": company_id, "bet_code": d["bet_code"]})
        if existing:
            continue
        
        prime_id = generate_id("prime_")
        config = {
            "prime_id": prime_id,
            "company_id": company_id,
            "bet_code": d["bet_code"],
            "bet_type": d["bet_type"],
            "bet_name": d["bet_name"],
            "payout_formula": d["payout_formula"],
            "description": None,
            "is_active": True,
            "updated_at": now
        }
        await db.prime_configs.insert_one(config)
        created_count += 1
    
    return {"message": f"Seeded {created_count} prime configurations"}

# ============ COMPANY CONFIGURATION ============
@company_operational_router.get("/configuration", response_model=CompanyConfiguration)
async def get_company_configuration(current_user: dict = Depends(get_company_user)):
    company_id = current_user["company_id"]
    
    config = await db.company_configurations.find_one({"company_id": company_id}, {"_id": 0})
    if not config:
        # Create default config
        config_id = generate_id("config_")
        now = get_current_timestamp()
        
        default_config = CompanyConfiguration(
            config_id=config_id,
            company_id=company_id,
            min_bet_amount=10.0,
            max_bet_amount=10000.0,
            max_bet_per_number=5000.0,
            max_bet_per_agent=50000.0,
            agent_commission_percent=10.0,
            marriage_enabled=True,
            marriage_min_amount=25.0,
            marriage_max_amount=5000.0,
            stop_sales_before_draw_minutes=5,
            allow_ticket_void=True,
            void_window_minutes=5,
            auto_print_ticket=True,
            created_at=now,
            updated_at=now
        )
        
        await db.company_configurations.insert_one(default_config.model_dump())
        return default_config
    
    return CompanyConfiguration(**config)

@company_operational_router.put("/configuration", response_model=CompanyConfiguration)
async def update_company_configuration(
    updates: CompanyConfigurationUpdate,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_admin_access(current_user)
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    # Upsert
    await db.company_configurations.update_one(
        {"company_id": company_id},
        {"$set": update_data},
        upsert=True
    )
    
    config = await db.company_configurations.find_one({"company_id": company_id}, {"_id": 0})
    
    await log_activity(
        db=db,
        action_type="COMPANY_CONFIG_UPDATED",
        entity_type="configuration",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return CompanyConfiguration(**config)

# ============ LOTTERY AVAILABILITY (READ-ONLY CATALOG, ENABLE/DISABLE) ============
@company_operational_router.get("/lottery-availability")
async def get_lottery_availability(current_user: dict = Depends(get_company_user)):
    """Get global lotteries with company availability status"""
    company_id = current_user["company_id"]
    
    # Get all global lotteries
    global_lotteries = await db.global_lotteries.find({"is_active": True}, {"_id": 0}).to_list(2000)
    
    # Get company enabled lotteries
    company_lotteries = await db.company_lotteries.find({"company_id": company_id}, {"_id": 0}).to_list(2000)
    enabled_map = {cl["lottery_id"]: cl.get("enabled", False) for cl in company_lotteries}
    
    result = []
    for lottery in global_lotteries:
        lottery["enabled"] = enabled_map.get(lottery["lottery_id"], False)
        result.append(lottery)
    
    return result

@company_operational_router.put("/lottery-availability/{lottery_id}")
async def toggle_lottery_availability(
    lottery_id: str,
    enabled: bool,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    """Enable/disable a lottery for this company - CANNOT modify lottery details"""
    company_id = require_admin_access(current_user)
    
    # Verify lottery exists in global catalog
    lottery = await db.global_lotteries.find_one({"lottery_id": lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found in global catalog")
    
    now = get_current_timestamp()
    
    # Upsert company lottery availability
    await db.company_lotteries.update_one(
        {"company_id": company_id, "lottery_id": lottery_id},
        {"$set": {
            "enabled": enabled,
            "lottery_name": lottery.get("lottery_name"),
            "state_code": lottery.get("state_code"),
            "updated_at": now
        },
        "$setOnInsert": {
            "id": generate_id("cla_"),
            "company_id": company_id,
            "lottery_id": lottery_id,
            "created_at": now
        }},
        upsert=True
    )
    
    await log_activity(
        db=db,
        action_type="LOTTERY_AVAILABILITY_CHANGED",
        entity_type="lottery_availability",
        entity_id=lottery_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"lottery_name": lottery.get("lottery_name"), "enabled": enabled},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Lottery {'enabled' if enabled else 'disabled'} successfully"}

# ============ GLOBAL SCHEDULES (READ-ONLY) ============
@company_operational_router.get("/global-schedules-readonly")
async def get_global_schedules_readonly(current_user: dict = Depends(get_company_user)):
    """View global schedules - READ ONLY"""
    schedules = await db.global_schedules.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    for schedule in schedules:
        lottery = await db.global_lotteries.find_one({"lottery_id": schedule["lottery_id"]}, {"_id": 0})
        if lottery:
            schedule["lottery_name"] = lottery.get("lottery_name")
            schedule["state_code"] = lottery.get("state_code")
    
    return schedules

# ============ GLOBAL RESULTS (READ-ONLY) ============
@company_operational_router.get("/global-results-readonly")
async def get_global_results_readonly(
    current_user: dict = Depends(get_company_user),
    lottery_id: Optional[str] = None,
    draw_date: Optional[str] = None,
    limit: int = 200
):
    """View global results - READ ONLY"""
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    if draw_date:
        query["draw_date"] = draw_date
    
    results = await db.global_results.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return results

# ============ BLOCKED NUMBERS (STATISTICS MODULE) ============
@company_operational_router.get("/blocked-numbers", response_model=List[BlockedNumber])
async def get_blocked_numbers(current_user: dict = Depends(get_company_user)):
    company_id = current_user["company_id"]
    blocks = await db.blocked_numbers.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    return [BlockedNumber(**b) for b in blocks]

@company_operational_router.post("/blocked-numbers", response_model=BlockedNumber)
async def create_blocked_number(
    block_data: BlockedNumberCreate,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_write_access(current_user)
    
    block_id = generate_id("block_")
    now = get_current_timestamp()
    
    block = BlockedNumber(
        block_id=block_id,
        company_id=company_id,
        lottery_id=block_data.lottery_id,
        number=block_data.number,
        block_type=block_data.block_type,
        max_amount=block_data.max_amount,
        reason=block_data.reason,
        created_by=current_user["user_id"],
        created_at=now,
        expires_at=block_data.expires_at
    )
    
    await db.blocked_numbers.insert_one(block.model_dump())
    
    await log_activity(
        db=db,
        action_type="NUMBER_BLOCKED",
        entity_type="blocked_number",
        entity_id=block_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"number": block_data.number, "block_type": block_data.block_type},
        ip_address=request.client.host if request.client else None
    )
    
    return block

@company_operational_router.delete("/blocked-numbers/{block_id}")
async def delete_blocked_number(
    block_id: str,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_write_access(current_user)
    
    block = await db.blocked_numbers.find_one({"block_id": block_id, "company_id": company_id}, {"_id": 0})
    if not block:
        raise HTTPException(status_code=404, detail="Blocked number not found")
    
    await db.blocked_numbers.delete_one({"block_id": block_id})
    
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
    
    return {"message": "Number unblocked successfully"}

# ============ SALES LIMITS (STATISTICS MODULE) ============
@company_operational_router.get("/sales-limits", response_model=List[SalesLimit])
async def get_sales_limits(current_user: dict = Depends(get_company_user)):
    company_id = current_user["company_id"]
    limits = await db.sales_limits.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    return [SalesLimit(**lim) for lim in limits]

@company_operational_router.post("/sales-limits", response_model=SalesLimit)
async def create_sales_limit(
    limit_data: SalesLimitCreate,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_admin_access(current_user)
    
    limit_id = generate_id("limit_")
    now = get_current_timestamp()
    
    limit = SalesLimit(
        limit_id=limit_id,
        company_id=company_id,
        lottery_id=limit_data.lottery_id,
        agent_id=limit_data.agent_id,
        number=limit_data.number,
        bet_type=limit_data.bet_type,
        max_amount=limit_data.max_amount,
        period=limit_data.period,
        created_at=now,
        updated_at=now
    )
    
    await db.sales_limits.insert_one(limit.model_dump())
    
    await log_activity(
        db=db,
        action_type="SALES_LIMIT_CREATED",
        entity_type="sales_limit",
        entity_id=limit_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"max_amount": limit_data.max_amount, "period": limit_data.period},
        ip_address=request.client.host if request.client else None
    )
    
    return limit

@company_operational_router.delete("/sales-limits/{limit_id}")
async def delete_sales_limit(
    limit_id: str,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_admin_access(current_user)
    
    limit = await db.sales_limits.find_one({"limit_id": limit_id, "company_id": company_id}, {"_id": 0})
    if not limit:
        raise HTTPException(status_code=404, detail="Sales limit not found")
    
    await db.sales_limits.delete_one({"limit_id": limit_id})
    
    await log_activity(
        db=db,
        action_type="SALES_LIMIT_DELETED",
        entity_type="sales_limit",
        entity_id=limit_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Sales limit deleted successfully"}

# ============ STATISTICS - AGENT CONTROL ============
@company_operational_router.get("/statistics/agent-control")
async def get_agent_control_stats(
    current_user: dict = Depends(get_company_user),
    period: str = "today"
):
    """Agent performance statistics"""
    company_id = current_user["company_id"]
    now = datetime.now(timezone.utc)
    
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    start_str = start_date.isoformat()
    
    # Get all agents
    agents = await db.agents.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    
    agent_stats = []
    for agent in agents:
        # Get ticket stats for this agent
        pipeline = [
            {"$match": {
                "company_id": company_id,
                "agent_id": agent.get("user_id") or agent["agent_id"],
                "created_at": {"$gte": start_str}
            }},
            {"$group": {
                "_id": None,
                "total_tickets": {"$sum": 1},
                "total_sales": {"$sum": "$total_amount"}
            }}
        ]
        result = await db.tickets.aggregate(pipeline).to_list(1)
        
        # Count active POS for this agent
        pos_count = await db.pos_devices.count_documents({
            "company_id": company_id,
            "assigned_agent_id": agent["agent_id"],
            "status": "ACTIVE"
        })
        
        agent_stats.append({
            "agent_id": agent["agent_id"],
            "agent_name": agent["name"],
            "username": agent.get("username"),
            "status": agent["status"],
            "total_tickets": result[0]["total_tickets"] if result else 0,
            "total_sales": result[0]["total_sales"] if result else 0.0,
            "active_pos": pos_count
        })
    
    return {
        "period": period,
        "agents": agent_stats,
        "generated_at": now.isoformat()
    }

# ============ STATISTICS - FICHES PAR AGENT ============
@company_operational_router.get("/statistics/tickets-by-agent")
async def get_tickets_by_agent(
    current_user: dict = Depends(get_company_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Tickets (fiches) per agent statistics"""
    company_id = current_user["company_id"]
    
    now = datetime.now(timezone.utc)
    if not date_from:
        date_from = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    if not date_to:
        date_to = now.isoformat()
    
    pipeline = [
        {"$match": {
            "company_id": company_id,
            "created_at": {"$gte": date_from, "$lte": date_to}
        }},
        {"$group": {
            "_id": "$agent_id",
            "agent_name": {"$first": "$agent_name"},
            "ticket_count": {"$sum": 1},
            "total_amount": {"$sum": "$total_amount"}
        }},
        {"$sort": {"total_amount": -1}}
    ]
    
    results = await db.tickets.aggregate(pipeline).to_list(100)
    
    return {
        "date_from": date_from,
        "date_to": date_to,
        "data": results
    }

# ============ STATISTICS - LOTS GAGNANT (WINNING TICKETS) ============
@company_operational_router.get("/statistics/winning-tickets")
async def get_winning_tickets(
    current_user: dict = Depends(get_company_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 200
):
    """Winning tickets statistics"""
    company_id = current_user["company_id"]
    
    now = datetime.now(timezone.utc)
    if not date_from:
        date_from = (now - timedelta(days=7)).isoformat()
    if not date_to:
        date_to = now.isoformat()
    
    query = {
        "company_id": company_id,
        "status": {"$in": ["WINNER", "PAID"]},
        "created_at": {"$gte": date_from, "$lte": date_to}
    }
    
    winners = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Calculate totals
    total_payout = sum(t.get("payout_amount", 0) for t in winners)
    
    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_winners": len(winners),
        "total_payout": total_payout,
        "winners": winners
    }

# ============ TRAÇABILITÉ (AUDIT LOGS) ============
@company_operational_router.get("/statistics/tracability")
async def get_tracability_logs(
    current_user: dict = Depends(get_company_user),
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 500
):
    """Full audit trail for company actions"""
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id}
    if action_type:
        query["action_type"] = action_type
    if entity_type:
        query["entity_type"] = entity_type
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return logs

# ============ ELIMINATION REQUESTS ============
@company_operational_router.get("/elimination-requests")
async def get_elimination_requests(
    current_user: dict = Depends(get_company_user),
    status: Optional[str] = None
):
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id}
    if status:
        query["status"] = status
    
    requests = await db.elimination_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return requests

@company_operational_router.post("/elimination-requests")
async def create_elimination_request(
    request_data: EliminationRequestCreate,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_write_access(current_user)
    
    request_id = generate_id("elim_")
    now = get_current_timestamp()
    
    elim_request = EliminationRequest(
        request_id=request_id,
        company_id=company_id,
        ticket_id=request_data.ticket_id,
        number=request_data.number,
        lottery_id=request_data.lottery_id,
        request_type=request_data.request_type,
        reason=request_data.reason,
        status="PENDING",
        requested_by=current_user["user_id"],
        requested_by_name=current_user.get("name"),
        created_at=now
    )
    
    await db.elimination_requests.insert_one(elim_request.model_dump())
    
    await log_activity(
        db=db,
        action_type="ELIMINATION_REQUEST_CREATED",
        entity_type="elimination_request",
        entity_id=request_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"request_type": request_data.request_type, "reason": request_data.reason},
        ip_address=request.client.host if request.client else None
    )
    
    return elim_request

@company_operational_router.put("/elimination-requests/{request_id}/review")
async def review_elimination_request(
    request_id: str,
    status: str,  # APPROVED or REJECTED
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    company_id = require_admin_access(current_user)
    
    if status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    now = get_current_timestamp()
    
    result = await db.elimination_requests.update_one(
        {"request_id": request_id, "company_id": company_id},
        {"$set": {
            "status": status,
            "reviewed_by": current_user["user_id"],
            "reviewed_at": now
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await log_activity(
        db=db,
        action_type=f"ELIMINATION_REQUEST_{status}",
        entity_type="elimination_request",
        entity_id=request_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Request {status.lower()}"}

# ============ DAILY REPORTS (JOURNALIER) ============
@company_operational_router.get("/daily-reports")
async def get_daily_reports(
    current_user: dict = Depends(get_company_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 30
):
    """Get generated daily reports"""
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id}
    if date_from:
        query["report_date"] = {"$gte": date_from}
    if date_to:
        if "report_date" in query:
            query["report_date"]["$lte"] = date_to
        else:
            query["report_date"] = {"$lte": date_to}
    
    reports = await db.daily_reports.find(query, {"_id": 0}).sort("report_date", -1).limit(limit).to_list(limit)
    return reports

@company_operational_router.post("/daily-reports/generate")
async def generate_daily_report(
    report_date: str,  # YYYY-MM-DD
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    """Generate a daily report for specific date"""
    company_id = require_write_access(current_user)
    
    # Parse date
    try:
        date_obj = datetime.strptime(report_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    start_str = date_obj.replace(hour=0, minute=0, second=0).isoformat()
    end_str = date_obj.replace(hour=23, minute=59, second=59).isoformat()
    
    # Ticket totals
    ticket_pipeline = [
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
    ticket_result = await db.tickets.aggregate(ticket_pipeline).to_list(1)
    total_tickets = ticket_result[0]["total_tickets"] if ticket_result else 0
    total_sales = ticket_result[0]["total_sales"] if ticket_result else 0.0
    
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
        {"$sort": {"sales": -1}}
    ]
    sales_by_lottery = await db.tickets.aggregate(lottery_pipeline).to_list(50)
    
    # Sales by agent
    agent_pipeline = [
        {"$match": {
            "company_id": company_id,
            "created_at": {"$gte": start_str, "$lte": end_str}
        }},
        {"$group": {
            "_id": "$agent_id",
            "agent_name": {"$first": "$agent_name"},
            "tickets": {"$sum": 1},
            "sales": {"$sum": "$total_amount"}
        }},
        {"$sort": {"sales": -1}}
    ]
    sales_by_agent = await db.tickets.aggregate(agent_pipeline).to_list(100)
    
    # Voided tickets
    voided_count = await db.tickets.count_documents({
        "company_id": company_id,
        "status": "VOID",
        "created_at": {"$gte": start_str, "$lte": end_str}
    })
    
    # Winners
    winners_count = await db.tickets.count_documents({
        "company_id": company_id,
        "status": {"$in": ["WINNER", "PAID"]},
        "created_at": {"$gte": start_str, "$lte": end_str}
    })
    
    now = get_current_timestamp()
    report_id = generate_id("report_")
    
    report = DailyReport(
        report_id=report_id,
        company_id=company_id,
        report_date=report_date,
        total_tickets=total_tickets,
        total_sales=total_sales,
        total_wins=0.0,  # Would need payout calculation
        total_commissions=0.0,
        net_revenue=total_sales,
        sales_by_lottery=sales_by_lottery,
        sales_by_agent=sales_by_agent,
        sales_by_branch=[],
        winning_tickets_count=winners_count,
        voided_tickets_count=voided_count,
        generated_at=now,
        generated_by=current_user["user_id"]
    )
    
    # Upsert report
    await db.daily_reports.update_one(
        {"company_id": company_id, "report_date": report_date},
        {"$set": report.model_dump()},
        upsert=True
    )
    
    await log_activity(
        db=db,
        action_type="DAILY_REPORT_GENERATED",
        entity_type="daily_report",
        entity_id=report_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"report_date": report_date, "total_sales": total_sales},
        ip_address=request.client.host if request.client else None
    )
    
    return report


# ============ DEVICE SESSION MANAGEMENT ============
@company_operational_router.get("/device-sessions")
async def get_company_device_sessions(
    current_user: dict = Depends(get_company_user),
    status: Optional[str] = None
):
    """Get all device sessions for the company"""
    company_id = current_user.get("company_id")
    
    query = {"company_id": company_id}
    if status:
        query["status"] = status
    
    sessions = await db.device_sessions.find(query, {"_id": 0}).sort("last_seen_at", -1).to_list(500)
    
    return sessions

@company_operational_router.put("/device-sessions/{session_id}/block")
async def block_company_device_session(
    session_id: str,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    """Block a device session"""
    require_write_access(current_user)
    company_id = current_user.get("company_id")
    
    result = await db.device_sessions.update_one(
        {"session_id": session_id, "company_id": company_id},
        {"$set": {"status": "blocked", "blocked_at": get_current_timestamp(), "blocked_by": current_user["user_id"]}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await log_activity(
        db=db,
        action_type="DEVICE_SESSION_BLOCKED",
        entity_type="device_session",
        entity_id=session_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"session_id": session_id},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Session blocked"}

@company_operational_router.put("/device-sessions/{session_id}/unblock")
async def unblock_company_device_session(
    session_id: str,
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    """Unblock a device session"""
    require_write_access(current_user)
    company_id = current_user.get("company_id")
    
    result = await db.device_sessions.update_one(
        {"session_id": session_id, "company_id": company_id},
        {"$set": {"status": "active"}, "$unset": {"blocked_at": "", "blocked_by": ""}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await log_activity(
        db=db,
        action_type="DEVICE_SESSION_UNBLOCKED",
        entity_type="device_session",
        entity_id=session_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"session_id": session_id},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Session unblocked"}

# ============ AGENT PERMISSION MANAGEMENT ============
@company_operational_router.get("/agent-permissions")
async def get_all_agent_permissions(current_user: dict = Depends(get_company_user)):
    """Get all agent permissions for the company"""
    company_id = current_user.get("company_id")
    
    permissions = await db.agent_permissions.find({"company_id": company_id}, {"_id": 0}).to_list(500)
    
    # Enrich with agent info
    for perm in permissions:
        agent = await db.users.find_one({"user_id": perm["agent_id"]}, {"_id": 0, "password_hash": 0})
        if agent:
            perm["agent_name"] = agent.get("name")
            perm["agent_email"] = agent.get("email")
    
    return permissions

@company_operational_router.put("/agents/{agent_id}/device-permission")
async def set_company_agent_device_permission(
    agent_id: str,
    permission: str,  # ANY_DEVICE or POS_ONLY
    request: Request,
    current_user: dict = Depends(get_company_user)
):
    """Set agent's device login permission"""
    require_write_access(current_user)
    company_id = current_user.get("company_id")
    
    if permission not in ["ANY_DEVICE", "POS_ONLY"]:
        raise HTTPException(status_code=400, detail="Invalid permission. Use ANY_DEVICE or POS_ONLY")
    
    # Verify agent belongs to company
    agent = await db.users.find_one({
        "user_id": agent_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS
    })
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    await db.agent_permissions.update_one(
        {"agent_id": agent_id},
        {"$set": {
            "agent_id": agent_id,
            "company_id": company_id,
            "login_permission": permission,
            "updated_at": get_current_timestamp(),
            "updated_by": current_user["user_id"]
        }},
        upsert=True
    )
    
    await log_activity(
        db=db,
        action_type="AGENT_PERMISSION_UPDATED",
        entity_type="agent",
        entity_id=agent_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"permission": permission, "agent_name": agent.get("name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Permission updated: {permission}"}

