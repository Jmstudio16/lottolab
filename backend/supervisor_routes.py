"""
Supervisor Routes - Manages supervisor access to their agents
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorClient
from models import UserRole
from utils import get_current_timestamp, generate_id
from auth import decode_token
import os

# Database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'lottolab')]

supervisor_router = APIRouter(prefix="/api/supervisor", tags=["Supervisor"])
security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current user from JWT token"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"user_id": payload.get("user_id")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


def require_supervisor(current_user: dict):
    """Verify user is a supervisor"""
    if current_user.get("role") not in [UserRole.BRANCH_SUPERVISOR, "BRANCH_SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Access denied - Supervisor only")
    return current_user


@supervisor_router.get("/agents")
async def get_supervisor_agents(current_user: dict = Depends(get_current_user)):
    """Get agents managed by this supervisor"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    # Get agents in the same succursale or created by this supervisor
    query = {
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "status": {"$ne": "DELETED"},
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    }
    
    agents = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(100)
    
    # Get sales for today and enrich with commission from agent_policies
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for agent in agents:
        agent_id = agent.get("user_id")
        
        # Get commission from agent_policies
        agent_policy = await db.agent_policies.find_one(
            {"agent_id": agent_id},
            {"_id": 0}
        )
        if agent_policy and agent_policy.get("commission_percent") is not None:
            agent["commission_percent"] = agent_policy.get("commission_percent")
        elif agent.get("commission_percent") is None:
            agent["commission_percent"] = 10  # Default
        
        # Get tickets today from lottery_transactions
        tickets_today = await db.lottery_transactions.count_documents({
            "agent_id": agent_id,
            "created_at": {"$regex": f"^{today}"}
        })
        agent["tickets_today"] = tickets_today
        
        # Get sales today
        sales_pipeline = [
            {"$match": {"agent_id": agent_id, "created_at": {"$regex": f"^{today}"}}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]
        sales_result = await db.lottery_transactions.aggregate(sales_pipeline).to_list(1)
        agent["sales_today"] = sales_result[0]["total"] if sales_result else 0
    
    return agents


@supervisor_router.get("/dashboard-stats")
async def get_supervisor_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard stats for supervisor"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    # Count agents
    query = {
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "status": {"$ne": "DELETED"},
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    }
    
    total_agents = await db.users.count_documents(query)
    active_agents = await db.users.count_documents({**query, "status": "ACTIVE"})
    
    # Today's tickets
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tickets_today = await db.tickets.count_documents({
        "company_id": company_id,
        "succursale_id": succursale_id,
        "created_at": {"$regex": f"^{today}"}
    })
    
    return {
        "total_agents": total_agents,
        "active_agents": active_agents,
        "suspended_agents": total_agents - active_agents,
        "tickets_today": tickets_today
    }


@supervisor_router.put("/agents/{agent_id}/suspend")
async def supervisor_suspend_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Suspend an agent"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    agent = await db.users.find_one({
        "user_id": agent_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    })
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé ou non autorisé")
    
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": {"status": "SUSPENDED", "updated_at": get_current_timestamp()}}
    )
    
    return {"message": "Agent suspendu avec succès"}


@supervisor_router.put("/agents/{agent_id}/activate")
async def supervisor_activate_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Activate an agent"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    agent = await db.users.find_one({
        "user_id": agent_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    })
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé ou non autorisé")
    
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": {"status": "ACTIVE", "updated_at": get_current_timestamp()}}
    )
    
    return {"message": "Agent réactivé avec succès"}


@supervisor_router.delete("/agents/{agent_id}")
async def supervisor_delete_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an agent (soft delete)"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    agent = await db.users.find_one({
        "user_id": agent_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    })
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé ou non autorisé")
    
    # Check if agent has active tickets
    active_tickets = await db.tickets.count_documents({
        "agent_id": agent_id,
        "status": {"$in": ["PENDING", "ACTIVE"]}
    })
    
    if active_tickets > 0:
        raise HTTPException(status_code=400, detail=f"Impossible: {active_tickets} tickets actifs")
    
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": {"status": "DELETED", "deleted_at": get_current_timestamp()}}
    )
    
    return {"message": "Agent supprimé avec succès"}


@supervisor_router.put("/agents/{agent_id}")
async def supervisor_update_agent(agent_id: str, update_data: dict, current_user: dict = Depends(get_current_user)):
    """Update agent info"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    agent = await db.users.find_one({
        "user_id": agent_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    })
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé ou non autorisé")
    
    allowed_fields = {"name", "telephone", "commission_percent"}
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    update_fields["updated_at"] = get_current_timestamp()
    
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": update_fields}
    )
    
    return {"message": "Agent mis à jour avec succès"}


@supervisor_router.get("/agents/{agent_id}/tickets")
async def supervisor_get_agent_tickets(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Get tickets for a specific agent - checks both collections"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    
    # First try lottery_transactions (main collection for vendeur sales)
    tickets = await db.lottery_transactions.find(
        {"agent_id": agent_id, "company_id": company_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    # If no tickets found, also check tickets collection as fallback
    if not tickets:
        tickets = await db.tickets.find(
            {"agent_id": agent_id, "company_id": company_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(100).to_list(100)
    
    return tickets


@supervisor_router.get("/my-profile")
async def get_supervisor_profile(current_user: dict = Depends(get_current_user)):
    """Get supervisor profile with commission info"""
    current_user = require_supervisor(current_user)
    
    supervisor_id = current_user.get("user_id")
    
    # Get supervisor's commission percentage from multiple sources
    commission_percent = current_user.get("commission_percent", 10)
    
    # Check supervisor_policies first (this is where it's stored on creation)
    supervisor_policy = await db.supervisor_policies.find_one(
        {"supervisor_id": supervisor_id},
        {"_id": 0}
    )
    if supervisor_policy and supervisor_policy.get("commission_percent") is not None:
        commission_percent = supervisor_policy.get("commission_percent")
    
    # Also check succursales table (backup source)
    if commission_percent == 10:  # Still default
        succursale = await db.succursales.find_one(
            {"supervisor_id": supervisor_id},
            {"_id": 0, "supervisor_commission_percent": 1}
        )
        if succursale and succursale.get("supervisor_commission_percent") is not None:
            commission_percent = succursale.get("supervisor_commission_percent")
    
    return {
        "user_id": supervisor_id,
        "name": current_user.get("name") or current_user.get("full_name"),
        "email": current_user.get("email"),
        "role": current_user.get("role"),
        "company_id": current_user.get("company_id"),
        "succursale_id": current_user.get("succursale_id"),
        "commission_percent": commission_percent,
        "status": current_user.get("status")
    }


@supervisor_router.get("/sales-report")
async def get_supervisor_sales_report(
    date_from: str = None,
    date_to: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed sales report for supervisor's agents"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    supervisor_id = current_user.get("user_id")
    
    # Get supervisor's commission percentage from supervisor_policies or succursales
    supervisor_commission = current_user.get("commission_percent", 10)
    
    # Check supervisor_policies first
    supervisor_policy = await db.supervisor_policies.find_one(
        {"supervisor_id": supervisor_id},
        {"_id": 0}
    )
    if supervisor_policy and supervisor_policy.get("commission_percent") is not None:
        supervisor_commission = supervisor_policy.get("commission_percent")
    
    # Also check succursales table
    if supervisor_commission == 10:  # Still default
        succursale = await db.succursales.find_one(
            {"supervisor_id": supervisor_id},
            {"_id": 0, "supervisor_commission_percent": 1}
        )
        if succursale and succursale.get("supervisor_commission_percent") is not None:
            supervisor_commission = succursale.get("supervisor_commission_percent")
    
    # Get agents under this supervisor
    agents_query = {
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "status": {"$ne": "DELETED"},
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": supervisor_id}
        ]
    }
    agents = await db.users.find(agents_query, {"_id": 0, "password_hash": 0}).to_list(100)
    
    # Build date filter
    date_filter = {}
    if date_from:
        date_filter["$gte"] = date_from
    if date_to:
        date_filter["$lte"] = date_to + "T23:59:59"
    
    # Build report data for each agent
    report_data = []
    totals = {
        "total_tickets": 0,
        "total_gagnants": 0,
        "total_ventes": 0,
        "total_paye": 0,
        "total_comm_agent": 0,
        "total_comm_sup": 0,
        "balance_final": 0
    }
    
    for agent in agents:
        agent_id = agent.get("user_id")
        
        # Get agent's commission from agent_policies or users document
        agent_commission = agent.get("commission_percent", 10)
        agent_policy = await db.agent_policies.find_one(
            {"agent_id": agent_id},
            {"_id": 0}
        )
        if agent_policy and agent_policy.get("commission_percent") is not None:
            agent_commission = agent_policy.get("commission_percent")
        
        # Build ticket query
        ticket_query = {"agent_id": agent_id, "company_id": company_id}
        if date_filter:
            ticket_query["created_at"] = date_filter
        
        # Get tickets from lottery_transactions
        tickets = await db.lottery_transactions.find(
            ticket_query,
            {"_id": 0, "total_amount": 1, "status": 1, "winnings": 1, "payout_amount": 1}
        ).to_list(1000)
        
        # Calculate stats
        total_tickets = len(tickets)
        tickets_gagnants = sum(1 for t in tickets if t.get("status") == "WINNER")
        total_ventes = sum(t.get("total_amount", 0) for t in tickets)
        total_paye = sum(t.get("winnings", 0) or t.get("payout_amount", 0) for t in tickets if t.get("status") == "WINNER")
        
        # Calculate commissions
        comm_agent = (total_ventes * agent_commission) / 100
        comm_sup = (total_ventes * supervisor_commission) / 100
        pp_sans_agent = total_ventes - total_paye
        pp_avec_agent = pp_sans_agent - comm_agent
        balance_final = pp_avec_agent - comm_sup
        
        report_data.append({
            "agent_id": agent_id,
            "agent_name": agent.get("name") or agent.get("full_name") or "Agent",
            "total_tickets": total_tickets,
            "tickets_gagnants": tickets_gagnants,
            "total_ventes": total_ventes,
            "total_paye": total_paye,
            "pourcentage_agent": agent_commission,
            "comm_agent": comm_agent,
            "pp_sans_agent": pp_sans_agent,
            "pp_avec_agent": pp_avec_agent,
            "pourcentage_sup": supervisor_commission,
            "comm_sup": comm_sup,
            "balance_final": balance_final
        })
        
        # Update totals
        totals["total_tickets"] += total_tickets
        totals["total_gagnants"] += tickets_gagnants
        totals["total_ventes"] += total_ventes
        totals["total_paye"] += total_paye
        totals["total_comm_agent"] += comm_agent
        totals["total_comm_sup"] += comm_sup
        totals["balance_final"] += balance_final
    
    return {
        "supervisor_commission": supervisor_commission,
        "agents": report_data,
        "totals": totals,
        "date_from": date_from,
        "date_to": date_to
    }



# ==================== RESULTS & LOTTERY SCHEDULES (READ-ONLY) ====================

@supervisor_router.get("/results")
async def get_supervisor_results(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get lottery results (read-only for supervisors) - synchronized with all system"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    
    # Get results from global_results collection (synchronized with Super Admin)
    results = await db.global_results.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # If no global results, try draw_results
    if not results:
        results = await db.draw_results.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return results


@supervisor_router.get("/lottery-schedules")
async def get_supervisor_lottery_schedules(current_user: dict = Depends(get_current_user)):
    """Get lottery schedules/hours (read-only for supervisors) - synced with vendeur lotteries"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    # Get company lotteries (same as vendeur uses)
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "$or": [{"is_enabled": True}, {"enabled": True}]},
        {"_id": 0}
    ).to_list(300)
    
    lottery_ids = [cl.get("lottery_id") for cl in company_lotteries if cl.get("lottery_id")]
    
    # Get master lottery data for schedules
    master_lotteries = {}
    if lottery_ids:
        master_list = await db.master_lotteries.find(
            {"lottery_id": {"$in": lottery_ids}},
            {"_id": 0}
        ).to_list(300)
        master_lotteries = {ml.get("lottery_id"): ml for ml in master_list}
    
    # Also check global_lotteries as fallback
    global_lotteries = {}
    if lottery_ids:
        global_list = await db.global_lotteries.find(
            {"lottery_id": {"$in": lottery_ids}},
            {"_id": 0}
        ).to_list(300)
        global_lotteries = {gl.get("lottery_id"): gl for gl in global_list}
    
    # Enrich company lotteries with master data
    enriched_lotteries = []
    for lottery in company_lotteries:
        lottery_id = lottery.get("lottery_id")
        master = master_lotteries.get(lottery_id, {})
        global_lot = global_lotteries.get(lottery_id, {})
        
        # Get name from various sources
        lottery_name = (
            lottery.get("lottery_name") or 
            lottery.get("name") or 
            master.get("name") or 
            master.get("lottery_name") or
            global_lot.get("name") or
            global_lot.get("lottery_name") or
            f"Loterie {lottery_id[-6:]}" if lottery_id else "Loterie Inconnue"
        )
        
        # Get state code
        state_code = (
            lottery.get("state_code") or 
            master.get("state_code") or 
            global_lot.get("state_code") or 
            "AUTRE"
        )
        
        # Get draws/schedules
        draws = (
            lottery.get("draws") or 
            master.get("draws") or 
            global_lot.get("draws") or 
            []
        )
        
        # Get times
        open_time = lottery.get("open_time") or master.get("open_time") or global_lot.get("open_time") or "09:00"
        close_time = lottery.get("close_time") or master.get("close_time") or global_lot.get("close_time") or "20:00"
        draw_times = lottery.get("draw_times") or master.get("draw_times") or global_lot.get("draw_times") or []
        
        enriched_lotteries.append({
            "lottery_id": lottery_id,
            "lottery_name": lottery_name,
            "state_code": state_code,
            "is_enabled": lottery.get("is_enabled", True) or lottery.get("enabled", True),
            "disabled_by_super_admin": lottery.get("disabled_by_super_admin") == True,  # Explicitly check for True
            "draws": draws,
            "open_time": open_time,
            "close_time": close_time,
            "draw_times": draw_times
        })
    
    return enriched_lotteries



# ============================================================================
# SUPERVISOR FLAG CONFIGURATION - Manage lottery flags for agents
# ============================================================================

@supervisor_router.get("/lottery-flags")
async def get_supervisor_lottery_flags(current_user: dict = Depends(get_current_user)):
    """
    Get all lotteries with their flag configurations for supervisor's view.
    Shows all company lotteries that the supervisor can configure for their agents.
    """
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    # Get all enabled lotteries for this company
    company_lotteries = await db.company_lotteries.find(
        {
            "company_id": company_id,
            "$or": [{"is_enabled": True}, {"enabled": True}, {"is_enabled_for_company": True}]
        },
        {"_id": 0}
    ).to_list(300)
    
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    # Get master lottery details
    master_data = {}
    if lottery_ids:
        masters = await db.master_lotteries.find(
            {"lottery_id": {"$in": lottery_ids}},
            {"_id": 0}
        ).to_list(300)
        master_data = {m["lottery_id"]: m for m in masters}
    
    # Get branch-level flag overrides (if supervisor has configured any)
    branch_flags = {}
    if succursale_id:
        branch_flag_docs = await db.branch_lottery_flags.find(
            {"branch_id": succursale_id},
            {"_id": 0}
        ).to_list(300)
        branch_flags = {bf["lottery_id"]: bf for bf in branch_flag_docs}
    
    # Build result
    result = []
    for cl in company_lotteries:
        lottery_id = cl["lottery_id"]
        master = master_data.get(lottery_id, {})
        branch_flag = branch_flags.get(lottery_id, {})
        
        # Priority: branch flag > company flag > master flag
        flag_type = branch_flag.get("flag_type") or cl.get("flag_type") or master.get("flag_type") or "USA"
        is_enabled_for_branch = branch_flag.get("is_enabled", True) if branch_flag else True
        
        result.append({
            "lottery_id": lottery_id,
            "lottery_name": master.get("lottery_name") or cl.get("lottery_name") or lottery_id,
            "state_code": master.get("state_code") or cl.get("state_code"),
            "draw_time": master.get("draw_time"),
            "flag_type": flag_type,
            "is_enabled": is_enabled_for_branch,
            "company_flag": cl.get("flag_type"),
            "branch_flag": branch_flag.get("flag_type")
        })
    
    return sorted(result, key=lambda x: x.get("lottery_name", ""))


@supervisor_router.post("/lottery-flags")
async def update_supervisor_lottery_flags(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Update lottery flag configurations for the supervisor's branch.
    Accepts: { "assignments": [{ "lottery_id": "...", "flag_type": "HAITI" | "USA", "is_enabled": true/false }] }
    """
    current_user = require_supervisor(current_user)
    
    succursale_id = current_user.get("succursale_id")
    if not succursale_id:
        raise HTTPException(status_code=400, detail="Supervisor n'a pas de succursale assignée")
    
    assignments = data.get("assignments", [])
    if not assignments:
        raise HTTPException(status_code=400, detail="Aucune assignation fournie")
    
    now = get_current_timestamp()
    updated_count = 0
    
    for assignment in assignments:
        lottery_id = assignment.get("lottery_id")
        flag_type = assignment.get("flag_type", "USA")
        is_enabled = assignment.get("is_enabled", True)
        
        if not lottery_id:
            continue
        
        # Upsert branch-level flag configuration
        await db.branch_lottery_flags.update_one(
            {"branch_id": succursale_id, "lottery_id": lottery_id},
            {"$set": {
                "branch_id": succursale_id,
                "lottery_id": lottery_id,
                "flag_type": flag_type,
                "is_enabled": is_enabled,
                "updated_by": current_user.get("user_id"),
                "updated_at": now
            }},
            upsert=True
        )
        updated_count += 1
    
    # Log activity
    await db.activity_logs.insert_one({
        "action_type": "SUPERVISOR_FLAG_UPDATE",
        "performed_by": current_user.get("user_id"),
        "succursale_id": succursale_id,
        "metadata": {"updated_count": updated_count},
        "created_at": now
    })
    
    return {"message": f"{updated_count} loterie(s) mise(s) à jour", "updated": updated_count}


@supervisor_router.post("/lottery-flags/toggle/{lottery_id}")
async def toggle_supervisor_lottery(
    lottery_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Toggle enable/disable for a specific lottery at the branch level.
    """
    current_user = require_supervisor(current_user)
    
    succursale_id = current_user.get("succursale_id")
    if not succursale_id:
        raise HTTPException(status_code=400, detail="Supervisor n'a pas de succursale assignée")
    
    now = get_current_timestamp()
    
    # Get current state
    existing = await db.branch_lottery_flags.find_one(
        {"branch_id": succursale_id, "lottery_id": lottery_id},
        {"_id": 0}
    )
    
    current_enabled = existing.get("is_enabled", True) if existing else True
    new_enabled = not current_enabled
    
    # Update
    await db.branch_lottery_flags.update_one(
        {"branch_id": succursale_id, "lottery_id": lottery_id},
        {"$set": {
            "branch_id": succursale_id,
            "lottery_id": lottery_id,
            "is_enabled": new_enabled,
            "updated_by": current_user.get("user_id"),
            "updated_at": now
        }},
        upsert=True
    )
    
    return {"lottery_id": lottery_id, "is_enabled": new_enabled}



# ============================================================================
# WINNING TICKETS / LOTS GAGNANTS - SUPERVISOR
# ============================================================================

@supervisor_router.get("/winning-tickets")
async def get_supervisor_winning_tickets(
    current_user: dict = Depends(get_current_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    agent_id: Optional[str] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    limit: int = 200
):
    """
    Get winning tickets for all agents under this supervisor.
    payment_status: PAID, UNPAID, or None for all
    """
    current_user = require_supervisor(current_user)
    succursale_id = current_user.get("succursale_id")
    company_id = current_user.get("company_id")
    
    # Get all agents under this supervisor
    agents = await db.users.find(
        {
            "$or": [
                {"succursale_id": succursale_id},
                {"branch_id": succursale_id}
            ],
            "role": {"$in": [UserRole.AGENT_POS, "AGENT_POS", "VENDEUR"]}
        },
        {"user_id": 1}
    ).to_list(500)
    agent_ids = [a["user_id"] for a in agents]
    
    if not agent_ids:
        return {"tickets": [], "summary": {"total_count": 0, "total_win_amount": 0}}
    
    query = {
        "agent_id": {"$in": agent_ids},
        "status": {"$in": ["WINNER", "WON", "PAID"]}
    }
    
    if agent_id and agent_id in agent_ids:
        query["agent_id"] = agent_id
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    if status:
        query["status"] = status
    
    # Filter by payment_status
    if payment_status == "PAID":
        query["payment_status"] = "PAID"
    elif payment_status == "UNPAID":
        query["$or"] = [{"payment_status": "UNPAID"}, {"payment_status": {"$exists": False}}]
    
    tickets = await db.lottery_transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Calculate totals
    total_win_amount = sum(t.get("win_amount", 0) for t in tickets)
    paid_count = sum(1 for t in tickets if t.get("payment_status") == "PAID")
    pending_count = sum(1 for t in tickets if t.get("payment_status") != "PAID")
    
    # Group by agent
    by_agent = {}
    for t in tickets:
        aid = t.get("agent_id")
        if aid not in by_agent:
            by_agent[aid] = {"count": 0, "amount": 0}
        by_agent[aid]["count"] += 1
        by_agent[aid]["amount"] += t.get("win_amount", 0)
    
    return {
        "tickets": tickets,
        "summary": {
            "total_count": len(tickets),
            "total_win_amount": total_win_amount,
            "paid_count": paid_count,
            "pending_count": pending_count,
            "by_agent": by_agent
        }
    }


# ============================================================================
# UPDATE WINNING TICKET PAYMENT STATUS
# ============================================================================

from pydantic import BaseModel

class PaymentStatusUpdate(BaseModel):
    payment_status: str  # "PAID" or "UNPAID"


@supervisor_router.put("/winning-tickets/{ticket_id}/payment-status")
async def update_winning_ticket_payment_status(
    ticket_id: str,
    data: PaymentStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update the payment status of a winning ticket.
    Only Supervisors and Company Admins can modify this.
    Once set to PAID, it cannot be changed back by a Vendeur.
    """
    current_user = require_supervisor(current_user)
    
    succursale_id = current_user.get("succursale_id")
    company_id = current_user.get("company_id")
    
    if data.payment_status not in ["PAID", "UNPAID"]:
        raise HTTPException(status_code=400, detail="payment_status doit être 'PAID' ou 'UNPAID'")
    
    # Find the ticket and verify it belongs to an agent under this supervisor
    ticket = await db.lottery_transactions.find_one(
        {"ticket_id": ticket_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    # Verify ticket is a winner
    if ticket.get("status") not in ["WINNER", "WON", "PAID"]:
        raise HTTPException(status_code=400, detail="Ce ticket n'est pas un ticket gagnant")
    
    now = get_current_timestamp()
    
    # Update the payment status
    await db.lottery_transactions.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "payment_status": data.payment_status,
            "payment_status_updated_by": current_user.get("user_id"),
            "payment_status_updated_by_name": current_user.get("name"),
            "payment_status_updated_by_role": "SUPERVISEUR",
            "payment_status_updated_at": now,
            "updated_at": now
        }}
    )
    
    # Log activity
    await db.activity_logs.insert_one({
        "action_type": "PAYMENT_STATUS_UPDATE",
        "entity_type": "ticket",
        "entity_id": ticket_id,
        "performed_by": current_user.get("user_id"),
        "performed_by_name": current_user.get("name"),
        "company_id": company_id,
        "metadata": {
            "ticket_code": ticket.get("ticket_code"),
            "new_status": data.payment_status,
            "win_amount": ticket.get("win_amount", 0)
        },
        "created_at": now
    })
    
    return {
        "message": f"Statut de paiement mis à jour: {data.payment_status}",
        "ticket_id": ticket_id,
        "payment_status": data.payment_status
    }


@supervisor_router.get("/deleted-tickets")
async def get_supervisor_deleted_tickets(
    current_user: dict = Depends(get_current_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    agent_id: Optional[str] = None,
    limit: int = 200
):
    """
    Get cancelled/deleted tickets for all agents under this supervisor.
    """
    current_user = require_supervisor(current_user)
    succursale_id = current_user.get("succursale_id")
    
    # Get all agents under this supervisor
    agents = await db.users.find(
        {
            "$or": [
                {"succursale_id": succursale_id},
                {"branch_id": succursale_id}
            ],
            "role": {"$in": [UserRole.AGENT_POS, "AGENT_POS", "VENDEUR"]}
        },
        {"user_id": 1}
    ).to_list(500)
    agent_ids = [a["user_id"] for a in agents]
    
    if not agent_ids:
        return {"tickets": [], "summary": {"total_count": 0, "total_cancelled_amount": 0}}
    
    query = {
        "agent_id": {"$in": agent_ids},
        "status": {"$in": ["CANCELLED", "VOIDED", "DELETED", "ANNULÉ", "VOID"]}
    }
    
    if agent_id and agent_id in agent_ids:
        query["agent_id"] = agent_id
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    tickets = await db.lottery_transactions.find(
        query,
        {"_id": 0}
    ).sort("updated_at", -1).limit(limit).to_list(limit)
    
    total_cancelled_amount = sum(t.get("total_amount", 0) for t in tickets)
    
    return {
        "tickets": tickets,
        "summary": {
            "total_count": len(tickets),
            "total_cancelled_amount": total_cancelled_amount
        }
    }



# ============================================================================
# DELETE/VOID TICKET - SUPERVISEUR (PAS DE LIMITE DE TEMPS)
# ============================================================================

@supervisor_router.delete("/ticket/{ticket_id}")
async def supervisor_delete_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete/void a ticket by supervisor. No time limit.
    Can delete any ticket from agents under this supervisor.
    """
    current_user = require_supervisor(current_user)
    
    supervisor_id = current_user.get("user_id")
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    # Get list of agents managed by this supervisor
    agent_ids = []
    agents = await db.users.find({
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "status": {"$ne": "DELETED"},
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": supervisor_id}
        ]
    }, {"user_id": 1}).to_list(None)
    agent_ids = [a["user_id"] for a in agents]
    
    # Find the ticket
    ticket = await db.lottery_transactions.find_one(
        {"ticket_id": ticket_id, "agent_id": {"$in": agent_ids}},
        {"_id": 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé ou non autorisé")
    
    # Check if already voided
    if ticket.get("status") in ["VOID", "VOIDED", "CANCELLED", "DELETED", "ANNULÉ"]:
        raise HTTPException(status_code=400, detail="Ce ticket est déjà supprimé")
    
    # Check if ticket has already been drawn (cannot void after draw)
    if ticket.get("status") in ["WINNER", "WON", "LOSER", "LOST"]:
        raise HTTPException(status_code=400, detail="Impossible de supprimer un ticket après le tirage")
    
    now = get_current_timestamp()
    agent_id = ticket.get("agent_id")
    
    # Update ticket status to VOID
    await db.lottery_transactions.update_one(
        {"ticket_id": ticket_id},
        {
            "$set": {
                "status": "VOID",
                "void_reason": "Supprimé par le superviseur",
                "voided_by": supervisor_id,
                "voided_by_role": "SUPERVISEUR",
                "voided_at": now,
                "updated_at": now
            }
        }
    )
    
    # Return the amount to agent balance
    total_amount = ticket.get("total_amount", 0)
    if total_amount > 0:
        await db.agent_balances.update_one(
            {"agent_id": agent_id},
            {
                "$inc": {
                    "available_balance": total_amount,
                    "total_sales": -total_amount
                },
                "$set": {"updated_at": now}
            }
        )
    
    return {
        "message": "Ticket supprimé avec succès par le superviseur",
        "ticket_id": ticket_id,
        "refunded_amount": total_amount
    }



# ============================================================================
# NOTIFICATIONS - SUPERVISOR NOTIFICATIONS
# ============================================================================

@supervisor_router.get("/notifications")
async def get_supervisor_notifications(
    current_user: dict = Depends(get_current_user),
    limit: int = 30
):
    """Get notifications for supervisor - winning tickets, deleted tickets, new results"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    supervisor_id = current_user.get("user_id")
    
    notifications = []
    now = get_current_timestamp()
    
    # Get agent IDs under this supervisor
    agent_ids = []
    agents = await db.users.find(
        {
            "company_id": company_id,
            "role": UserRole.AGENT_POS,
            "$or": [
                {"succursale_id": succursale_id},
                {"supervisor_id": supervisor_id}
            ]
        },
        {"user_id": 1}
    ).to_list(100)
    agent_ids = [a["user_id"] for a in agents]
    
    # Get recent winning tickets from agents
    if agent_ids:
        winners = await db.lottery_transactions.find(
            {
                "agent_id": {"$in": agent_ids},
                "status": "WINNER"
            },
            {"_id": 0}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        for winner in winners:
            notifications.append({
                "id": generate_id("notif_"),
                "type": "WINNER",
                "title": "Ticket gagnant!",
                "message": f"Ticket #{winner.get('ticket_code', 'N/A')} - {winner.get('winnings', 0):,.0f} HTG par {winner.get('agent_name', 'vendeur')}",
                "read": False,
                "created_at": winner.get("created_at", now)
            })
        
        # Get deleted tickets
        deleted = await db.lottery_transactions.find(
            {
                "agent_id": {"$in": agent_ids},
                "status": {"$in": ["VOID", "DELETED", "CANCELLED"]}
            },
            {"_id": 0}
        ).sort("voided_at", -1).limit(5).to_list(5)
        
        for ticket in deleted:
            notifications.append({
                "id": generate_id("notif_"),
                "type": "TICKET",
                "title": "Ticket supprimé",
                "message": f"Ticket #{ticket.get('ticket_code', 'N/A')} ({ticket.get('total_amount', 0):,.0f} HTG) supprimé",
                "read": True,
                "created_at": ticket.get("voided_at") or ticket.get("created_at", now)
            })
    
    # Get recent results
    results = await db.global_results.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).limit(3).to_list(3)
    
    for result in results:
        wn = result.get("winning_numbers", {})
        nums_str = ""
        if isinstance(wn, dict):
            nums = [str(wn.get("first", "")), str(wn.get("second", "")), str(wn.get("third", ""))]
            nums_str = " - ".join([n for n in nums if n])
        notifications.append({
            "id": generate_id("notif_"),
            "type": "RESULT",
            "title": "Nouveau résultat",
            "message": f"{result.get('lottery_name', 'Loterie')} - {nums_str}",
            "read": True,
            "created_at": result.get("created_at", now)
        })
    
    # Sort by date
    notifications.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return notifications[:limit]
