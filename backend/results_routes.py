"""
LOTTOLAB - Lottery Results & Automatic Winner Detection System
Handles: Result publishing, Winner detection, Payout calculation

UPDATED: Now uses PayoutEngine for proper prize calculations based on company configs.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import asyncio

from models import UserRole, TicketStatus
from auth import decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity
from payout_engine import process_result_for_all_tickets, get_company_primes, calculate_play_win

results_router = APIRouter(prefix="/api", tags=["Results & Winners"])
security = HTTPBearer()

db = None

def set_results_db(database):
    global db
    db = database


# ============================================================================
# AUTH DEPENDENCY
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


async def require_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require SUPER_ADMIN role"""
    user = await get_current_user(credentials)
    if user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès Super Admin requis")
    return user


# ============================================================================
# REQUEST MODELS
# ============================================================================

class PublishResultRequest(BaseModel):
    lottery_id: str
    draw_date: str  # YYYY-MM-DD
    draw_name: str  # "Midday", "Evening", "Soir"
    winning_numbers: dict  # {"first": "12", "second": "34", "third": "56", "borlette": "12"}
    official_source: Optional[str] = None
    notes: Optional[str] = None


class BulkPublishResultRequest(BaseModel):
    results: List[PublishResultRequest]


# ============================================================================
# PAYOUT CALCULATION
# ============================================================================

DEFAULT_PAYOUTS = {
    "BORLETTE": {"first": 50, "second": 20, "third": 10},
    "LOTO3": {"exact": 500, "any_order": 80},
    "LOTO4": {"exact": 5000, "any_order": 200},
    "LOTO5": {"exact": 50000, "any_order": 1000},
    "MARIAGE": {"exact": 1000},
    "STRAIGHT": {"exact": 500},
    "BOX": {"any_order": 80},
    "COMBO": {"exact": 500}
}


def check_winning(play_numbers: str, bet_type: str, winning_numbers: dict) -> dict:
    """
    Check if a play is a winner and calculate payout multiplier.
    Returns: {"is_winner": bool, "match_type": str, "multiplier": float}
    """
    play_nums = play_numbers.strip()
    
    # Get winning numbers based on bet type
    first = winning_numbers.get("first", "")
    second = winning_numbers.get("second", "")
    third = winning_numbers.get("third", "")
    borlette = winning_numbers.get("borlette", first)  # Default to first if not specified
    
    result = {"is_winner": False, "match_type": None, "multiplier": 0}
    
    if bet_type == "BORLETTE":
        # BORLETTE can be played with 2 or 3 digits
        # For 2-digit plays: check against last 2 digits of results
        # For 3-digit plays: exact match with first, second, or third
        if len(play_nums) == 2:
            first_2 = first[-2:] if len(first) >= 2 else first
            second_2 = second[-2:] if len(second) >= 2 else second
            third_2 = third[-2:] if len(third) >= 2 else third
            borlette_2 = borlette[-2:] if len(borlette) >= 2 else borlette
            
            if play_nums == first_2:
                result = {"is_winner": True, "match_type": "first", "multiplier": 50}
            elif play_nums == second_2:
                result = {"is_winner": True, "match_type": "second", "multiplier": 20}
            elif play_nums == third_2:
                result = {"is_winner": True, "match_type": "third", "multiplier": 10}
            elif play_nums == borlette_2:
                result = {"is_winner": True, "match_type": "borlette", "multiplier": 50}
        elif len(play_nums) == 3:
            # 3-digit BORLETTE - exact match
            if play_nums == first:
                result = {"is_winner": True, "match_type": "first", "multiplier": 50}
            elif play_nums == second:
                result = {"is_winner": True, "match_type": "second", "multiplier": 20}
            elif play_nums == third:
                result = {"is_winner": True, "match_type": "third", "multiplier": 10}
    
    elif bet_type in ["LOTO3", "STRAIGHT"]:
        # 3-digit exact match
        if len(play_nums) == 3:
            if play_nums == first:
                result = {"is_winner": True, "match_type": "exact", "multiplier": 500}
    
    elif bet_type == "LOTO4":
        # 4-digit exact match
        if len(play_nums) == 4:
            if play_nums == first:
                result = {"is_winner": True, "match_type": "exact", "multiplier": 5000}
    
    elif bet_type == "LOTO5":
        # 5-digit exact match
        if len(play_nums) == 5:
            if play_nums == first:
                result = {"is_winner": True, "match_type": "exact", "multiplier": 50000}
    
    elif bet_type == "BOX":
        # Any order match for 3 digits
        if len(play_nums) == 3:
            sorted_play = sorted(play_nums)
            sorted_win = sorted(first) if len(first) == 3 else []
            if sorted_play == sorted_win:
                result = {"is_winner": True, "match_type": "any_order", "multiplier": 80}
    
    elif bet_type == "MARIAGE":
        # Marriage - 2 pairs of 2 digits
        if len(play_nums) == 4:
            pair1 = play_nums[:2]
            pair2 = play_nums[2:]
            win_pair1 = first[-2:] if len(first) >= 2 else ""
            win_pair2 = second[-2:] if len(second) >= 2 else ""
            if (pair1 == win_pair1 and pair2 == win_pair2) or (pair1 == win_pair2 and pair2 == win_pair1):
                result = {"is_winner": True, "match_type": "exact", "multiplier": 1000}
    
    return result



# ============================================================================
# GET LOTTERIES (for result management)
# ============================================================================

@results_router.get("/results/lotteries")
async def get_lotteries_for_results(
    current_user: dict = Depends(require_super_admin)
):
    """
    Get all master lotteries for result management.
    Returns lottery_id, lottery_name, state_code for dropdown selection.
    """
    try:
        lotteries = await db.master_lotteries.find(
            {},
            {"_id": 0, "lottery_id": 1, "lottery_name": 1, "state_code": 1}
        ).to_list(length=None)
        return lotteries
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ============================================================================
# PUBLISH RESULTS (Super Admin)
# ============================================================================

@results_router.post("/results/publish")
async def publish_result(
    data: PublishResultRequest,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """
    Publish official lottery result and automatically detect winners.
    
    Process:
    1. Store result in global_results collection
    2. Use PayoutEngine to process all pending tickets
    3. PayoutEngine uses company-specific prime configurations
    4. Update winning tickets status and calculate payouts
    5. Create payout records for winners
    """
    # Verify lottery exists
    lottery = await db.master_lotteries.find_one(
        {"lottery_id": data.lottery_id},
        {"_id": 0}
    )
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    now = get_current_timestamp()
    result_id = generate_id("res_")
    
    # 1. Store result
    result_doc = {
        "result_id": result_id,
        "lottery_id": data.lottery_id,
        "lottery_name": lottery.get("lottery_name"),
        "state_code": lottery.get("state_code"),
        "draw_date": data.draw_date,
        "draw_name": data.draw_name,
        "winning_numbers": data.winning_numbers,
        "official_source": data.official_source,
        "notes": data.notes,
        "published_by": current_user["user_id"],
        "published_at": now,
        "created_at": now,
        "winners_processed": False
    }
    
    await db.global_results.insert_one(result_doc)
    
    # 2. Use PayoutEngine to process all tickets
    # This centralized engine:
    # - Uses company-specific prime configurations (60|20|10, etc.)
    # - Properly extracts borlette from 1st prize (last 2 digits)
    # - Creates payout records
    # - Updates ticket statuses
    payout_result = await process_result_for_all_tickets({
        "result_id": result_id,
        "lottery_id": data.lottery_id,
        "draw_date": data.draw_date,
        "draw_name": data.draw_name,
        "winning_numbers": data.winning_numbers
    })
    
    # 3. Log activity
    await log_activity(
        db=db,
        action_type="RESULT_PUBLISHED",
        entity_type="result",
        entity_id=result_id,
        performed_by=current_user["user_id"],
        metadata={
            "lottery_name": lottery.get("lottery_name"),
            "draw_date": data.draw_date,
            "draw_name": data.draw_name,
            "winning_numbers": data.winning_numbers,
            "tickets_processed": payout_result.get("processed", 0),
            "winners": payout_result.get("winners", 0),
            "losers": payout_result.get("losers", 0),
            "total_payouts": payout_result.get("total_payout", 0)
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": "Résultats publiés et gagnants détectés",
        "result_id": result_id,
        "lottery_name": lottery.get("lottery_name"),
        "draw_date": data.draw_date,
        "draw_name": data.draw_name,
        "winning_numbers": data.winning_numbers,
        "tickets_processed": payout_result.get("processed", 0),
        "winners_count": payout_result.get("winners", 0),
        "losers_count": payout_result.get("losers", 0),
        "total_payouts": payout_result.get("total_payout", 0),
        "currency": "HTG",
        "winner_details": payout_result.get("winner_details", [])[:10]
    }


@results_router.post("/results/bulk-publish")
async def bulk_publish_results(
    data: BulkPublishResultRequest,
    request: Request,
    current_user: dict = Depends(require_super_admin)
):
    """Publish multiple results at once"""
    results = []
    
    for result_data in data.results:
        try:
            result = await publish_result(result_data, request, current_user)
            results.append({"success": True, **result})
        except Exception as e:
            results.append({
                "success": False,
                "lottery_id": result_data.lottery_id,
                "draw_date": result_data.draw_date,
                "error": str(e)
            })
    
    return {
        "message": f"Traitement de {len(data.results)} résultats",
        "results": results
    }


# ============================================================================
# GET RESULTS
# ============================================================================

@results_router.get("/results")
async def get_results(
    current_user: dict = Depends(get_current_user),
    lottery_id: Optional[str] = None,
    date: Optional[str] = None,
    limit: int = 50
):
    """Get published results"""
    query = {}
    
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    if date:
        query["draw_date"] = date
    else:
        # Default to last 7 days
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        query["draw_date"] = {"$gte": week_ago}
    
    results = await db.global_results.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return results


@results_router.get("/results/{result_id}")
async def get_result_detail(
    result_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single result with winner details"""
    result = await db.global_results.find_one(
        {"result_id": result_id},
        {"_id": 0}
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Résultat non trouvé")
    
    # Get winners for this result
    winners = await db.payouts.find(
        {"lottery_id": result["lottery_id"], "draw_date": result["draw_date"]},
        {"_id": 0}
    ).to_list(100)
    
    result["winners"] = winners
    
    return result


# ============================================================================
# PAYOUTS MANAGEMENT
# ============================================================================

@results_router.get("/payouts")
async def get_payouts(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    company_id: Optional[str] = None,
    date: Optional[str] = None,
    limit: int = 100
):
    """Get payouts - Super Admin sees all, others see own company"""
    query = {}
    
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        query["company_id"] = current_user.get("company_id")
    elif company_id:
        query["company_id"] = company_id
    
    if status:
        query["status"] = status
    
    if date:
        query["draw_date"] = date
    
    payouts = await db.payouts.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return payouts


@results_router.put("/payouts/{payout_id}/mark-paid")
async def mark_payout_paid(
    payout_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Mark a payout as paid"""
    payout = await db.payouts.find_one({"payout_id": payout_id}, {"_id": 0})
    
    if not payout:
        raise HTTPException(status_code=404, detail="Payout non trouvé")
    
    # Check permission
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        if payout.get("company_id") != current_user.get("company_id"):
            raise HTTPException(status_code=403, detail="Accès interdit")
    
    now = get_current_timestamp()
    
    await db.payouts.update_one(
        {"payout_id": payout_id},
        {"$set": {
            "status": "PAID",
            "paid_at": now,
            "paid_by": current_user["user_id"]
        }}
    )
    
    # Update ticket status
    await db.lottery_transactions.update_one(
        {"ticket_id": payout.get("ticket_id")},
        {"$set": {"status": "PAID", "paid_at": now}}
    )
    
    await db.tickets.update_one(
        {"ticket_id": payout.get("ticket_id")},
        {"$set": {"status": "PAID", "paid_at": now}}
    )
    
    # Update agent balance
    agent_id = payout.get("agent_id")
    payout_amount = payout.get("total_payout", 0)
    
    await db.agent_balances.update_one(
        {"agent_id": agent_id},
        {"$inc": {"total_payouts": payout_amount}}
    )
    
    await log_activity(
        db=db,
        action_type="PAYOUT_MARKED_PAID",
        entity_type="payout",
        entity_id=payout_id,
        performed_by=current_user["user_id"],
        company_id=payout.get("company_id"),
        metadata={
            "ticket_code": payout.get("ticket_code"),
            "amount": payout_amount
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Payout marqué comme payé", "payout_id": payout_id}


# ============================================================================
# WINNING TICKETS VIEW
# ============================================================================

@results_router.get("/winning-tickets")
async def get_winning_tickets(
    current_user: dict = Depends(get_current_user),
    company_id: Optional[str] = None,
    date: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100
):
    """Get winning tickets"""
    query = {"status": {"$in": [TicketStatus.WINNER.value, "WINNER", "PAID"]}}
    
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        query["company_id"] = current_user.get("company_id")
    elif company_id:
        query["company_id"] = company_id
    
    if date:
        query["draw_date"] = date
    
    if status:
        query["status"] = status
    
    tickets = await db.lottery_transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return tickets


# ============================================================================
# DASHBOARD STATS FOR SUPER ADMIN
# ============================================================================

@results_router.get("/dashboard-stats")
async def get_dashboard_stats(current_user: dict = Depends(require_super_admin)):
    """Get comprehensive dashboard stats for Super Admin"""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Companies stats
    total_companies = await db.companies.count_documents({"status": {"$ne": "DELETED"}})
    active_companies = await db.companies.count_documents({"status": "ACTIVE"})
    suspended_companies = await db.companies.count_documents({"status": "SUSPENDED"})
    
    # Agent stats
    total_agents = await db.users.count_documents({"role": UserRole.AGENT_POS, "status": {"$ne": "DELETED"}})
    active_agents = await db.users.count_documents({"role": UserRole.AGENT_POS, "status": "ACTIVE"})
    online_agents = await db.users.count_documents({"role": UserRole.AGENT_POS, "is_online": True})
    
    # Lottery stats
    total_lotteries = await db.master_lotteries.count_documents({})
    active_lotteries = await db.master_lotteries.count_documents({"is_active_global": True})
    
    # Today's sales
    sales_pipeline = [
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {
            "_id": None,
            "total_sales": {"$sum": "$total_amount"},
            "tickets_count": {"$sum": 1}
        }}
    ]
    sales_result = await db.lottery_transactions.aggregate(sales_pipeline).to_list(1)
    today_sales = sales_result[0] if sales_result else {"total_sales": 0, "tickets_count": 0}
    
    # Today's results
    today_results = await db.global_results.count_documents({"draw_date": today})
    
    # Today's winners
    today_winners = await db.lottery_transactions.count_documents({
        "status": {"$in": [TicketStatus.WINNER.value, "WINNER"]},
        "processed_at": {"$gte": today_start}
    })
    
    # Pending payouts
    pending_payouts_pipeline = [
        {"$match": {"status": "PENDING"}},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$total_payout"},
            "count": {"$sum": 1}
        }}
    ]
    pending_result = await db.payouts.aggregate(pending_payouts_pipeline).to_list(1)
    pending_payouts = pending_result[0] if pending_result else {"total": 0, "count": 0}
    
    # Recent activity
    recent_results = await db.global_results.find(
        {},
        {"_id": 0, "result_id": 1, "lottery_name": 1, "draw_date": 1, "draw_name": 1, 
         "winners_count": 1, "total_payouts": 1, "created_at": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "companies": {
            "total": total_companies,
            "active": active_companies,
            "suspended": suspended_companies
        },
        "agents": {
            "total": total_agents,
            "active": active_agents,
            "online": online_agents
        },
        "lotteries": {
            "total": total_lotteries,
            "active": active_lotteries
        },
        "today": {
            "sales": today_sales.get("total_sales", 0),
            "tickets": today_sales.get("tickets_count", 0),
            "results_published": today_results,
            "winners": today_winners
        },
        "payouts": {
            "pending_count": pending_payouts.get("count", 0),
            "pending_total": pending_payouts.get("total", 0)
        },
        "recent_results": recent_results
    }
