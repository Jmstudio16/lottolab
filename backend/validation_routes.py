"""
LOTTOLAB - Database Validation and Repair Script
Ensures all relationships and data integrity for the lottery system.
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
import asyncio

validation_router = APIRouter(prefix="/api/admin", tags=["Database Validation"])

db = None

def set_validation_db(database):
    global db
    db = database


async def validate_and_repair_database():
    """
    Comprehensive database validation and repair.
    Returns a report of issues found and fixed.
    """
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "issues_found": [],
        "repairs_made": [],
        "summary": {}
    }
    
    # 1. CHECK MASTER LOTTERIES
    master_count = await db.master_lotteries.count_documents({})
    report["summary"]["master_lotteries"] = master_count
    
    if master_count == 0:
        report["issues_found"].append("CRITICAL: No master_lotteries found")
    
    # 2. CHECK GLOBAL SCHEDULES
    schedules_count = await db.global_schedules.count_documents({})
    report["summary"]["global_schedules"] = schedules_count
    
    # Check for orphan schedules (schedules without matching lottery)
    master_lottery_ids = [l["lottery_id"] async for l in db.master_lotteries.find({}, {"lottery_id": 1})]
    orphan_schedules = await db.global_schedules.count_documents({
        "lottery_id": {"$nin": master_lottery_ids}
    })
    if orphan_schedules > 0:
        report["issues_found"].append(f"WARNING: {orphan_schedules} orphan schedules found")
    
    # 3. CHECK COMPANIES
    companies_count = await db.companies.count_documents({})
    report["summary"]["companies"] = companies_count
    
    # Fix companies with lowercase status
    result = await db.companies.update_many(
        {"status": {"$in": ["active", "suspended", "inactive"]}},
        [{"$set": {"status": {"$toUpper": "$status"}}}]
    )
    if result.modified_count > 0:
        report["repairs_made"].append(f"Fixed {result.modified_count} company status to uppercase")
    
    # Remove deleted_at from active companies
    result = await db.companies.update_many(
        {"status": "ACTIVE", "deleted_at": {"$exists": True}},
        {"$unset": {"deleted_at": 1, "deleted_by": 1}}
    )
    if result.modified_count > 0:
        report["repairs_made"].append(f"Removed deleted_at from {result.modified_count} active companies")
    
    # 4. CHECK COMPANY LOTTERIES
    company_lotteries_count = await db.company_lotteries.count_documents({})
    report["summary"]["company_lotteries"] = company_lotteries_count
    
    # Ensure all company lotteries have consistent enabled flags
    result = await db.company_lotteries.update_many(
        {"is_enabled_for_company": {"$exists": False}},
        [{"$set": {"is_enabled_for_company": {"$ifNull": ["$enabled", True]}}}]
    )
    if result.modified_count > 0:
        report["repairs_made"].append(f"Added is_enabled_for_company to {result.modified_count} company_lotteries")
    
    # 5. CHECK AGENTS/USERS
    agents_count = await db.users.count_documents({"role": "AGENT_POS"})
    report["summary"]["agents"] = agents_count
    
    # Fix agents with suspended_reason: COMPANY_DELETED where company is active
    async for agent in db.users.find({"suspended_reason": "COMPANY_DELETED"}):
        company = await db.companies.find_one({"company_id": agent.get("company_id")})
        if company and company.get("status") == "ACTIVE":
            await db.users.update_one(
                {"user_id": agent["user_id"]},
                {"$unset": {"suspended_reason": 1, "suspended_at": 1}}
            )
            report["repairs_made"].append(f"Fixed agent {agent.get('email')} suspended status")
    
    # Fix user status to uppercase
    result = await db.users.update_many(
        {"status": {"$in": ["active", "suspended", "inactive"]}},
        [{"$set": {"status": {"$toUpper": "$status"}}}]
    )
    if result.modified_count > 0:
        report["repairs_made"].append(f"Fixed {result.modified_count} user status to uppercase")
    
    # 6. CHECK SUCCURSALES/BRANCHES
    branches_count = await db.succursales.count_documents({})
    report["summary"]["succursales"] = branches_count
    
    # 7. CHECK LOTTERY RESULTS
    results_count = await db.lottery_results.count_documents({})
    report["summary"]["lottery_results"] = results_count
    
    # 8. CHECK TICKETS
    tickets_count = await db.lottery_transactions.count_documents({})
    report["summary"]["tickets"] = tickets_count
    
    # 9. VERIFY EACH ACTIVE COMPANY HAS LOTTERIES ENABLED
    async for company in db.companies.find({"status": "ACTIVE"}):
        company_id = company["company_id"]
        cl_count = await db.company_lotteries.count_documents({
            "company_id": company_id,
            "$or": [
                {"is_enabled_for_company": True},
                {"is_enabled": True},
                {"enabled": True}
            ]
        })
        if cl_count == 0:
            report["issues_found"].append(f"WARNING: Company {company.get('name')} has 0 enabled lotteries")
            
            # Auto-enable all master lotteries for this company
            master_lotteries = await db.master_lotteries.find({}).to_list(300)
            for ml in master_lotteries:
                existing = await db.company_lotteries.find_one({
                    "company_id": company_id,
                    "lottery_id": ml["lottery_id"]
                })
                if not existing:
                    await db.company_lotteries.insert_one({
                        "company_id": company_id,
                        "lottery_id": ml["lottery_id"],
                        "lottery_name": ml.get("lottery_name"),
                        "enabled": True,
                        "is_enabled": True,
                        "is_enabled_for_company": True,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    })
            report["repairs_made"].append(f"Auto-enabled {len(master_lotteries)} lotteries for company {company.get('name')}")
    
    # 10. CHECK SCHEDULES EXIST FOR EACH ACTIVE LOTTERY
    active_lotteries = await db.master_lotteries.find(
        {"is_active_global": True}, 
        {"lottery_id": 1, "lottery_name": 1}
    ).to_list(300)
    
    for lottery in active_lotteries:
        schedule_count = await db.global_schedules.count_documents({"lottery_id": lottery["lottery_id"]})
        if schedule_count == 0:
            report["issues_found"].append(f"WARNING: Lottery {lottery.get('lottery_name')} has no schedules")
    
    # Final summary
    report["summary"]["issues_count"] = len(report["issues_found"])
    report["summary"]["repairs_count"] = len(report["repairs_made"])
    
    return report


@validation_router.get("/validate-database")
async def run_database_validation():
    """Run database validation and repair"""
    try:
        report = await validate_and_repair_database()
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@validation_router.post("/repair-company/{company_id}")
async def repair_company_lotteries(company_id: str):
    """Repair a specific company's lottery configuration"""
    try:
        company = await db.companies.find_one({"company_id": company_id})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        repairs = []
        
        # Fix company status
        if company.get("status", "").lower() == "active":
            await db.companies.update_one(
                {"company_id": company_id},
                {"$set": {"status": "ACTIVE"}}
            )
            repairs.append("Fixed company status to ACTIVE")
        
        # Remove deleted_at if exists and company is active
        if company.get("deleted_at"):
            await db.companies.update_one(
                {"company_id": company_id},
                {"$unset": {"deleted_at": 1, "deleted_by": 1}}
            )
            repairs.append("Removed deleted_at field")
        
        # Ensure company has lotteries enabled
        cl_count = await db.company_lotteries.count_documents({
            "company_id": company_id,
            "$or": [
                {"is_enabled_for_company": True},
                {"is_enabled": True},
                {"enabled": True}
            ]
        })
        
        if cl_count == 0:
            # Enable all master lotteries
            master_lotteries = await db.master_lotteries.find({}).to_list(300)
            for ml in master_lotteries:
                existing = await db.company_lotteries.find_one({
                    "company_id": company_id,
                    "lottery_id": ml["lottery_id"]
                })
                if not existing:
                    await db.company_lotteries.insert_one({
                        "company_id": company_id,
                        "lottery_id": ml["lottery_id"],
                        "lottery_name": ml.get("lottery_name"),
                        "enabled": True,
                        "is_enabled": True,
                        "is_enabled_for_company": True,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    })
            repairs.append(f"Enabled {len(master_lotteries)} lotteries")
        
        # Fix agents for this company
        result = await db.users.update_many(
            {"company_id": company_id, "suspended_reason": "COMPANY_DELETED"},
            {"$unset": {"suspended_reason": 1, "suspended_at": 1}}
        )
        if result.modified_count > 0:
            repairs.append(f"Fixed {result.modified_count} agents")
        
        # Update config version
        await db.company_config_versions.update_one(
            {"company_id": company_id},
            {"$inc": {"version": 1}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        repairs.append("Incremented config version")
        
        return {
            "company_id": company_id,
            "company_name": company.get("name"),
            "repairs_made": repairs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
