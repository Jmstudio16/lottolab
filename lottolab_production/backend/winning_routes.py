"""
CRITICAL PRODUCTION COMPONENTS
- Ticket Check/Verification System
- Ticket Payout System
- Agent Balance System
- Automatic Winning Detection
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel

from models import UserRole, TicketStatus
from auth import decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

winning_router = APIRouter(prefix="/api", tags=["Winning & Payout"])
security = HTTPBearer()

db = None

def set_winning_db(database):
    global db
    db = database


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class TicketCheckRequest(BaseModel):
    ticket_code: str


class TicketCheckResponse(BaseModel):
    found: bool
    ticket_id: Optional[str] = None
    ticket_code: Optional[str] = None
    status: str  # PENDING_RESULT, WINNER, LOSER, VOID, PAID
    is_winner: bool = False
    payout_amount: float = 0.0
    ticket_numbers: List[Dict[str, Any]] = []
    winning_numbers: Optional[str] = None
    winning_numbers_parsed: Dict[str, str] = {}
    lottery_name: Optional[str] = None
    draw_date: Optional[str] = None
    draw_name: Optional[str] = None
    agent_name: Optional[str] = None
    company_name: Optional[str] = None
    total_amount: float = 0.0
    message: str = ""


class TicketPayoutRequest(BaseModel):
    ticket_id: str


class TicketPayoutResponse(BaseModel):
    success: bool
    payout_id: Optional[str] = None
    ticket_id: str
    payout_amount: float = 0.0
    message: str = ""


class AgentBalanceResponse(BaseModel):
    agent_id: str
    company_id: str
    credit_limit: float = 50000.0
    current_balance: float = 0.0
    available_balance: float = 0.0
    total_sales: float = 0.0
    total_payouts: float = 0.0
    total_winnings: float = 0.0
    today_sales: float = 0.0
    today_payouts: float = 0.0


# ============================================================================
# AUTH HELPERS
# ============================================================================

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


async def get_agent_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get agent from token (agent or admin acting as)"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return user


# ============================================================================
# WINNING NUMBER COMPARISON LOGIC
# ============================================================================

def normalize_number(num: str) -> str:
    """Normalize number for comparison (remove leading zeros, spaces)"""
    return num.strip().lstrip('0') or '0'


def check_winning_play(play_numbers: str, winning_numbers: str, bet_type: str) -> Dict[str, Any]:
    """
    Check if a play is a winner
    Returns: {is_winner: bool, position: str, multiplier: float}
    """
    play_norm = normalize_number(play_numbers)
    
    # Parse winning numbers (format: "first-second-third" or just "123")
    if "-" in winning_numbers:
        parts = winning_numbers.split("-")
        first = normalize_number(parts[0]) if len(parts) > 0 else ""
        second = normalize_number(parts[1]) if len(parts) > 1 else ""
        third = normalize_number(parts[2]) if len(parts) > 2 else ""
    else:
        # Single number format
        first = normalize_number(winning_numbers)
        second = ""
        third = ""
    
    # Check positions
    result = {"is_winner": False, "position": None, "multiplier": 0.0}
    
    if bet_type in ["BORLETTE", "LOTO3", "PICK3"]:
        if play_norm == first:
            result = {"is_winner": True, "position": "first", "multiplier": 50.0}
        elif play_norm == second:
            result = {"is_winner": True, "position": "second", "multiplier": 20.0}
        elif play_norm == third:
            result = {"is_winner": True, "position": "third", "multiplier": 10.0}
    
    elif bet_type == "MARIAGE":
        # Marriage needs both numbers to match first two positions
        if "-" in play_numbers:
            p1, p2 = play_numbers.split("-")
            p1_norm = normalize_number(p1)
            p2_norm = normalize_number(p2)
            if (p1_norm == first and p2_norm == second) or (p1_norm == second and p2_norm == first):
                result = {"is_winner": True, "position": "mariage", "multiplier": 500.0}
    
    elif bet_type in ["LOTO4", "PICK4"]:
        if play_norm == first:
            result = {"is_winner": True, "position": "first", "multiplier": 500.0}
        elif play_norm == second:
            result = {"is_winner": True, "position": "second", "multiplier": 100.0}
    
    elif bet_type in ["LOTO5", "PICK5"]:
        if play_norm == first:
            result = {"is_winner": True, "position": "first", "multiplier": 5000.0}
    
    return result


async def calculate_payout(company_id: str, plays: List[Dict], winning_numbers: str) -> Dict[str, Any]:
    """
    Calculate total payout for a ticket
    Uses company's prime_configs if available, otherwise default multipliers
    """
    total_payout = 0.0
    winning_plays = []
    
    # Get company's payout configuration
    prime_configs = await db.prime_configs.find(
        {"company_id": company_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Build lookup map
    prime_map = {}
    for pc in prime_configs:
        key = f"{pc.get('bet_type', '')}_{pc.get('bet_code', '')}"
        prime_map[key] = pc
    
    for play in plays:
        numbers = play.get("numbers", "")
        bet_type = play.get("bet_type", "BORLETTE")
        amount = play.get("amount", 0.0)
        
        # Check if winning
        result = check_winning_play(numbers, winning_numbers, bet_type)
        
        if result["is_winner"]:
            # Get multiplier from prime_configs or use default
            multiplier = result["multiplier"]
            
            # Try to find company-specific payout
            bet_code = "20"  # Default borlette code
            if bet_type == "LOTO3":
                bet_code = "30"
            elif bet_type == "LOTO4":
                bet_code = "40"
            elif bet_type == "MARIAGE":
                bet_code = "M"
            
            prime_key = f"{bet_type}_{bet_code}"
            if prime_key in prime_map:
                prime = prime_map[prime_key]
                if result["position"] == "first":
                    multiplier = prime.get("payout_first", multiplier)
                elif result["position"] == "second":
                    multiplier = prime.get("payout_second", multiplier)
                elif result["position"] == "third":
                    multiplier = prime.get("payout_third", multiplier)
            
            win_amount = amount * multiplier
            total_payout += win_amount
            
            winning_plays.append({
                "numbers": numbers,
                "bet_type": bet_type,
                "amount": amount,
                "position": result["position"],
                "multiplier": multiplier,
                "win_amount": win_amount
            })
    
    return {
        "total_payout": total_payout,
        "winning_plays": winning_plays,
        "is_winner": len(winning_plays) > 0
    }


# ============================================================================
# ENDPOINT: CHECK TICKET
# ============================================================================

@winning_router.post("/tickets/check", response_model=TicketCheckResponse)
async def check_ticket(
    request_data: TicketCheckRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Check if a ticket is a winner
    Can be called by agents, admins, or for self-check kiosks
    """
    ticket_code = request_data.ticket_code.strip().upper()
    
    # Find ticket by code
    ticket = await db.lottery_transactions.find_one(
        {"ticket_code": ticket_code},
        {"_id": 0}
    )
    
    if not ticket:
        # Try verification code
        ticket = await db.lottery_transactions.find_one(
            {"verification_code": ticket_code},
            {"_id": 0}
        )
    
    if not ticket:
        return TicketCheckResponse(
            found=False,
            status="NOT_FOUND",
            message="Ticket non trouvé. Vérifiez le code."
        )
    
    # Security check - same company or super admin
    user_company = current_user.get("company_id")
    ticket_company = ticket.get("company_id")
    
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        if user_company != ticket_company:
            raise HTTPException(status_code=403, detail="Accès non autorisé à ce ticket")
    
    ticket_id = ticket.get("ticket_id")
    status = ticket.get("status", "PENDING_RESULT")
    lottery_id = ticket.get("lottery_id")
    draw_date = ticket.get("draw_date")
    draw_name = ticket.get("draw_name")
    plays = ticket.get("plays", [])
    
    # Get company name
    company = await db.companies.find_one({"company_id": ticket_company}, {"_id": 0, "name": 1})
    company_name = company.get("name") if company else None
    
    # If already processed
    if status in ["WINNER", "LOSER", "PAID", "VOID"]:
        return TicketCheckResponse(
            found=True,
            ticket_id=ticket_id,
            ticket_code=ticket.get("ticket_code"),
            status=status,
            is_winner=status in ["WINNER", "PAID"],
            payout_amount=ticket.get("actual_win", ticket.get("payout_amount", 0.0)),
            ticket_numbers=plays,
            winning_numbers=ticket.get("winning_numbers"),
            lottery_name=ticket.get("lottery_name"),
            draw_date=draw_date,
            draw_name=draw_name,
            agent_name=ticket.get("agent_name"),
            company_name=company_name,
            total_amount=ticket.get("total_amount", 0.0),
            message="Ce ticket a déjà été traité." if status == "PAID" else ""
        )
    
    # Find result for this lottery/draw
    result = await db.global_results.find_one({
        "lottery_id": lottery_id,
        "draw_date": draw_date,
        "draw_name": draw_name
    }, {"_id": 0})
    
    if not result:
        return TicketCheckResponse(
            found=True,
            ticket_id=ticket_id,
            ticket_code=ticket.get("ticket_code"),
            status="PENDING_RESULT",
            is_winner=False,
            payout_amount=0.0,
            ticket_numbers=plays,
            lottery_name=ticket.get("lottery_name"),
            draw_date=draw_date,
            draw_name=draw_name,
            agent_name=ticket.get("agent_name"),
            company_name=company_name,
            total_amount=ticket.get("total_amount", 0.0),
            message="Résultat pas encore disponible. Réessayez après le tirage."
        )
    
    winning_numbers = result.get("winning_numbers", "")
    winning_parsed = result.get("winning_numbers_parsed", {})
    
    # Calculate payout
    payout_result = await calculate_payout(ticket_company, plays, winning_numbers)
    
    is_winner = payout_result["is_winner"]
    payout_amount = payout_result["total_payout"]
    new_status = "WINNER" if is_winner else "LOSER"
    
    # Update ticket status
    now = get_current_timestamp()
    await db.lottery_transactions.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "status": new_status,
            "winning_numbers": winning_numbers,
            "actual_win": payout_amount,
            "payout_amount": payout_amount,
            "winning_plays": payout_result["winning_plays"],
            "checked_at": now,
            "checked_by": current_user["user_id"]
        }}
    )
    
    # Log activity
    await log_activity(
        db=db,
        action_type="TICKET_CHECKED",
        entity_type="ticket",
        entity_id=ticket_id,
        performed_by=current_user["user_id"],
        company_id=ticket_company,
        metadata={
            "ticket_code": ticket.get("ticket_code"),
            "is_winner": is_winner,
            "payout_amount": payout_amount
        },
        ip_address=request.client.host if request.client else None
    )
    
    return TicketCheckResponse(
        found=True,
        ticket_id=ticket_id,
        ticket_code=ticket.get("ticket_code"),
        status=new_status,
        is_winner=is_winner,
        payout_amount=payout_amount,
        ticket_numbers=plays,
        winning_numbers=winning_numbers,
        winning_numbers_parsed=winning_parsed,
        lottery_name=ticket.get("lottery_name"),
        draw_date=draw_date,
        draw_name=draw_name,
        agent_name=ticket.get("agent_name"),
        company_name=company_name,
        total_amount=ticket.get("total_amount", 0.0),
        message="FÉLICITATIONS! Ce ticket est gagnant!" if is_winner else "Ce ticket n'est pas gagnant."
    )


# ============================================================================
# ENDPOINT: PAYOUT TICKET
# ============================================================================

@winning_router.post("/tickets/payout", response_model=TicketPayoutResponse)
async def payout_ticket(
    request_data: TicketPayoutRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Pay out a winning ticket
    Can only be done by agents or admins in the same company
    """
    ticket_id = request_data.ticket_id
    
    # Find ticket
    ticket = await db.lottery_transactions.find_one(
        {"ticket_id": ticket_id},
        {"_id": 0}
    )
    
    if not ticket:
        return TicketPayoutResponse(
            success=False,
            ticket_id=ticket_id,
            message="Ticket non trouvé"
        )
    
    # Security check
    ticket_company = ticket.get("company_id")
    user_company = current_user.get("company_id")
    
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        if user_company != ticket_company:
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    # Check status
    status = ticket.get("status")
    
    if status == "PAID":
        return TicketPayoutResponse(
            success=False,
            ticket_id=ticket_id,
            payout_amount=ticket.get("payout_amount", 0.0),
            message="Ce ticket a déjà été payé"
        )
    
    if status != "WINNER":
        return TicketPayoutResponse(
            success=False,
            ticket_id=ticket_id,
            message=f"Ce ticket ne peut pas être payé. Statut: {status}"
        )
    
    payout_amount = ticket.get("payout_amount", ticket.get("actual_win", 0.0))
    agent_id = ticket.get("agent_id")
    
    if payout_amount <= 0:
        return TicketPayoutResponse(
            success=False,
            ticket_id=ticket_id,
            message="Montant de paiement invalide"
        )
    
    now = get_current_timestamp()
    payout_id = generate_id("payout_")
    
    # Create payout record
    payout_doc = {
        "payout_id": payout_id,
        "ticket_id": ticket_id,
        "ticket_code": ticket.get("ticket_code"),
        "agent_id": agent_id,
        "company_id": ticket_company,
        "pos_device_id": ticket.get("pos_device_id"),
        "payout_amount": payout_amount,
        "payout_status": "paid",
        "paid_by": current_user["user_id"],
        "paid_by_name": current_user.get("name"),
        "paid_at": now,
        "created_at": now
    }
    
    await db.ticket_payouts.insert_one(payout_doc)
    
    # Update ticket status
    await db.lottery_transactions.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "status": "PAID",
            "paid_at": now,
            "paid_by": current_user["user_id"],
            "paid_by_name": current_user.get("name")
        }}
    )
    
    # Update agent balance
    await db.agent_balances.update_one(
        {"agent_id": agent_id, "company_id": ticket_company},
        {
            "$inc": {
                "total_payouts": payout_amount,
                "current_balance": -payout_amount
            },
            "$set": {"updated_at": now}
        },
        upsert=True
    )
    
    # Log activity
    await log_activity(
        db=db,
        action_type="TICKET_PAID",
        entity_type="ticket",
        entity_id=ticket_id,
        performed_by=current_user["user_id"],
        company_id=ticket_company,
        metadata={
            "ticket_code": ticket.get("ticket_code"),
            "payout_amount": payout_amount,
            "payout_id": payout_id
        },
        ip_address=request.client.host if request.client else None
    )
    
    return TicketPayoutResponse(
        success=True,
        payout_id=payout_id,
        ticket_id=ticket_id,
        payout_amount=payout_amount,
        message=f"Paiement de {payout_amount:.2f} effectué avec succès"
    )


# ============================================================================
# ENDPOINT: GET AGENT BALANCE
# ============================================================================

@winning_router.get("/agent/balance", response_model=AgentBalanceResponse)
async def get_agent_balance(current_user: dict = Depends(get_current_user)):
    """Get current agent's balance"""
    agent_id = current_user["user_id"]
    company_id = current_user.get("company_id")
    
    if not company_id:
        raise HTTPException(status_code=403, detail="Aucune entreprise associée")
    
    # Get or create balance
    balance = await db.agent_balances.find_one(
        {"agent_id": agent_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not balance:
        # Get policy for credit limit
        policy = await db.agent_policies.find_one(
            {"agent_id": agent_id},
            {"_id": 0}
        )
        credit_limit = policy.get("max_credit_limit", 50000.0) if policy else 50000.0
        
        balance = {
            "agent_id": agent_id,
            "company_id": company_id,
            "credit_limit": credit_limit,
            "current_balance": 0.0,
            "available_balance": credit_limit,
            "total_sales": 0.0,
            "total_payouts": 0.0,
            "total_winnings": 0.0
        }
        balance["id"] = generate_id("bal_")
        balance["created_at"] = get_current_timestamp()
        balance["updated_at"] = balance["created_at"]
        await db.agent_balances.insert_one(balance)
    
    # Calculate today's stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Today's sales
    pipeline = [
        {"$match": {"agent_id": agent_id, "created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    sales_result = await db.lottery_transactions.aggregate(pipeline).to_list(1)
    today_sales = sales_result[0]["total"] if sales_result else 0.0
    
    # Today's payouts
    pipeline = [
        {"$match": {"agent_id": agent_id, "paid_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$payout_amount"}}}
    ]
    payout_result = await db.ticket_payouts.aggregate(pipeline).to_list(1)
    today_payouts = payout_result[0]["total"] if payout_result else 0.0
    
    return AgentBalanceResponse(
        agent_id=agent_id,
        company_id=company_id,
        credit_limit=balance.get("credit_limit", 50000.0),
        current_balance=balance.get("current_balance", 0.0),
        available_balance=balance.get("available_balance", balance.get("credit_limit", 50000.0) - balance.get("current_balance", 0.0)),
        total_sales=balance.get("total_sales", 0.0),
        total_payouts=balance.get("total_payouts", 0.0),
        total_winnings=balance.get("total_winnings", 0.0),
        today_sales=today_sales,
        today_payouts=today_payouts
    )


# ============================================================================
# ENDPOINT: GET AGENT BALANCE (ADMIN VIEW)
# ============================================================================

@winning_router.get("/admin/agent-balances")
async def get_all_agent_balances(current_user: dict = Depends(get_current_user)):
    """Get all agent balances for company (Admin only)"""
    if current_user.get("role") not in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    
    company_id = current_user.get("company_id")
    
    query = {}
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    balances = await db.agent_balances.find(query, {"_id": 0}).to_list(500)
    
    # Enrich with agent names
    for balance in balances:
        agent = await db.users.find_one(
            {"user_id": balance["agent_id"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        balance["agent_name"] = agent.get("name") if agent else "Unknown"
        balance["agent_email"] = agent.get("email") if agent else None
    
    return balances


# ============================================================================
# ENDPOINT: GET PAYOUTS HISTORY
# ============================================================================

@winning_router.get("/admin/payouts")
async def get_payout_history(
    current_user: dict = Depends(get_current_user),
    agent_id: str = None,
    date_from: str = None,
    date_to: str = None,
    limit: int = 200
):
    """Get payout history for company"""
    if current_user.get("role") not in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.SUPER_ADMIN, UserRole.AGENT_POS]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    company_id = current_user.get("company_id")
    
    query = {}
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    if current_user.get("role") == UserRole.AGENT_POS:
        query["agent_id"] = current_user["user_id"]
    elif agent_id:
        query["agent_id"] = agent_id
    
    if date_from:
        query["paid_at"] = {"$gte": date_from}
    if date_to:
        if "paid_at" in query:
            query["paid_at"]["$lte"] = date_to
        else:
            query["paid_at"] = {"$lte": date_to}
    
    payouts = await db.ticket_payouts.find(
        query, {"_id": 0}
    ).sort("paid_at", -1).limit(limit).to_list(limit)
    
    return payouts


# ============================================================================
# ENDPOINT: GET WINNING TICKETS
# ============================================================================

@winning_router.get("/admin/winning-tickets")
async def get_winning_tickets(
    current_user: dict = Depends(get_current_user),
    status: str = None,  # WINNER, PAID
    date_from: str = None,
    date_to: str = None,
    limit: int = 200
):
    """Get all winning tickets for company"""
    if current_user.get("role") not in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    
    company_id = current_user.get("company_id")
    
    query = {"status": {"$in": ["WINNER", "PAID"]}}
    
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    if status:
        query["status"] = status
    
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    tickets = await db.lottery_transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Calculate totals
    total_won = sum(t.get("payout_amount", 0) for t in tickets)
    total_paid = sum(t.get("payout_amount", 0) for t in tickets if t.get("status") == "PAID")
    total_unpaid = sum(t.get("payout_amount", 0) for t in tickets if t.get("status") == "WINNER")
    
    return {
        "tickets": tickets,
        "summary": {
            "total_winners": len(tickets),
            "total_won_amount": total_won,
            "total_paid_amount": total_paid,
            "total_unpaid_amount": total_unpaid,
            "paid_count": len([t for t in tickets if t.get("status") == "PAID"]),
            "unpaid_count": len([t for t in tickets if t.get("status") == "WINNER"])
        }
    }


# ============================================================================
# AUTOMATIC WINNING DETECTION (Called when result is added)
# ============================================================================

async def process_winning_tickets(lottery_id: str, draw_date: str, draw_name: str, winning_numbers: str, company_id: str = None):
    """
    Automatically process all tickets for a draw after results are entered
    This is called from super_admin_global_routes when a result is added
    """
    query = {
        "lottery_id": lottery_id,
        "draw_date": draw_date,
        "draw_name": draw_name,
        "status": "PENDING_RESULT"
    }
    
    if company_id:
        query["company_id"] = company_id
    
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).to_list(10000)
    
    now = get_current_timestamp()
    winners_count = 0
    losers_count = 0
    total_payout = 0.0
    
    for ticket in tickets:
        ticket_company = ticket.get("company_id")
        plays = ticket.get("plays", [])
        
        # Calculate payout
        payout_result = await calculate_payout(ticket_company, plays, winning_numbers)
        
        is_winner = payout_result["is_winner"]
        payout_amount = payout_result["total_payout"]
        new_status = "WINNER" if is_winner else "LOSER"
        
        # Update ticket
        await db.lottery_transactions.update_one(
            {"ticket_id": ticket["ticket_id"]},
            {"$set": {
                "status": new_status,
                "winning_numbers": winning_numbers,
                "actual_win": payout_amount,
                "payout_amount": payout_amount,
                "winning_plays": payout_result["winning_plays"],
                "processed_at": now
            }}
        )
        
        if is_winner:
            winners_count += 1
            total_payout += payout_amount
            
            # Update agent winnings balance
            await db.agent_balances.update_one(
                {"agent_id": ticket["agent_id"], "company_id": ticket_company},
                {
                    "$inc": {"total_winnings": payout_amount},
                    "$set": {"updated_at": now}
                },
                upsert=True
            )
        else:
            losers_count += 1
    
    return {
        "processed": len(tickets),
        "winners": winners_count,
        "losers": losers_count,
        "total_payout": total_payout
    }


# ============================================================================
# UPDATE AGENT BALANCE ON TICKET SALE (Hook)
# ============================================================================

async def update_balance_on_sale(agent_id: str, company_id: str, amount: float):
    """
    Update agent balance when a ticket is sold
    Called from universal_pos_routes.py after ticket creation
    """
    now = get_current_timestamp()
    
    # Get or create balance
    balance = await db.agent_balances.find_one(
        {"agent_id": agent_id, "company_id": company_id}
    )
    
    if not balance:
        # Get policy for credit limit
        policy = await db.agent_policies.find_one(
            {"agent_id": agent_id},
            {"_id": 0}
        )
        credit_limit = policy.get("max_credit_limit", 50000.0) if policy else 50000.0
        
        await db.agent_balances.insert_one({
            "id": generate_id("bal_"),
            "agent_id": agent_id,
            "company_id": company_id,
            "credit_limit": credit_limit,
            "current_balance": amount,
            "available_balance": credit_limit - amount,
            "total_sales": amount,
            "total_payouts": 0.0,
            "total_winnings": 0.0,
            "created_at": now,
            "updated_at": now
        })
    else:
        await db.agent_balances.update_one(
            {"agent_id": agent_id, "company_id": company_id},
            {
                "$inc": {
                    "current_balance": amount,
                    "total_sales": amount
                },
                "$set": {"updated_at": now}
            }
        )


# ============================================================================
# CREDIT LIMIT CHECK
# ============================================================================

async def check_credit_limit(agent_id: str, company_id: str, amount: float) -> Dict[str, Any]:
    """
    Check if agent has enough credit to make a sale
    Returns: {allowed: bool, available: float, message: str}
    """
    balance = await db.agent_balances.find_one(
        {"agent_id": agent_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not balance:
        # Get policy for credit limit
        policy = await db.agent_policies.find_one(
            {"agent_id": agent_id},
            {"_id": 0}
        )
        credit_limit = policy.get("max_credit_limit", 50000.0) if policy else 50000.0
        available = credit_limit
    else:
        credit_limit = balance.get("credit_limit", 50000.0)
        current = balance.get("current_balance", 0.0)
        available = credit_limit - current
    
    allowed = amount <= available
    
    return {
        "allowed": allowed,
        "credit_limit": credit_limit,
        "available": available,
        "requested": amount,
        "message": "" if allowed else f"Crédit insuffisant. Disponible: {available:.2f}"
    }
