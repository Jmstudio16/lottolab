"""
LOTTOLAB - Lottery Synchronization Service
==========================================
Corrige le bug enabled_lotteries: 0 et synchronise les loteries
entre le catalogue master et les compagnies.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from datetime import datetime, timezone

from models import UserRole
from auth import decode_token
from utils import generate_id, get_current_timestamp

lottery_sync_router = APIRouter(prefix="/api", tags=["Lottery Sync"])
security = HTTPBearer()

db = None

def set_lottery_sync_db(database):
    global db
    db = database


# ============================================================================
# AUTH
# ============================================================================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user"""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return user


# ============================================================================
# SYNC FUNCTIONS
# ============================================================================

async def sync_company_lotteries(company_id: str) -> dict:
    """
    Synchronize lotteries for a specific company.
    
    This function:
    1. Gets all active master lotteries
    2. Creates ONLY NEW company_lotteries entries
    3. NEVER modifies existing entries (respects company config)
    
    This fixes the "enabled_lotteries: 0" bug by ensuring
    all companies have lottery entries, WITHOUT overwriting
    existing configurations.
    """
    if db is None:
        return {"error": "Database not initialized", "synced": 0}
    
    now = get_current_timestamp()
    synced_count = 0
    
    # Get all active master lotteries
    master_lotteries = await db.master_lotteries.find(
        {"$or": [{"is_active_global": True}, {"is_active": True}]},
        {"_id": 0}
    ).to_list(500)
    
    # If no master_lotteries, check global_lotteries
    if not master_lotteries:
        master_lotteries = await db.global_lotteries.find(
            {"is_active": True},
            {"_id": 0}
        ).to_list(500)
    
    for lottery in master_lotteries:
        lottery_id = lottery.get("lottery_id")
        
        # Check if company_lottery entry exists
        existing = await db.company_lotteries.find_one({
            "company_id": company_id,
            "lottery_id": lottery_id
        })
        
        if not existing:
            # Create new entry - DEFAULT ENABLED (only for NEW entries)
            await db.company_lotteries.insert_one({
                "company_id": company_id,
                "lottery_id": lottery_id,
                "lottery_name": lottery.get("lottery_name", ""),
                "state_code": lottery.get("state_code", ""),
                "enabled": True,
                "is_enabled": True,
                "is_enabled_for_company": True,
                "created_at": now,
                "updated_at": now
            })
            synced_count += 1
        # DO NOT modify existing entries - respect company configuration
    
    return {
        "company_id": company_id,
        "master_lotteries_count": len(master_lotteries),
        "synced_new": synced_count,
        "updated_existing": 0,  # We no longer update existing
        "timestamp": now
    }


async def sync_all_companies() -> dict:
    """
    Synchronize lotteries for ALL companies.
    Called on startup or manually to repair database.
    """
    if db is None:
        return {"error": "Database not initialized"}
    
    companies = await db.companies.find(
        {"status": {"$in": ["ACTIVE", "TRIAL"]}},
        {"company_id": 1}
    ).to_list(1000)
    
    results = []
    total_synced = 0
    total_updated = 0
    
    for company in companies:
        company_id = company.get("company_id")
        result = await sync_company_lotteries(company_id)
        results.append({
            "company_id": company_id,
            "synced": result.get("synced_new", 0),
            "updated": result.get("updated_existing", 0)
        })
        total_synced += result.get("synced_new", 0)
        total_updated += result.get("updated_existing", 0)
    
    return {
        "companies_processed": len(companies),
        "total_synced": total_synced,
        "total_updated": total_updated,
        "details": results
    }


async def get_enabled_lotteries_count(company_id: str) -> int:
    """Get count of enabled lotteries for a company"""
    count = await db.company_lotteries.count_documents({
        "company_id": company_id,
        "$or": [
            {"enabled": True},
            {"is_enabled": True},
            {"is_enabled_for_company": True}
        ]
    })
    return count


async def repair_company_lottery_state(company_id: str) -> dict:
    """
    Repair a specific company's lottery configuration.
    
    This is the FIX for enabled_lotteries: 0 bug.
    """
    if db is None:
        return {"error": "Database not initialized"}
    
    # Step 1: Count current enabled
    current_count = await get_enabled_lotteries_count(company_id)
    
    # Step 2: Sync with master
    sync_result = await sync_company_lotteries(company_id)
    
    # Step 3: Count after sync
    new_count = await get_enabled_lotteries_count(company_id)
    
    # Step 4: Update config version to trigger sync
    await db.company_config_versions.update_one(
        {"company_id": company_id},
        {
            "$inc": {"version": 1},
            "$set": {
                "last_updated_at": get_current_timestamp(),
                "change_type": "LOTTERY_SYNC_REPAIR"
            }
        },
        upsert=True
    )
    
    return {
        "company_id": company_id,
        "before": current_count,
        "after": new_count,
        "synced": sync_result.get("synced_new", 0),
        "updated": sync_result.get("updated_existing", 0),
        "fixed": new_count > current_count
    }


# ============================================================================
# API ENDPOINTS
# ============================================================================

@lottery_sync_router.post("/company/sync-lotteries")
async def sync_company_lotteries_endpoint(
    current_user: dict = Depends(get_current_user)
):
    """
    Sync lotteries for the current user's company.
    Fixes enabled_lotteries: 0 bug.
    """
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Compagnie non trouvée")
    
    result = await repair_company_lottery_state(company_id)
    
    return {
        "message": f"Synchronisation terminée. {result['after']} loteries actives.",
        **result
    }


@lottery_sync_router.get("/company/enabled-lotteries-count")
async def get_enabled_count_endpoint(
    current_user: dict = Depends(get_current_user)
):
    """Get count of enabled lotteries for current company"""
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Compagnie non trouvée")
    
    count = await get_enabled_lotteries_count(company_id)
    
    return {"company_id": company_id, "enabled_lotteries": count}


@lottery_sync_router.post("/lottery-sync/sync-all-companies")
async def sync_all_companies_endpoint(
    current_user: dict = Depends(get_current_user)
):
    """
    [Super Admin Only] Sync lotteries for ALL companies.
    Mass fix for enabled_lotteries bug.
    """
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès Super Admin requis")
    
    result = await sync_all_companies()
    
    return {
        "message": f"Synchronisation de {result['companies_processed']} compagnies terminée",
        **result
    }


@lottery_sync_router.post("/lottery-sync/repair-company/{company_id}")
async def repair_company_endpoint(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    [Super Admin Only] Repair specific company's lottery configuration.
    """
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès Super Admin requis")
    
    # Verify company exists
    company = await db.companies.find_one({"company_id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Compagnie non trouvée")
    
    result = await repair_company_lottery_state(company_id)
    
    return {
        "message": f"Réparation terminée pour {company.get('name')}",
        "company_name": company.get("name"),
        **result
    }


# ============================================================================
# STARTUP SYNC - Call this on app startup
# ============================================================================

async def startup_lottery_sync():
    """
    Called on application startup to ensure all companies have lotteries.
    """
    if db is None:
        return
    
    try:
        # Check if any company has 0 enabled lotteries
        companies = await db.companies.find(
            {"status": {"$in": ["ACTIVE", "TRIAL"]}},
            {"company_id": 1, "name": 1}
        ).to_list(1000)
        
        repaired_count = 0
        
        for company in companies:
            company_id = company.get("company_id")
            count = await get_enabled_lotteries_count(company_id)
            
            if count == 0:
                # Auto-repair
                result = await repair_company_lottery_state(company_id)
                if result.get("fixed"):
                    repaired_count += 1
                    print(f"[STARTUP] Auto-repaired lotteries for {company.get('name')}: 0 -> {result['after']}")
        
        if repaired_count > 0:
            print(f"[STARTUP] Lottery sync completed: {repaired_count} companies repaired")
        
    except Exception as e:
        print(f"[STARTUP] Lottery sync error: {str(e)}")
