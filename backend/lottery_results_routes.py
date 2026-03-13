"""
LOTTERY RESULTS MANAGEMENT
- Super Admin: Enter and publish lottery results
- Automatic calculation of winning tickets
- Winner payment system for vendors
"""

from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import logging

from models import UserRole
from auth import decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

logger = logging.getLogger(__name__)

results_router = APIRouter(prefix="/api", tags=["Lottery Results"])
security = HTTPBearer()

db = None

def set_results_db(database):
    global db
    db = database


# ============ MODELS ============

class ResultCreate(BaseModel):
    lottery_id: str
    lottery_name: str
    draw_date: str  # YYYY-MM-DD
    draw_time: str  # Matin, Midi, Soir, Nuit
    winning_numbers: str  # "12-34-56" or "1234"
    winning_numbers_second: Optional[str] = None  # For games with 2nd prize
    winning_numbers_third: Optional[str] = None  # For games with 3rd prize


class PayWinnerRequest(BaseModel):
    ticket_id: str


# ============ AUTH HELPERS ============

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return user


def require_super_admin(user: dict):
    if user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès réservé au Super Admin")
    return user


def require_company_admin(user: dict):
    if user.get("role") not in [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return user


# ============ BET TYPE MULTIPLIERS ============
# Haitian lottery payout multipliers - Updated to client specifications

BET_MULTIPLIERS = {
    # Borlette (3 chiffres) - Principal bet type
    "borlette": 60,      # 1st position: 60x payout
    "borlette_1": 60,    # 1st position: 60x
    "borlette_2": 20,    # 2nd position: 20x
    "borlette_3": 10,    # 3rd position: 10x
    
    # Loto 3 (3 chiffres exact)
    "loto3": 500,        # 1:500 payout
    "loto_3": 500,
    
    # Loto 4 (4 chiffres)  
    "loto4": 5000,       # 1:5000 payout
    "loto_4": 5000,
    "loto4_1": 5000,
    "loto4_2": 2000,
    "loto4_3": 1000,
    
    # Loto 5 (5 chiffres)
    "loto5": 50000,
    "loto_5": 50000,
    
    # Marriage (2 numéros)
    "marriage": 100,     # 1:100 payout
    "mariage": 100,
    "maryaj": 100,
    
    # Default - uses 1st position multiplier
    "default": 60
}


# ============ WINNING CALCULATION FUNCTIONS ============

def normalize_numbers(numbers_str: str) -> str:
    """Normalize number string for comparison"""
    if not numbers_str:
        return ""
    # Remove spaces, dashes, and convert to lowercase
    return "".join(numbers_str.replace("-", "").replace(" ", "").lower())


def check_borlette_win(played: str, winning: str) -> tuple:
    """
    Check if borlette numbers win.
    Borlette wins if the 3 digits match (exact or in winning positions)
    Returns: (is_winner, position) - position 1, 2, 3 or 0 if no win
    """
    played_norm = normalize_numbers(played)
    winning_norm = normalize_numbers(winning)
    
    if len(played_norm) < 2:
        return False, 0
    
    # Exact match (1st position) - highest payout
    if played_norm == winning_norm[:len(played_norm)]:
        return True, 1
    
    # Check if numbers appear in winning (2nd, 3rd positions)
    if len(winning_norm) >= 6:
        # 2nd position (digits 3-5 in some formats)
        if played_norm == winning_norm[3:6] if len(winning_norm) >= 6 else "":
            return True, 2
    
    return False, 0


def check_loto3_win(played: str, winning: str) -> bool:
    """Check if loto3 numbers match exactly"""
    played_norm = normalize_numbers(played)
    winning_norm = normalize_numbers(winning)
    return played_norm == winning_norm[:len(played_norm)] if winning_norm else False


def check_loto4_win(played: str, winning: str) -> tuple:
    """Check loto4 win - returns (is_winner, position)"""
    played_norm = normalize_numbers(played)
    winning_norm = normalize_numbers(winning)
    
    if len(played_norm) != 4:
        return False, 0
    
    # Exact 1st position match
    if played_norm == winning_norm[:4]:
        return True, 1
    
    return False, 0


def check_marriage_win(played: str, winning: str) -> bool:
    """
    Check marriage win - 2 numbers must both appear in winning
    """
    played_norm = normalize_numbers(played)
    winning_norm = normalize_numbers(winning)
    
    # Parse the two numbers from played (format: "12-34" or "1234")
    if len(played_norm) == 4:
        num1 = played_norm[:2]
        num2 = played_norm[2:4]
    elif "-" in played:
        parts = played.split("-")
        if len(parts) == 2:
            num1 = parts[0].strip()
            num2 = parts[1].strip()
        else:
            return False
    else:
        return False
    
    # Both numbers must appear in the winning numbers
    return num1 in winning_norm and num2 in winning_norm


def calculate_winnings(play: dict, winning_numbers: str) -> tuple:
    """
    Calculate winnings for a single play.
    Returns: (is_winner, winnings_amount, win_position)
    """
    bet_type = play.get("bet_type", "borlette").lower()
    numbers = play.get("numbers", "")
    amount = play.get("amount", 0)
    
    is_winner = False
    win_position = 0
    multiplier = BET_MULTIPLIERS.get(bet_type, BET_MULTIPLIERS["default"])
    
    # Check based on bet type
    if "loto4" in bet_type or "loto_4" in bet_type:
        is_winner, win_position = check_loto4_win(numbers, winning_numbers)
        if win_position == 2:
            multiplier = BET_MULTIPLIERS.get("loto4_2", 2000)
        elif win_position == 3:
            multiplier = BET_MULTIPLIERS.get("loto4_3", 1000)
    
    elif "loto3" in bet_type or "loto_3" in bet_type:
        is_winner = check_loto3_win(numbers, winning_numbers)
        win_position = 1 if is_winner else 0
    
    elif "marriage" in bet_type or "mariage" in bet_type or "maryaj" in bet_type:
        is_winner = check_marriage_win(numbers, winning_numbers)
        win_position = 1 if is_winner else 0
    
    else:
        # Default to borlette
        is_winner, win_position = check_borlette_win(numbers, winning_numbers)
        if win_position == 2:
            multiplier = BET_MULTIPLIERS.get("borlette_2", 20)
        elif win_position == 3:
            multiplier = BET_MULTIPLIERS.get("borlette_3", 10)
    
    winnings = amount * multiplier if is_winner else 0
    
    return is_winner, winnings, win_position


async def process_winning_tickets(result_id: str, lottery_id: str, draw_date: str, draw_time: str, winning_numbers: str):
    """
    Background task to process all tickets for a lottery draw and calculate winners.
    """
    logger.info(f"[RESULTS] Processing winning tickets for lottery {lottery_id}, draw {draw_date} {draw_time}")
    
    try:
        # Find all tickets for this lottery and draw that haven't been processed
        query = {
            "lottery_id": lottery_id,
            "status": {"$in": ["PENDING", "ACTIVE", "PENDING_RESULT", "VALIDATED"]},
        }
        
        # Also match by draw time if available
        if draw_time:
            draw_time_lower = draw_time.lower()
            query["$or"] = [
                {"draw_time": {"$regex": draw_time, "$options": "i"}},
                {"draw_name": {"$regex": draw_time, "$options": "i"}},
                {"draw_period": {"$regex": draw_time, "$options": "i"}}
            ]
        
        tickets = await db.lottery_transactions.find(query, {"_id": 0}).to_list(None)
        
        logger.info(f"[RESULTS] Found {len(tickets)} tickets to process")
        
        winners_count = 0
        losers_count = 0
        total_winnings = 0
        now = get_current_timestamp()
        
        for ticket in tickets:
            ticket_id = ticket.get("ticket_id")
            plays = ticket.get("plays", [])
            
            ticket_is_winner = False
            ticket_total_winnings = 0
            winning_plays = []
            
            # Check each play in the ticket
            for i, play in enumerate(plays):
                is_winner, winnings, position = calculate_winnings(play, winning_numbers)
                
                if is_winner:
                    ticket_is_winner = True
                    ticket_total_winnings += winnings
                    winning_plays.append({
                        "play_index": i,
                        "numbers": play.get("numbers"),
                        "bet_type": play.get("bet_type"),
                        "amount": play.get("amount"),
                        "winnings": winnings,
                        "position": position
                    })
            
            # Update ticket status
            if ticket_is_winner:
                await db.lottery_transactions.update_one(
                    {"ticket_id": ticket_id},
                    {
                        "$set": {
                            "status": "WINNER",
                            "is_winner": True,
                            "winnings": ticket_total_winnings,
                            "winning_plays": winning_plays,
                            "result_id": result_id,
                            "winning_numbers": winning_numbers,
                            "result_processed_at": now,
                            "payment_status": "UNPAID",
                            "updated_at": now
                        }
                    }
                )
                winners_count += 1
                total_winnings += ticket_total_winnings
                logger.info(f"[RESULTS] WINNER: Ticket {ticket_id} wins {ticket_total_winnings}")
            else:
                await db.lottery_transactions.update_one(
                    {"ticket_id": ticket_id},
                    {
                        "$set": {
                            "status": "LOSER",
                            "is_winner": False,
                            "winnings": 0,
                            "result_id": result_id,
                            "winning_numbers": winning_numbers,
                            "result_processed_at": now,
                            "updated_at": now
                        }
                    }
                )
                losers_count += 1
        
        # Update result with processing stats
        await db.global_results.update_one(
            {"result_id": result_id},
            {
                "$set": {
                    "tickets_processed": len(tickets),
                    "winners_count": winners_count,
                    "losers_count": losers_count,
                    "total_winnings": total_winnings,
                    "processed_at": now
                }
            }
        )
        
        logger.info(f"[RESULTS] Processing complete: {winners_count} winners, {losers_count} losers, {total_winnings} total winnings")
        
    except Exception as e:
        logger.error(f"[RESULTS] Error processing winning tickets: {str(e)}")
        raise


# ============ SUPER ADMIN - PUBLISH RESULTS ============

@results_router.post("/super-admin/results")
async def publish_lottery_result(
    result_data: ResultCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Super Admin publishes lottery results.
    This triggers automatic calculation of winning tickets.
    """
    require_super_admin(current_user)
    
    now = get_current_timestamp()
    result_id = generate_id("result_")
    
    # Verify lottery exists
    lottery = await db.master_lotteries.find_one(
        {"lottery_id": result_data.lottery_id},
        {"_id": 0}
    )
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    # Check for duplicate result
    existing = await db.global_results.find_one({
        "lottery_id": result_data.lottery_id,
        "draw_date": result_data.draw_date,
        "draw_time": result_data.draw_time
    })
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Un résultat existe déjà pour {result_data.lottery_name} - {result_data.draw_date} {result_data.draw_time}"
        )
    
    # Create result record
    result_doc = {
        "result_id": result_id,
        "lottery_id": result_data.lottery_id,
        "lottery_name": result_data.lottery_name,
        "draw_date": result_data.draw_date,
        "draw_time": result_data.draw_time,
        "winning_numbers": result_data.winning_numbers,
        "winning_numbers_second": result_data.winning_numbers_second,
        "winning_numbers_third": result_data.winning_numbers_third,
        "status": "PUBLISHED",
        "published_by": current_user.get("user_id"),
        "published_by_name": current_user.get("name"),
        "tickets_processed": 0,
        "winners_count": 0,
        "losers_count": 0,
        "total_winnings": 0,
        "created_at": now,
        "updated_at": now
    }
    
    await db.global_results.insert_one(result_doc)
    
    # Log activity
    await log_activity(
        db=db,
        action_type="RESULT_PUBLISHED",
        entity_type="lottery_result",
        entity_id=result_id,
        performed_by=current_user.get("user_id"),
        company_id=None,
        metadata={
            "lottery_name": result_data.lottery_name,
            "draw_date": result_data.draw_date,
            "draw_time": result_data.draw_time,
            "winning_numbers": result_data.winning_numbers
        },
        ip_address=request.client.host if request.client else None
    )
    
    # Process winning tickets in background
    background_tasks.add_task(
        process_winning_tickets,
        result_id,
        result_data.lottery_id,
        result_data.draw_date,
        result_data.draw_time,
        result_data.winning_numbers
    )
    
    logger.info(f"[RESULTS] Result published: {result_data.lottery_name} - {result_data.winning_numbers}")
    
    return {
        "message": "Résultat publié avec succès. Calcul des gagnants en cours...",
        "result_id": result_id,
        "lottery_name": result_data.lottery_name,
        "winning_numbers": result_data.winning_numbers
    }


@results_router.get("/super-admin/results")
async def get_all_results(
    current_user: dict = Depends(get_current_user),
    lottery_id: Optional[str] = None,
    draw_date: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get all published results (Super Admin)"""
    require_super_admin(current_user)
    
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    if draw_date:
        query["draw_date"] = draw_date
    
    results = await db.global_results.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.global_results.count_documents(query)
    
    return {
        "results": results,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@results_router.delete("/super-admin/results/{result_id}")
async def delete_result(
    result_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Delete a result and reset affected tickets (Super Admin only)"""
    require_super_admin(current_user)
    
    result = await db.global_results.find_one({"result_id": result_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Résultat non trouvé")
    
    now = get_current_timestamp()
    
    # Reset tickets that were processed with this result
    await db.lottery_transactions.update_many(
        {"result_id": result_id},
        {
            "$set": {
                "status": "PENDING_RESULT",
                "is_winner": None,
                "winnings": 0,
                "winning_plays": [],
                "result_id": None,
                "winning_numbers": None,
                "result_processed_at": None,
                "payment_status": None,
                "updated_at": now
            }
        }
    )
    
    # Delete the result
    await db.global_results.delete_one({"result_id": result_id})
    
    await log_activity(
        db=db,
        action_type="RESULT_DELETED",
        entity_type="lottery_result",
        entity_id=result_id,
        performed_by=current_user.get("user_id"),
        company_id=None,
        metadata={"lottery_name": result.get("lottery_name")},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Résultat supprimé et tickets réinitialisés"}


# ============ COMPANY ADMIN - VIEW RESULTS ============

@results_router.get("/company-admin/results")
async def get_company_results(
    current_user: dict = Depends(get_current_user),
    lottery_id: Optional[str] = None,
    draw_date: Optional[str] = None,
    limit: int = 50
):
    """Get results visible to company admin"""
    require_company_admin(current_user)
    
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    if draw_date:
        query["draw_date"] = draw_date
    
    results = await db.global_results.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"results": results}


# ============ SUPERVISOR - VIEW RESULTS ============

@results_router.get("/supervisor/results")
async def get_supervisor_results(
    current_user: dict = Depends(get_current_user),
    lottery_id: Optional[str] = None,
    limit: int = 50
):
    """Get results visible to supervisor"""
    if current_user.get("role") not in [UserRole.SUPERVISOR, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    results = await db.global_results.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"results": results}


# ============ VENDEUR - VIEW RESULTS ============

@results_router.get("/vendeur/results")
async def get_vendeur_results(
    current_user: dict = Depends(get_current_user),
    limit: int = 30
):
    """Get recent results for vendeur"""
    results = await db.global_results.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"results": results}


# ============ WINNER PAYMENT SYSTEM ============

@results_router.get("/vendeur/tickets-to-pay")
async def get_tickets_to_pay(
    current_user: dict = Depends(get_current_user)
):
    """Get winning tickets that need to be paid by this vendor"""
    if current_user.get("role") != UserRole.AGENT_POS:
        raise HTTPException(status_code=403, detail="Réservé aux vendeurs")
    
    vendeur_id = current_user.get("user_id")
    
    tickets = await db.lottery_transactions.find(
        {
            "agent_id": vendeur_id,
            "status": "WINNER",
            "payment_status": {"$in": ["UNPAID", None]}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_to_pay = sum(t.get("winnings", 0) for t in tickets)
    
    return {
        "tickets": tickets,
        "count": len(tickets),
        "total_to_pay": total_to_pay
    }


@results_router.post("/vendeur/pay-winner")
async def pay_winner(
    payment_data: PayWinnerRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Mark a winning ticket as paid"""
    if current_user.get("role") != UserRole.AGENT_POS:
        raise HTTPException(status_code=403, detail="Réservé aux vendeurs")
    
    vendeur_id = current_user.get("user_id")
    company_id = current_user.get("company_id")
    ticket_id = payment_data.ticket_id
    
    # Find the ticket
    ticket = await db.lottery_transactions.find_one(
        {
            "ticket_id": ticket_id,
            "agent_id": vendeur_id,
            "status": "WINNER"
        },
        {"_id": 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket gagnant non trouvé")
    
    if ticket.get("payment_status") == "PAID":
        raise HTTPException(status_code=400, detail="Ce ticket a déjà été payé")
    
    winnings = ticket.get("winnings", 0)
    now = get_current_timestamp()
    
    # Mark ticket as paid
    await db.lottery_transactions.update_one(
        {"ticket_id": ticket_id},
        {
            "$set": {
                "payment_status": "PAID",
                "paid_at": now,
                "paid_by": vendeur_id,
                "paid_by_name": current_user.get("name"),
                "updated_at": now
            }
        }
    )
    
    # Update agent payout stats
    await db.agent_balances.update_one(
        {"agent_id": vendeur_id},
        {
            "$inc": {
                "total_payouts": winnings
            },
            "$set": {"updated_at": now}
        },
        upsert=True
    )
    
    # Log activity
    await log_activity(
        db=db,
        action_type="WINNER_PAID",
        entity_type="ticket",
        entity_id=ticket_id,
        performed_by=vendeur_id,
        company_id=company_id,
        metadata={
            "ticket_code": ticket.get("ticket_code"),
            "winnings": winnings,
            "lottery_name": ticket.get("lottery_name")
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": "Ticket payé avec succès",
        "ticket_id": ticket_id,
        "winnings_paid": winnings
    }


# ============ SUPERVISOR - VIEW WINNING TICKETS ============

@results_router.get("/supervisor/tickets-to-pay")
async def supervisor_get_tickets_to_pay(
    current_user: dict = Depends(get_current_user)
):
    """Supervisor views all unpaid winning tickets from their agents"""
    if current_user.get("role") not in [UserRole.SUPERVISOR, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    # Get agents under this supervisor
    agent_query = {
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "status": {"$ne": "DELETED"}
    }
    if succursale_id:
        agent_query["succursale_id"] = succursale_id
    
    agents = await db.users.find(agent_query, {"user_id": 1}).to_list(None)
    agent_ids = [a["user_id"] for a in agents]
    
    tickets = await db.lottery_transactions.find(
        {
            "agent_id": {"$in": agent_ids},
            "status": "WINNER",
            "payment_status": {"$in": ["UNPAID", None]}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    total_to_pay = sum(t.get("winnings", 0) for t in tickets)
    
    return {
        "tickets": tickets,
        "count": len(tickets),
        "total_to_pay": total_to_pay
    }


# ============ COMPANY ADMIN - VIEW ALL WINNING TICKETS ============

@results_router.get("/company-admin/tickets-to-pay")
async def company_admin_get_tickets_to_pay(
    current_user: dict = Depends(get_current_user)
):
    """Company Admin views all unpaid winning tickets"""
    require_company_admin(current_user)
    
    company_id = current_user.get("company_id")
    
    tickets = await db.lottery_transactions.find(
        {
            "company_id": company_id,
            "status": "WINNER",
            "payment_status": {"$in": ["UNPAID", None]}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    total_to_pay = sum(t.get("winnings", 0) for t in tickets)
    
    return {
        "tickets": tickets,
        "count": len(tickets),
        "total_to_pay": total_to_pay
    }


# ============ PAID TICKETS (FICHE GAGNANT) ============

@results_router.get("/vendeur/paid-tickets")
async def get_vendeur_paid_tickets(
    current_user: dict = Depends(get_current_user),
    limit: int = 50
):
    """Get tickets that were paid by this vendor"""
    if current_user.get("role") != UserRole.AGENT_POS:
        raise HTTPException(status_code=403, detail="Réservé aux vendeurs")
    
    vendeur_id = current_user.get("user_id")
    
    tickets = await db.lottery_transactions.find(
        {
            "agent_id": vendeur_id,
            "status": "WINNER",
            "payment_status": "PAID"
        },
        {"_id": 0}
    ).sort("paid_at", -1).limit(limit).to_list(limit)
    
    total_paid = sum(t.get("winnings", 0) for t in tickets)
    
    return {
        "tickets": tickets,
        "count": len(tickets),
        "total_paid": total_paid
    }


@results_router.get("/supervisor/paid-tickets")
async def get_supervisor_paid_tickets(
    current_user: dict = Depends(get_current_user),
    limit: int = 100
):
    """Supervisor views paid tickets from their agents"""
    if current_user.get("role") not in [UserRole.SUPERVISOR, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    agent_query = {
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "status": {"$ne": "DELETED"}
    }
    if succursale_id:
        agent_query["succursale_id"] = succursale_id
    
    agents = await db.users.find(agent_query, {"user_id": 1}).to_list(None)
    agent_ids = [a["user_id"] for a in agents]
    
    tickets = await db.lottery_transactions.find(
        {
            "agent_id": {"$in": agent_ids},
            "status": "WINNER",
            "payment_status": "PAID"
        },
        {"_id": 0}
    ).sort("paid_at", -1).limit(limit).to_list(limit)
    
    total_paid = sum(t.get("winnings", 0) for t in tickets)
    
    return {
        "tickets": tickets,
        "count": len(tickets),
        "total_paid": total_paid
    }


@results_router.get("/company-admin/paid-tickets")
async def get_company_paid_tickets(
    current_user: dict = Depends(get_current_user),
    limit: int = 200
):
    """Company Admin views all paid tickets"""
    require_company_admin(current_user)
    
    company_id = current_user.get("company_id")
    
    tickets = await db.lottery_transactions.find(
        {
            "company_id": company_id,
            "status": "WINNER",
            "payment_status": "PAID"
        },
        {"_id": 0}
    ).sort("paid_at", -1).limit(limit).to_list(limit)
    
    total_paid = sum(t.get("winnings", 0) for t in tickets)
    
    return {
        "tickets": tickets,
        "count": len(tickets),
        "total_paid": total_paid
    }
