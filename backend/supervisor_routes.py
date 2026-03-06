"""
Supervisor Routes - Manages supervisor access to their agents
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from models import UserRole
from utils import get_current_timestamp
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
    """Get lottery results (read-only for supervisors)"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    
    # Get results from draw_results collection
    results = await db.draw_results.find(
        {"company_id": company_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # If no company-specific results, get global results
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
