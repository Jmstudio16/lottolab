"""
Vendeur (Seller) Routes - Complete POS functionality for lottery sales
Implements the full Vendeur experience as defined in the MÉGA-PROMPT requirements
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from models import UserRole, TicketStatus
from auth import decode_token
from utils import generate_id, generate_ticket_code, generate_verification_code, get_current_timestamp

vendeur_router = APIRouter(prefix="/api/vendeur", tags=["Vendeur"])
security = HTTPBearer()

db: AsyncIOMotorDatabase = None

def set_vendeur_db(database: AsyncIOMotorDatabase):
    global db
    db = database


async def get_current_vendeur(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Get current vendeur user and validate they have seller access"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    # Check if user is a vendeur/agent
    allowed_roles = [UserRole.AGENT_POS, "VENDEUR", "AGENT_POS"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès réservé aux vendeurs")
    
    # Check user status
    if user.get("status") != "ACTIVE":
        raise HTTPException(status_code=403, detail="Compte suspendu")
    
    return user


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class PlayCreate(BaseModel):
    numbers: str
    bet_type: str = "BORLETTE"
    amount: float = 50.0


class SellRequest(BaseModel):
    lottery_id: str
    draw_date: str
    draw_name: str = "Midday"
    plays: List[PlayCreate]


class TicketResponse(BaseModel):
    ticket_id: str
    ticket_code: str
    verification_code: str
    lottery_name: str
    draw_date: str
    draw_name: str
    total_amount: float
    potential_win: float
    plays: list
    created_at: str


# ============================================================================
# DASHBOARD STATS
# ============================================================================

@vendeur_router.get("/dashboard")
async def get_vendeur_dashboard(current_vendeur: dict = Depends(get_current_vendeur)):
    """
    Get comprehensive dashboard data for the vendeur:
    - Sales stats (today, this month)
    - Commission earned
    - Recent tickets
    - Notifications
    """
    vendeur_id = current_vendeur.get("user_id")
    company_id = current_vendeur.get("company_id")
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    this_month = now.strftime("%Y-%m")
    
    # Get today's tickets
    today_pipeline = [
        {"$match": {"agent_id": vendeur_id, "created_at": {"$regex": f"^{today}"}}},
        {"$group": {
            "_id": None,
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"},
            "winners_count": {"$sum": {"$cond": [{"$in": ["$status", ["WINNER", "WON"]]}, 1, 0]}},
            "total_wins": {"$sum": {"$cond": [{"$in": ["$status", ["WINNER", "WON"]]}, "$win_amount", 0]}}
        }}
    ]
    today_result = await db.lottery_transactions.aggregate(today_pipeline).to_list(1)
    
    # Get month's tickets
    month_pipeline = [
        {"$match": {"agent_id": vendeur_id, "created_at": {"$regex": f"^{this_month}"}}},
        {"$group": {
            "_id": None,
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"}
        }}
    ]
    month_result = await db.lottery_transactions.aggregate(month_pipeline).to_list(1)
    
    # Calculate stats
    today_stats = today_result[0] if today_result else {}
    month_stats = month_result[0] if month_result else {}
    
    ventes_jour = today_stats.get("total_sales", 0)
    ventes_mois = month_stats.get("total_sales", 0)
    tickets_jour = today_stats.get("total_tickets", 0)
    
    # Get commission rate from agent policy
    agent_policy = await db.agent_policies.find_one({"agent_id": vendeur_id}, {"_id": 0})
    commission_rate = agent_policy.get("commission_percent", 10) if agent_policy else 10
    commission = ventes_mois * (commission_rate / 100)
    
    # Get recent tickets (last 10)
    recent_tickets = await db.lottery_transactions.find(
        {"agent_id": vendeur_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Get recent results for company's lotteries
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "$or": [{"is_enabled": True}, {"enabled": True}]},
        {"lottery_id": 1}
    ).to_list(300)
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    recent_results = []
    if lottery_ids:
        recent_results = await db.global_results.find(
            {"lottery_id": {"$in": lottery_ids}},
            {"_id": 0}
        ).sort("created_at", -1).limit(10).to_list(10)
    
    # Format winning numbers to avoid React rendering error
    for result in recent_results:
        wn = result.get("winning_numbers")
        if isinstance(wn, dict):
            nums = []
            if wn.get("first"): nums.append(str(wn["first"]))
            if wn.get("second"): nums.append(str(wn["second"]))
            if wn.get("third"): nums.append(str(wn["third"]))
            result["winning_numbers_display"] = " - ".join(nums)
        else:
            result["winning_numbers_display"] = str(wn) if wn else "-"
    
    return {
        "stats": {
            "ventes_jour": ventes_jour,
            "ventes_mois": ventes_mois,
            "tickets_jour": tickets_jour,
            "commissions": commission,
            "commission_rate": commission_rate,
            "winners_today": today_stats.get("winners_count", 0),
            "total_wins_today": today_stats.get("total_wins", 0)
        },
        "recent_tickets": recent_tickets,
        "recent_results": recent_results,
        "notifications": [
            {"id": 1, "type": "info", "message": f"{len(lottery_ids)} loteries disponibles", "time": "Maintenant"},
        ],
        "vendeur": {
            "name": current_vendeur.get("name") or current_vendeur.get("full_name", "Vendeur"),
            "email": current_vendeur.get("email"),
            "status": current_vendeur.get("status")
        }
    }


# ============================================================================
# MES TICKETS - Get all tickets for this vendeur
# ============================================================================

@vendeur_router.get("/mes-tickets")
async def get_mes_tickets(
    current_vendeur: dict = Depends(get_current_vendeur),
    limit: int = 100,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """
    Get all tickets created by this vendeur with optional filters:
    - status: PENDING, WINNER, LOST, VOID
    - date_from/date_to: Date range
    """
    vendeur_id = current_vendeur.get("user_id")
    
    query = {"agent_id": vendeur_id}
    
    if status:
        if status == "WINNER":
            query["status"] = {"$in": ["WINNER", "WON"]}
        else:
            query["status"] = status
    
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to + "T23:59:59"
        else:
            query["created_at"] = {"$lte": date_to + "T23:59:59"}
    
    tickets = await db.lottery_transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return tickets


# ============================================================================
# LOTTERY SELL - Create a new ticket
# ============================================================================

@vendeur_router.post("/sell", response_model=dict)
async def sell_ticket(
    request: Request,
    sell_data: SellRequest,
    current_vendeur: dict = Depends(get_current_vendeur)
):
    """
    Create a new lottery ticket sale
    """
    vendeur_id = current_vendeur.get("user_id")
    company_id = current_vendeur.get("company_id")
    succursale_id = current_vendeur.get("succursale_id")
    
    # Validate lottery exists and is enabled
    lottery = await db.master_lotteries.find_one(
        {"lottery_id": sell_data.lottery_id},
        {"_id": 0}
    )
    if not lottery:
        lottery = await db.global_lotteries.find_one(
            {"lottery_id": sell_data.lottery_id},
            {"_id": 0}
        )
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    # Check if lottery is enabled for company
    company_lottery = await db.company_lotteries.find_one({
        "company_id": company_id,
        "lottery_id": sell_data.lottery_id,
        "$or": [{"is_enabled": True}, {"enabled": True}]
    })
    if not company_lottery:
        raise HTTPException(status_code=403, detail="Loterie non activée pour votre compagnie")
    
    # Check branch-level permissions
    if succursale_id:
        branch_disabled = await db.branch_lotteries.find_one({
            "branch_id": succursale_id,
            "lottery_id": sell_data.lottery_id,
            "enabled": False
        })
        if branch_disabled:
            raise HTTPException(status_code=403, detail="Loterie désactivée pour votre succursale")
    
    # Get company info
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Compagnie non trouvée")
    
    # Calculate totals
    total_amount = sum(play.amount for play in sell_data.plays)
    
    # Get prime config for potential win calculation
    prime_configs = await db.prime_configs.find(
        {"company_id": company_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Calculate potential win (simplified)
    potential_win = 0
    for play in sell_data.plays:
        # Default multipliers
        multiplier = 70  # Borlette default
        if play.bet_type == "LOTO3":
            multiplier = 500
        elif play.bet_type == "LOTO4":
            multiplier = 5000
        elif play.bet_type == "LOTO5":
            multiplier = 50000
        elif play.bet_type == "MARIAGE":
            multiplier = 1000
        
        # Check for custom prime config
        for pc in prime_configs:
            if pc.get("bet_type") == play.bet_type:
                multiplier = pc.get("multiplier", multiplier)
                break
        
        potential_win += play.amount * multiplier
    
    # Generate ticket
    ticket_id = generate_id("tkt_")
    ticket_code = generate_ticket_code()
    verification_code = generate_verification_code()
    now = get_current_timestamp()
    
    ticket_doc = {
        "ticket_id": ticket_id,
        "ticket_code": ticket_code,
        "verification_code": verification_code,
        "qr_payload": f"{ticket_code}|{verification_code}|{company_id}",
        "agent_id": vendeur_id,
        "agent_name": current_vendeur.get("name") or current_vendeur.get("full_name", ""),
        "company_id": company_id,
        "succursale_id": succursale_id,
        "lottery_id": sell_data.lottery_id,
        "lottery_name": lottery.get("lottery_name", ""),
        "draw_date": sell_data.draw_date,
        "draw_name": sell_data.draw_name,
        "plays": [
            {
                "numbers": play.numbers,
                "bet_type": play.bet_type,
                "amount": play.amount
            } for play in sell_data.plays
        ],
        "total_amount": total_amount,
        "potential_win": potential_win,
        "currency": company.get("currency", "HTG"),
        "status": "PENDING",
        "printed_count": 0,
        "device_type": "WEB",
        "created_at": now,
        "updated_at": now
    }
    
    await db.lottery_transactions.insert_one(ticket_doc)
    
    # Log activity
    await db.activity_logs.insert_one({
        "log_id": generate_id("log_"),
        "action_type": "TICKET_SOLD",
        "entity_type": "ticket",
        "entity_id": ticket_id,
        "performed_by": vendeur_id,
        "company_id": company_id,
        "metadata": {
            "ticket_code": ticket_code,
            "lottery_id": sell_data.lottery_id,
            "total_amount": total_amount,
            "plays_count": len(sell_data.plays)
        },
        "ip_address": request.client.host if request.client else None,
        "created_at": now
    })
    
    return {
        "ticket_id": ticket_id,
        "ticket_code": ticket_code,
        "verification_code": verification_code,
        "lottery_name": lottery.get("lottery_name", ""),
        "draw_date": sell_data.draw_date,
        "draw_name": sell_data.draw_name,
        "total_amount": total_amount,
        "potential_win": potential_win,
        "currency": company.get("currency", "HTG"),
        "plays": [{"numbers": p.numbers, "bet_type": p.bet_type, "amount": p.amount} for p in sell_data.plays],
        "created_at": now
    }


# ============================================================================
# SEARCH TICKETS - Advanced search
# ============================================================================

@vendeur_router.get("/search")
async def search_tickets(
    current_vendeur: dict = Depends(get_current_vendeur),
    ticket_code: Optional[str] = None,
    number_played: Optional[str] = None,
    lottery_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 50
):
    """
    Advanced ticket search with multiple criteria
    """
    vendeur_id = current_vendeur.get("user_id")
    
    query = {"agent_id": vendeur_id}
    
    if ticket_code:
        query["$or"] = [
            {"ticket_code": {"$regex": ticket_code, "$options": "i"}},
            {"ticket_id": {"$regex": ticket_code, "$options": "i"}}
        ]
    
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    if status:
        if status == "WINNER":
            query["status"] = {"$in": ["WINNER", "WON"]}
        else:
            query["status"] = status
    
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to + "T23:59:59"
        query["created_at"] = date_query
    
    tickets = await db.lottery_transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # If searching by number played, filter in Python
    if number_played:
        tickets = [
            t for t in tickets 
            if any(number_played in (p.get("numbers", "") or "") for p in t.get("plays", []))
        ]
    
    return tickets


# ============================================================================
# STATS & REPORTS - Sales analytics
# ============================================================================

@vendeur_router.get("/stats")
async def get_vendeur_stats(
    current_vendeur: dict = Depends(get_current_vendeur),
    period: str = "today"
):
    """
    Get detailed sales statistics for the vendeur
    """
    vendeur_id = current_vendeur.get("user_id")
    
    now = datetime.now(timezone.utc)
    
    # Define date range based on period
    if period == "today":
        start_date = now.strftime("%Y-%m-%d")
        end_date = start_date
    elif period == "week":
        start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        end_date = now.strftime("%Y-%m-%d")
    elif period == "month":
        start_date = now.strftime("%Y-%m-01")
        end_date = now.strftime("%Y-%m-%d")
    else:
        start_date = "2000-01-01"
        end_date = "2099-12-31"
    
    # Aggregate stats
    pipeline = [
        {"$match": {
            "agent_id": vendeur_id,
            "created_at": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
        }},
        {"$group": {
            "_id": None,
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"},
            "winners_count": {"$sum": {"$cond": [{"$in": ["$status", ["WINNER", "WON"]]}, 1, 0]}},
            "losers_count": {"$sum": {"$cond": [{"$eq": ["$status", "LOST"]}, 1, 0]}},
            "pending_count": {"$sum": {"$cond": [{"$in": ["$status", ["PENDING", None]]}, 1, 0]}},
            "total_wins": {"$sum": {"$cond": [{"$in": ["$status", ["WINNER", "WON"]]}, "$win_amount", 0]}}
        }}
    ]
    result = await db.lottery_transactions.aggregate(pipeline).to_list(1)
    stats = result[0] if result else {}
    
    # Sales by lottery
    lottery_pipeline = [
        {"$match": {
            "agent_id": vendeur_id,
            "created_at": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
        }},
        {"$group": {
            "_id": {"lottery_id": "$lottery_id", "lottery_name": "$lottery_name"},
            "total_sales": {"$sum": "$total_amount"},
            "ticket_count": {"$sum": 1}
        }},
        {"$sort": {"total_sales": -1}},
        {"$limit": 20}
    ]
    by_lottery = await db.lottery_transactions.aggregate(lottery_pipeline).to_list(20)
    
    # Daily sales for chart
    daily_pipeline = [
        {"$match": {
            "agent_id": vendeur_id,
            "created_at": {"$gte": (now - timedelta(days=7)).strftime("%Y-%m-%d")}
        }},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "total_sales": {"$sum": "$total_amount"},
            "ticket_count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_sales = await db.lottery_transactions.aggregate(daily_pipeline).to_list(30)
    
    # Get commission rate
    agent_policy = await db.agent_policies.find_one({"agent_id": vendeur_id}, {"_id": 0})
    commission_rate = agent_policy.get("commission_percent", 10) if agent_policy else 10
    
    return {
        "period": period,
        "stats": {
            "total_tickets": stats.get("total_tickets", 0),
            "total_sales": stats.get("total_sales", 0),
            "average_ticket": stats.get("total_sales", 0) / max(stats.get("total_tickets", 1), 1),
            "winners_count": stats.get("winners_count", 0),
            "losers_count": stats.get("losers_count", 0),
            "pending_count": stats.get("pending_count", 0),
            "total_wins": stats.get("total_wins", 0),
            "commission": stats.get("total_sales", 0) * (commission_rate / 100),
            "commission_rate": commission_rate
        },
        "by_lottery": [
            {
                "lottery_id": item["_id"]["lottery_id"],
                "lottery_name": item["_id"]["lottery_name"] or item["_id"]["lottery_id"],
                "total_sales": item["total_sales"],
                "ticket_count": item["ticket_count"]
            } for item in by_lottery
        ],
        "daily_sales": [
            {"date": item["_id"], "amount": item["total_sales"], "count": item["ticket_count"]}
            for item in daily_sales
        ]
    }


# ============================================================================
# RESULTS - Get lottery results
# ============================================================================

@vendeur_router.get("/results")
async def get_results(
    current_vendeur: dict = Depends(get_current_vendeur),
    limit: int = 50,
    lottery_id: Optional[str] = None,
    date: Optional[str] = None
):
    """
    Get lottery results for the vendeur's enabled lotteries
    """
    company_id = current_vendeur.get("company_id")
    
    # Get enabled lottery IDs
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "$or": [{"is_enabled": True}, {"enabled": True}]},
        {"lottery_id": 1}
    ).to_list(300)
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    if not lottery_ids:
        return []
    
    query = {"lottery_id": {"$in": lottery_ids}}
    
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    if date:
        query["draw_date"] = date
    
    results = await db.global_results.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Format winning numbers to avoid React rendering error
    for result in results:
        wn = result.get("winning_numbers")
        if isinstance(wn, dict):
            nums = []
            if wn.get("first"): nums.append(str(wn["first"]))
            if wn.get("second"): nums.append(str(wn["second"]))
            if wn.get("third"): nums.append(str(wn["third"]))
            result["winning_numbers_display"] = " - ".join(nums)
            # Also keep as array for frontend
            result["winning_numbers"] = nums
        elif isinstance(wn, str):
            result["winning_numbers_display"] = wn
        else:
            result["winning_numbers_display"] = "-"
    
    return results


# ============================================================================
# PROFILE - Vendeur profile management
# ============================================================================

@vendeur_router.get("/profile")
async def get_profile(current_vendeur: dict = Depends(get_current_vendeur)):
    """
    Get vendeur profile information
    """
    vendeur_id = current_vendeur.get("user_id")
    company_id = current_vendeur.get("company_id")
    succursale_id = current_vendeur.get("succursale_id")
    
    # Get company info
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0, "name": 1})
    
    # Get succursale info - check multiple field names
    succursale = None
    succursale_name = None
    if succursale_id:
        succursale = await db.succursales.find_one(
            {"succursale_id": succursale_id}, 
            {"_id": 0, "name": 1, "nom_succursale": 1, "nom_bank": 1}
        )
        if succursale:
            succursale_name = succursale.get("nom_succursale") or succursale.get("name") or succursale.get("nom_bank")
    
    return {
        "user_id": vendeur_id,
        "name": current_vendeur.get("name") or current_vendeur.get("full_name"),
        "email": current_vendeur.get("email"),
        "telephone": current_vendeur.get("telephone"),
        "status": current_vendeur.get("status"),
        "role": current_vendeur.get("role"),
        "company_id": company_id,
        "company_name": company.get("name") if company else None,
        "succursale_id": succursale_id,
        "succursale_name": succursale_name,
        "created_at": current_vendeur.get("created_at")
    }


@vendeur_router.put("/profile/password")
async def change_password(
    current_vendeur: dict = Depends(get_current_vendeur),
    current_password: str = None,
    new_password: str = None
):
    """
    Change vendeur password
    """
    from auth import verify_password, get_password_hash
    
    vendeur_id = current_vendeur.get("user_id")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Mot de passe actuel et nouveau requis")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit avoir au moins 6 caractères")
    
    # Get current password hash
    user = await db.users.find_one({"user_id": vendeur_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Verify current password
    if not verify_password(current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    
    # Update password
    new_hash = get_password_hash(new_password)
    await db.users.update_one(
        {"user_id": vendeur_id},
        {"$set": {"password_hash": new_hash, "updated_at": get_current_timestamp()}}
    )
    
    return {"message": "Mot de passe modifié avec succès"}
