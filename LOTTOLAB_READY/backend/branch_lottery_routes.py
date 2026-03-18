"""
LOTTOLAB - Branch Lottery Management Routes
Implements branch-level lottery permissions on top of company-level activation.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import List, Optional
import uuid

branch_lottery_router = APIRouter(prefix="/api/company/branches", tags=["Branch Lotteries"])

db = None

def set_branch_lottery_db(database):
    global db
    db = database


async def get_current_user_for_branch(authorization: str = None):
    """Simple token validation for branch routes"""
    # Implementation would use JWT validation
    pass


class BranchLotteryResponse(BaseModel):
    lottery_id: str
    lottery_name: str
    state_code: Optional[str] = None
    enabled_for_branch: bool
    enabled_for_company: bool
    draw_times: List[str] = []


class BranchLotteryUpdate(BaseModel):
    enabled: bool


# ============================================================================
# GET BRANCH LOTTERIES
# ============================================================================

@branch_lottery_router.get("/{branch_id}/lotteries")
async def get_branch_lotteries(branch_id: str):
    """
    Get all lotteries available for a branch.
    Shows company-enabled lotteries and their branch-level status.
    """
    try:
        # Get branch info
        branch = await db.succursales.find_one({"succursale_id": branch_id})
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        
        company_id = branch.get("company_id")
        
        # Get company-enabled lotteries
        company_lotteries = await db.company_lotteries.find({
            "company_id": company_id,
            "$or": [
                {"is_enabled_for_company": True},
                {"is_enabled": True},
                {"enabled": True}
            ]
        }).to_list(300)
        
        company_lottery_ids = {cl["lottery_id"] for cl in company_lotteries}
        
        # Get branch-level overrides
        branch_lotteries = await db.branch_lotteries.find({
            "branch_id": branch_id
        }).to_list(300)
        
        branch_lottery_map = {bl["lottery_id"]: bl for bl in branch_lotteries}
        
        # Get master lottery details and schedules
        result = []
        for cl in company_lotteries:
            lottery_id = cl["lottery_id"]
            
            # Get master lottery info
            master = await db.master_lotteries.find_one(
                {"lottery_id": lottery_id},
                {"_id": 0, "lottery_id": 1, "lottery_name": 1, "state_code": 1}
            )
            
            if not master:
                continue
            
            # Get schedules
            schedules = await db.global_schedules.find(
                {"lottery_id": lottery_id},
                {"_id": 0, "draw_type": 1, "draw_time": 1}
            ).to_list(10)
            
            draw_times = [f"{s.get('draw_type', '')}: {s.get('draw_time', '')}" for s in schedules]
            
            # Check branch-level status
            branch_override = branch_lottery_map.get(lottery_id)
            enabled_for_branch = branch_override.get("enabled", True) if branch_override else True
            
            result.append({
                "lottery_id": lottery_id,
                "lottery_name": master.get("lottery_name", cl.get("lottery_name")),
                "state_code": master.get("state_code", ""),
                "enabled_for_branch": enabled_for_branch,
                "enabled_for_company": True,  # Already filtered
                "draw_times": draw_times
            })
        
        return {
            "branch_id": branch_id,
            "branch_name": branch.get("name"),
            "company_id": company_id,
            "total_lotteries": len(result),
            "enabled_count": sum(1 for r in result if r["enabled_for_branch"]),
            "lotteries": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENABLE LOTTERY FOR BRANCH
# ============================================================================

@branch_lottery_router.post("/{branch_id}/lotteries/{lottery_id}/enable")
async def enable_lottery_for_branch(branch_id: str, lottery_id: str):
    """Enable a lottery for a specific branch"""
    try:
        # Verify branch exists
        branch = await db.succursales.find_one({"succursale_id": branch_id})
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        
        company_id = branch.get("company_id")
        
        # Verify lottery is enabled at company level
        company_lottery = await db.company_lotteries.find_one({
            "company_id": company_id,
            "lottery_id": lottery_id,
            "$or": [
                {"is_enabled_for_company": True},
                {"is_enabled": True},
                {"enabled": True}
            ]
        })
        
        if not company_lottery:
            raise HTTPException(
                status_code=400, 
                detail="Cette loterie n'est pas activée au niveau de la compagnie"
            )
        
        # Update or create branch lottery setting
        await db.branch_lotteries.update_one(
            {"branch_id": branch_id, "lottery_id": lottery_id},
            {
                "$set": {
                    "branch_id": branch_id,
                    "company_id": company_id,
                    "lottery_id": lottery_id,
                    "enabled": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        # Increment config version
        await db.company_config_versions.update_one(
            {"company_id": company_id},
            {"$inc": {"version": 1}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        
        return {"message": "Loterie activée pour cette succursale", "lottery_id": lottery_id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DISABLE LOTTERY FOR BRANCH
# ============================================================================

@branch_lottery_router.post("/{branch_id}/lotteries/{lottery_id}/disable")
async def disable_lottery_for_branch(branch_id: str, lottery_id: str):
    """Disable a lottery for a specific branch"""
    try:
        # Verify branch exists
        branch = await db.succursales.find_one({"succursale_id": branch_id})
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        
        company_id = branch.get("company_id")
        
        # Update or create branch lottery setting
        await db.branch_lotteries.update_one(
            {"branch_id": branch_id, "lottery_id": lottery_id},
            {
                "$set": {
                    "branch_id": branch_id,
                    "company_id": company_id,
                    "lottery_id": lottery_id,
                    "enabled": False,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        # Increment config version
        await db.company_config_versions.update_one(
            {"company_id": company_id},
            {"$inc": {"version": 1}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        
        return {"message": "Loterie désactivée pour cette succursale", "lottery_id": lottery_id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# BULK UPDATE BRANCH LOTTERIES
# ============================================================================

class BulkLotteryUpdate(BaseModel):
    lottery_ids: List[str]
    enabled: bool


@branch_lottery_router.post("/{branch_id}/lotteries/bulk-update")
async def bulk_update_branch_lotteries(branch_id: str, update: BulkLotteryUpdate):
    """Enable or disable multiple lotteries for a branch at once"""
    try:
        # Verify branch exists
        branch = await db.succursales.find_one({"succursale_id": branch_id})
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        
        company_id = branch.get("company_id")
        
        # If enabling, verify all lotteries are enabled at company level
        if update.enabled:
            company_lotteries = await db.company_lotteries.find({
                "company_id": company_id,
                "lottery_id": {"$in": update.lottery_ids},
                "$or": [
                    {"is_enabled_for_company": True},
                    {"is_enabled": True},
                    {"enabled": True}
                ]
            }).to_list(300)
            
            enabled_ids = {cl["lottery_id"] for cl in company_lotteries}
            invalid_ids = set(update.lottery_ids) - enabled_ids
            
            if invalid_ids:
                raise HTTPException(
                    status_code=400,
                    detail=f"Les loteries suivantes ne sont pas activées au niveau compagnie: {list(invalid_ids)}"
                )
        
        # Update all lotteries
        now = datetime.now(timezone.utc).isoformat()
        
        for lottery_id in update.lottery_ids:
            await db.branch_lotteries.update_one(
                {"branch_id": branch_id, "lottery_id": lottery_id},
                {
                    "$set": {
                        "branch_id": branch_id,
                        "company_id": company_id,
                        "lottery_id": lottery_id,
                        "enabled": update.enabled,
                        "updated_at": now
                    }
                },
                upsert=True
            )
        
        # Increment config version
        await db.company_config_versions.update_one(
            {"company_id": company_id},
            {"$inc": {"version": 1}, "$set": {"updated_at": now}},
            upsert=True
        )
        
        action = "activées" if update.enabled else "désactivées"
        return {
            "message": f"{len(update.lottery_ids)} loteries {action} pour cette succursale",
            "count": len(update.lottery_ids)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# GET AGENT AVAILABLE LOTTERIES
# ============================================================================

@branch_lottery_router.get("/agent/{agent_id}/available-lotteries")
async def get_agent_available_lotteries(agent_id: str):
    """
    Get lotteries available for an agent based on:
    1. Company-level activation
    2. Branch-level permissions
    3. Schedule validity
    """
    try:
        # Get agent info
        agent = await db.users.find_one(
            {"user_id": agent_id},
            {"_id": 0, "company_id": 1, "succursale_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        company_id = agent.get("company_id")
        branch_id = agent.get("succursale_id")
        
        # Get company-enabled lotteries
        company_lotteries = await db.company_lotteries.find({
            "company_id": company_id,
            "$or": [
                {"is_enabled_for_company": True},
                {"is_enabled": True},
                {"enabled": True}
            ]
        }).to_list(300)
        
        company_lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
        
        # Get branch overrides (if any)
        branch_disabled = set()
        if branch_id:
            branch_lotteries = await db.branch_lotteries.find({
                "branch_id": branch_id,
                "enabled": False
            }).to_list(300)
            branch_disabled = {bl["lottery_id"] for bl in branch_lotteries}
        
        # Filter out branch-disabled lotteries
        available_ids = [lid for lid in company_lottery_ids if lid not in branch_disabled]
        
        # Get master lottery details
        lotteries = await db.master_lotteries.find(
            {"lottery_id": {"$in": available_ids}},
            {"_id": 0}
        ).to_list(300)
        
        # Get schedules
        schedules = await db.global_schedules.find(
            {"lottery_id": {"$in": available_ids}},
            {"_id": 0}
        ).to_list(500)
        
        return {
            "agent_id": agent_id,
            "company_id": company_id,
            "branch_id": branch_id,
            "enabled_lotteries": lotteries,
            "schedules": schedules,
            "total_count": len(lotteries)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AUTO-SYNC WHEN COMPANY DISABLES LOTTERY
# ============================================================================

async def sync_branch_lotteries_on_company_change(company_id: str, lottery_id: str, enabled: bool):
    """
    When a company disables a lottery, automatically disable it in all branches.
    Called from company lottery routes.
    """
    if not enabled:
        # Disable in all branches
        await db.branch_lotteries.update_many(
            {"company_id": company_id, "lottery_id": lottery_id},
            {"$set": {"enabled": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Increment config version
        await db.company_config_versions.update_one(
            {"company_id": company_id},
            {"$inc": {"version": 1}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
