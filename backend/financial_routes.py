"""
Financial Routes - Agent Balance, Ticket Check & Payout System
LOTTOLAB - Enterprise Lottery SaaS Platform
"""

from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from decimal import Decimal

from models import UserRole, TicketStatus
from auth import decode_token
from utils import generate_id, get_current_timestamp

financial_router = APIRouter(prefix="/api", tags=["Financial"])
security = HTTPBearer()

db: AsyncIOMotorDatabase = None

def set_financial_db(database: AsyncIOMotorDatabase):
    global db
    db = database


# ============ PYDANTIC MODELS ============

class TicketCheckRequest(BaseModel):
    ticket_code: str

class TicketCheckResponse(BaseModel):
    ticket_id: str
    ticket_code: str
    status: str
    is_winner: bool
    payout_amount: float
    numbers_played: List[Dict[str, Any]]
    winning_numbers: Optional[Dict[str, str]] = None
    draw_date: str
    draw_name: str
    lottery_name: str
    can_be_paid: bool
    message: str

class TicketPayoutRequest(BaseModel):
    ticket_id: str
    payout_method: str = "CASH"  # CASH, TRANSFER, CREDIT
    notes: Optional[str] = None

class TicketPayoutResponse(BaseModel):
    payout_id: str
    ticket_id: str
    ticket_code: str
    payout_amount: float
    payout_method: str
    paid_by: str
    paid_at: str
    agent_new_balance: float
    message: str

class AgentBalanceResponse(BaseModel):
    agent_id: str
    agent_name: str
    company_id: str
    credit_limit: float
    current_balance: float
    available_balance: float
    total_sales: float
    total_payouts: float
    total_winnings: float
    last_updated: str

class AgentBalanceAdjustRequest(BaseModel):
    agent_id: str
    adjustment_type: str  # CREDIT_ADD, CREDIT_REMOVE, BALANCE_RESET
    amount: float
    reason: str


# ============ AUTH DEPENDENCIES ============

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current authenticated user"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return user


async def get_current_agent(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current agent user"""
    user = await get_current_user(credentials)
    if user.get("role") != UserRole.AGENT_POS:
        raise HTTPException(status_code=403, detail="Accès réservé aux agents")
    
    if user.get("status") != "ACTIVE":
        raise HTTPException(status_code=403, detail="Compte agent suspendu")
    
    return user


async def get_company_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current company admin"""
    user = await get_current_user(credentials)
    if user.get("role") not in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    
    return user


# ============ HELPER FUNCTIONS ============

async def get_or_create_agent_balance(agent_id: str, company_id: str) -> dict:
    """Get or create agent balance record"""
    balance = await db.agent_balances.find_one({"agent_id": agent_id}, {"_id": 0})
    
    if not balance:
        now = get_current_timestamp()
        # Get agent policy for credit limit
        policy = await db.agent_policies.find_one({"agent_id": agent_id}, {"_id": 0})
        credit_limit = policy.get("max_credit_limit", 50000.0) if policy else 50000.0
        
        balance = {
            "balance_id": generate_id("bal_"),
            "agent_id": agent_id,
            "company_id": company_id,
            "credit_limit": credit_limit,
            "current_balance": 0.0,  # Positive = owes money, Negative = credit available
            "available_balance": credit_limit,  # How much can still sell
            "total_sales": 0.0,
            "total_payouts": 0.0,
            "total_winnings": 0.0,
            "created_at": now,
            "updated_at": now
        }
        await db.agent_balances.insert_one(balance)
        balance.pop("_id", None)
    
    return balance


def calculate_payout_for_play(play: dict, winning_numbers: dict, prime_configs: List[dict]) -> float:
    """
    Calculate payout for a single play against winning numbers.
    
    Winning numbers format: {"first": "123", "second": "456", "third": "789"}
    Play format: {"numbers": "123", "bet_type": "BORLETTE", "amount": 100}
    """
    numbers = str(play.get("numbers", "")).strip()
    bet_type = play.get("bet_type", "BORLETTE").upper()
    amount = float(play.get("amount", 0))
    
    first = winning_numbers.get("first", "")
    second = winning_numbers.get("second", "")
    third = winning_numbers.get("third", "")
    
    # Find prime config for this bet type
    prime = None
    for p in prime_configs:
        if p.get("bet_type", "").upper() == bet_type:
            prime = p
            break
    
    if not prime:
        return 0.0
    
    # Parse payout formula (format: "60|20|10" for 1st|2nd|3rd position)
    formula = prime.get("payout_formula", "50")
    payouts = [float(x) for x in formula.split("|")] if "|" in formula else [float(formula)]
    
    payout_first = payouts[0] if len(payouts) > 0 else 0
    payout_second = payouts[1] if len(payouts) > 1 else 0
    payout_third = payouts[2] if len(payouts) > 2 else 0
    
    total_payout = 0.0
    
    # Check match positions
    if numbers == first:
        total_payout += amount * payout_first
    if numbers == second and payout_second > 0:
        total_payout += amount * payout_second
    if numbers == third and payout_third > 0:
        total_payout += amount * payout_third
    
    # Special case for MARIAGE (two numbers combined)
    if bet_type == "MARIAGE":
        # Marriage wins if both numbers appear in winning (any position)
        nums = numbers.split("-") if "-" in numbers else numbers.split("x")
        if len(nums) == 2:
            n1, n2 = nums[0].strip(), nums[1].strip()
            winning_set = {first, second, third}
            if n1 in winning_set and n2 in winning_set:
                total_payout = amount * payout_first
    
    return total_payout


async def process_ticket_winning(ticket: dict, result: dict) -> dict:
    """
    Process a ticket against lottery results.
    Returns updated ticket data with win status and amount.
    """
    company_id = ticket.get("company_id")
    plays = ticket.get("plays", [])
    
    # Get prime configs for payout calculation
    prime_configs = await db.prime_configs.find(
        {"company_id": company_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Parse winning numbers
    winning_numbers = result.get("winning_numbers_parsed", {})
    if not winning_numbers:
        # Try to parse from string format "123-456-789"
        wn_str = result.get("winning_numbers", "")
        parts = wn_str.replace(" ", "").split("-")
        winning_numbers = {
            "first": parts[0] if len(parts) > 0 else "",
            "second": parts[1] if len(parts) > 1 else "",
            "third": parts[2] if len(parts) > 2 else ""
        }
    
    # Calculate total win
    total_win = 0.0
    winning_plays = []
    
    for play in plays:
        payout = calculate_payout_for_play(play, winning_numbers, prime_configs)
        if payout > 0:
            winning_plays.append({
                **play,
                "win_amount": payout
            })
            total_win += payout
    
    # Determine status
    is_winner = total_win > 0
    new_status = TicketStatus.WINNER.value if is_winner else TicketStatus.LOSER.value
    
    return {
        "is_winner": is_winner,
        "status": new_status,
        "win_amount": total_win,
        "winning_plays": winning_plays,
        "winning_numbers": winning_numbers
    }


# ============ TICKET CHECK ENDPOINT ============

@financial_router.post("/tickets/check", response_model=TicketCheckResponse)
async def check_ticket(
    check_data: TicketCheckRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Check if a ticket is a winner.
    Can be called by agents or admins.
    Compares ticket numbers against global_results and calculates payout.
    """
    company_id = current_user.get("company_id")
    
    # Find ticket by code
    query = {"ticket_code": check_data.ticket_code}
    
    # If not super admin, filter by company
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        if not company_id:
            raise HTTPException(status_code=403, detail="Entreprise non trouvée")
        query["company_id"] = company_id
    
    ticket = await db.lottery_transactions.find_one(query, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    ticket_id = ticket.get("ticket_id")
    ticket_status = ticket.get("status", "PENDING_RESULT")
    
    # If already processed, return cached result
    if ticket_status in [TicketStatus.WINNER.value, TicketStatus.LOSER.value, TicketStatus.PAID.value]:
        is_winner = ticket_status in [TicketStatus.WINNER.value, TicketStatus.PAID.value]
        win_amount = ticket.get("win_amount", 0.0)
        
        return TicketCheckResponse(
            ticket_id=ticket_id,
            ticket_code=ticket.get("ticket_code"),
            status=ticket_status,
            is_winner=is_winner,
            payout_amount=win_amount,
            numbers_played=ticket.get("plays", []),
            winning_numbers=ticket.get("winning_numbers"),
            draw_date=ticket.get("draw_date"),
            draw_name=ticket.get("draw_name"),
            lottery_name=ticket.get("lottery_name"),
            can_be_paid=ticket_status == TicketStatus.WINNER.value,
            message="Ticket gagnant!" if is_winner else "Ticket perdant"
        )
    
    # Check if voided
    if ticket_status == TicketStatus.VOID.value:
        return TicketCheckResponse(
            ticket_id=ticket_id,
            ticket_code=ticket.get("ticket_code"),
            status=ticket_status,
            is_winner=False,
            payout_amount=0.0,
            numbers_played=ticket.get("plays", []),
            winning_numbers=None,
            draw_date=ticket.get("draw_date"),
            draw_name=ticket.get("draw_name"),
            lottery_name=ticket.get("lottery_name"),
            can_be_paid=False,
            message="Ticket annulé"
        )
    
    # Find result for this ticket's draw
    result = await db.global_results.find_one({
        "lottery_id": ticket.get("lottery_id"),
        "draw_date": ticket.get("draw_date"),
        "draw_name": ticket.get("draw_name")
    }, {"_id": 0})
    
    if not result:
        return TicketCheckResponse(
            ticket_id=ticket_id,
            ticket_code=ticket.get("ticket_code"),
            status="PENDING_RESULT",
            is_winner=False,
            payout_amount=0.0,
            numbers_played=ticket.get("plays", []),
            winning_numbers=None,
            draw_date=ticket.get("draw_date"),
            draw_name=ticket.get("draw_name"),
            lottery_name=ticket.get("lottery_name"),
            can_be_paid=False,
            message="Résultat du tirage non encore disponible"
        )
    
    # Process winning
    win_result = await process_ticket_winning(ticket, result)
    
    # Update ticket in database
    now = get_current_timestamp()
    await db.lottery_transactions.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "status": win_result["status"],
            "win_amount": win_result["win_amount"],
            "winning_numbers": win_result["winning_numbers"],
            "checked_at": now,
            "checked_by": current_user.get("user_id")
        }}
    )
    
    # Log activity
    await db.activity_logs.insert_one({
        "log_id": generate_id("log_"),
        "action_type": "TICKET_CHECKED",
        "entity_type": "ticket",
        "entity_id": ticket_id,
        "performed_by": current_user.get("user_id"),
        "company_id": ticket.get("company_id"),
        "metadata": {
            "ticket_code": ticket.get("ticket_code"),
            "is_winner": win_result["is_winner"],
            "win_amount": win_result["win_amount"]
        },
        "created_at": now
    })
    
    # Update agent's total winnings if winner
    if win_result["is_winner"]:
        agent_id = ticket.get("agent_id")
        await db.agent_balances.update_one(
            {"agent_id": agent_id},
            {"$inc": {"total_winnings": win_result["win_amount"]}}
        )
    
    message = f"Ticket gagnant! Gain: {win_result['win_amount']:.2f}" if win_result["is_winner"] else "Ticket perdant"
    
    return TicketCheckResponse(
        ticket_id=ticket_id,
        ticket_code=ticket.get("ticket_code"),
        status=win_result["status"],
        is_winner=win_result["is_winner"],
        payout_amount=win_result["win_amount"],
        numbers_played=ticket.get("plays", []),
        winning_numbers=win_result["winning_numbers"],
        draw_date=ticket.get("draw_date"),
        draw_name=ticket.get("draw_name"),
        lottery_name=ticket.get("lottery_name"),
        can_be_paid=win_result["is_winner"],
        message=message
    )


# ============ TICKET PAYOUT ENDPOINT ============

@financial_router.post("/tickets/payout", response_model=TicketPayoutResponse)
async def payout_ticket(
    payout_data: TicketPayoutRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Process payout for a winning ticket.
    - Verifies ticket is winner and not already paid
    - Creates ticket_payout record
    - Updates ticket status to PAID
    - Updates agent_balances (deducts from agent's debt)
    - Logs activity
    """
    company_id = current_user.get("company_id")
    user_id = current_user.get("user_id")
    
    # Find ticket
    query = {"ticket_id": payout_data.ticket_id}
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        if not company_id:
            raise HTTPException(status_code=403, detail="Entreprise non trouvée")
        query["company_id"] = company_id
    
    ticket = await db.lottery_transactions.find_one(query, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    ticket_id = ticket.get("ticket_id")
    ticket_status = ticket.get("status")
    
    # Verify ticket is a winner
    if ticket_status != TicketStatus.WINNER.value:
        if ticket_status == TicketStatus.PAID.value:
            raise HTTPException(status_code=400, detail="Ce ticket a déjà été payé")
        elif ticket_status == TicketStatus.LOSER.value:
            raise HTTPException(status_code=400, detail="Ce ticket n'est pas gagnant")
        elif ticket_status == TicketStatus.VOID.value:
            raise HTTPException(status_code=400, detail="Ce ticket a été annulé")
        else:
            raise HTTPException(status_code=400, detail="Ce ticket n'a pas encore été vérifié")
    
    payout_amount = ticket.get("win_amount", 0.0)
    if payout_amount <= 0:
        raise HTTPException(status_code=400, detail="Montant de gain invalide")
    
    agent_id = ticket.get("agent_id")
    now = get_current_timestamp()
    
    # Create payout record
    payout_id = generate_id("pay_")
    payout_record = {
        "payout_id": payout_id,
        "ticket_id": ticket_id,
        "ticket_code": ticket.get("ticket_code"),
        "agent_id": agent_id,
        "company_id": ticket.get("company_id"),
        "payout_amount": payout_amount,
        "payout_method": payout_data.payout_method,
        "currency": ticket.get("currency", "HTG"),
        "notes": payout_data.notes,
        "paid_by": user_id,
        "paid_by_name": current_user.get("name"),
        "paid_at": now,
        "ip_address": request.client.host if request.client else None,
        "status": "COMPLETED"
    }
    
    await db.ticket_payouts.insert_one(payout_record)
    
    # Update ticket status
    await db.lottery_transactions.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "status": TicketStatus.PAID.value,
            "paid_at": now,
            "paid_by": user_id,
            "payout_id": payout_id
        }}
    )
    
    # Update agent balance
    # When paying out, the agent's current_balance decreases (they owe less)
    # and available_balance stays the same (credit doesn't change)
    balance = await get_or_create_agent_balance(agent_id, ticket.get("company_id"))
    
    new_current_balance = balance.get("current_balance", 0.0) - payout_amount
    new_total_payouts = balance.get("total_payouts", 0.0) + payout_amount
    
    await db.agent_balances.update_one(
        {"agent_id": agent_id},
        {"$set": {
            "current_balance": new_current_balance,
            "total_payouts": new_total_payouts,
            "updated_at": now
        }}
    )
    
    # Log activity
    await db.activity_logs.insert_one({
        "log_id": generate_id("log_"),
        "action_type": "TICKET_PAID",
        "entity_type": "ticket",
        "entity_id": ticket_id,
        "performed_by": user_id,
        "company_id": ticket.get("company_id"),
        "metadata": {
            "ticket_code": ticket.get("ticket_code"),
            "payout_amount": payout_amount,
            "payout_method": payout_data.payout_method,
            "agent_id": agent_id
        },
        "ip_address": request.client.host if request.client else None,
        "created_at": now
    })
    
    return TicketPayoutResponse(
        payout_id=payout_id,
        ticket_id=ticket_id,
        ticket_code=ticket.get("ticket_code"),
        payout_amount=payout_amount,
        payout_method=payout_data.payout_method,
        paid_by=current_user.get("name"),
        paid_at=now,
        agent_new_balance=new_current_balance,
        message=f"Paiement de {payout_amount:.2f} {ticket.get('currency', 'HTG')} effectué avec succès"
    )


# ============ AGENT BALANCE ENDPOINTS ============

@financial_router.get("/agent/balance", response_model=AgentBalanceResponse)
async def get_my_balance(current_agent: dict = Depends(get_current_agent)):
    """Get current agent's balance"""
    agent_id = current_agent.get("user_id")
    company_id = current_agent.get("company_id")
    
    balance = await get_or_create_agent_balance(agent_id, company_id)
    
    return AgentBalanceResponse(
        agent_id=agent_id,
        agent_name=current_agent.get("name", ""),
        company_id=company_id,
        credit_limit=balance.get("credit_limit", 50000.0),
        current_balance=balance.get("current_balance", 0.0),
        available_balance=balance.get("available_balance", 50000.0),
        total_sales=balance.get("total_sales", 0.0),
        total_payouts=balance.get("total_payouts", 0.0),
        total_winnings=balance.get("total_winnings", 0.0),
        last_updated=balance.get("updated_at", "")
    )


@financial_router.get("/company/agent-balances")
async def get_company_agent_balances(current_admin: dict = Depends(get_company_admin)):
    """Get all agent balances for a company"""
    company_id = current_admin.get("company_id")
    
    # Super admin can see all
    query = {} if current_admin.get("role") == UserRole.SUPER_ADMIN else {"company_id": company_id}
    
    balances = await db.agent_balances.find(query, {"_id": 0}).to_list(500)
    
    # Enrich with agent names
    for balance in balances:
        agent = await db.users.find_one(
            {"user_id": balance.get("agent_id")},
            {"_id": 0, "name": 1, "email": 1}
        )
        if agent:
            balance["agent_name"] = agent.get("name", "")
            balance["agent_email"] = agent.get("email", "")
    
    return balances


@financial_router.put("/company/agent-balances/{agent_id}/adjust")
async def adjust_agent_balance(
    agent_id: str,
    adjust_data: AgentBalanceAdjustRequest,
    request: Request,
    current_admin: dict = Depends(get_company_admin)
):
    """Adjust an agent's credit limit or reset balance (Admin only)"""
    admin_company = current_admin.get("company_id")
    
    # Find agent
    agent = await db.users.find_one({"user_id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé")
    
    # Verify company access
    if current_admin.get("role") != UserRole.SUPER_ADMIN:
        if agent.get("company_id") != admin_company:
            raise HTTPException(status_code=403, detail="Accès non autorisé à cet agent")
    
    company_id = agent.get("company_id")
    balance = await get_or_create_agent_balance(agent_id, company_id)
    
    now = get_current_timestamp()
    update_data = {"updated_at": now}
    
    if adjust_data.adjustment_type == "CREDIT_ADD":
        new_limit = balance.get("credit_limit", 0) + adjust_data.amount
        new_available = balance.get("available_balance", 0) + adjust_data.amount
        update_data["credit_limit"] = new_limit
        update_data["available_balance"] = new_available
        
    elif adjust_data.adjustment_type == "CREDIT_REMOVE":
        new_limit = max(0, balance.get("credit_limit", 0) - adjust_data.amount)
        new_available = max(0, balance.get("available_balance", 0) - adjust_data.amount)
        update_data["credit_limit"] = new_limit
        update_data["available_balance"] = new_available
        
    elif adjust_data.adjustment_type == "BALANCE_RESET":
        update_data["current_balance"] = 0.0
        update_data["available_balance"] = balance.get("credit_limit", 50000.0)
        
    else:
        raise HTTPException(status_code=400, detail="Type d'ajustement invalide")
    
    await db.agent_balances.update_one(
        {"agent_id": agent_id},
        {"$set": update_data}
    )
    
    # Log activity
    await db.activity_logs.insert_one({
        "log_id": generate_id("log_"),
        "action_type": "AGENT_BALANCE_ADJUSTED",
        "entity_type": "agent_balance",
        "entity_id": agent_id,
        "performed_by": current_admin.get("user_id"),
        "company_id": company_id,
        "metadata": {
            "adjustment_type": adjust_data.adjustment_type,
            "amount": adjust_data.amount,
            "reason": adjust_data.reason
        },
        "ip_address": request.client.host if request.client else None,
        "created_at": now
    })
    
    # Get updated balance
    updated_balance = await db.agent_balances.find_one({"agent_id": agent_id}, {"_id": 0})
    
    return {
        "message": "Solde ajusté avec succès",
        "balance": updated_balance
    }


# ============ PAYOUT HISTORY ENDPOINTS ============

@financial_router.get("/company/payouts")
async def get_company_payouts(
    current_admin: dict = Depends(get_company_admin),
    agent_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100
):
    """Get payout history for company"""
    company_id = current_admin.get("company_id")
    
    query = {}
    if current_admin.get("role") != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    if agent_id:
        query["agent_id"] = agent_id
    
    if start_date:
        query["paid_at"] = {"$gte": start_date}
    if end_date:
        if "paid_at" in query:
            query["paid_at"]["$lte"] = end_date
        else:
            query["paid_at"] = {"$lte": end_date}
    
    payouts = await db.ticket_payouts.find(
        query, {"_id": 0}
    ).sort("paid_at", -1).limit(limit).to_list(limit)
    
    return payouts


@financial_router.get("/company/winning-tickets")
async def get_winning_tickets(
    current_admin: dict = Depends(get_company_admin),
    status: Optional[str] = None,  # WINNER, PAID
    agent_id: Optional[str] = None,
    start_date: Optional[str] = None,
    limit: int = 100
):
    """Get all winning tickets for company"""
    company_id = current_admin.get("company_id")
    
    query = {"status": {"$in": [TicketStatus.WINNER.value, TicketStatus.PAID.value]}}
    
    if current_admin.get("role") != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    if status:
        query["status"] = status
    
    if agent_id:
        query["agent_id"] = agent_id
    
    if start_date:
        query["created_at"] = {"$gte": start_date}
    
    tickets = await db.lottery_transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return tickets


# ============ AUTOMATIC WINNING DETECTION ============

async def process_all_tickets_for_result(result: dict):
    """
    Background task to process all pending tickets for a new result.
    Called when Super Admin enters a new result.
    """
    lottery_id = result.get("lottery_id")
    draw_date = result.get("draw_date")
    draw_name = result.get("draw_name")
    
    # Find all pending tickets for this draw
    pending_tickets = await db.lottery_transactions.find({
        "lottery_id": lottery_id,
        "draw_date": draw_date,
        "draw_name": draw_name,
        "status": TicketStatus.PENDING_RESULT.value
    }, {"_id": 0}).to_list(10000)
    
    if not pending_tickets:
        return {"processed": 0, "winners": 0}
    
    winners_count = 0
    now = get_current_timestamp()
    
    for ticket in pending_tickets:
        try:
            win_result = await process_ticket_winning(ticket, result)
            
            # Update ticket
            await db.lottery_transactions.update_one(
                {"ticket_id": ticket["ticket_id"]},
                {"$set": {
                    "status": win_result["status"],
                    "win_amount": win_result["win_amount"],
                    "winning_numbers": win_result["winning_numbers"],
                    "processed_at": now
                }}
            )
            
            if win_result["is_winner"]:
                winners_count += 1
                
                # Update agent's total winnings
                await db.agent_balances.update_one(
                    {"agent_id": ticket.get("agent_id")},
                    {"$inc": {"total_winnings": win_result["win_amount"]}}
                )
        except Exception as e:
            print(f"Error processing ticket {ticket.get('ticket_id')}: {e}")
            continue
    
    return {
        "processed": len(pending_tickets),
        "winners": winners_count,
        "result_id": result.get("result_id"),
        "lottery_id": lottery_id,
        "draw_date": draw_date,
        "draw_name": draw_name
    }


@financial_router.post("/admin/process-results/{result_id}")
async def trigger_result_processing(
    result_id: str,
    background_tasks: BackgroundTasks,
    current_admin: dict = Depends(get_company_admin)
):
    """
    Manually trigger processing of tickets for a specific result.
    Usually called automatically when results are entered.
    """
    if current_admin.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès réservé au Super Admin")
    
    result = await db.global_results.find_one({"result_id": result_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Résultat non trouvé")
    
    # Process in background
    background_tasks.add_task(process_all_tickets_for_result, result)
    
    return {
        "message": "Traitement des tickets lancé en arrière-plan",
        "result_id": result_id,
        "lottery_name": result.get("lottery_name"),
        "draw_date": result.get("draw_date"),
        "draw_name": result.get("draw_name")
    }


# ============ FINANCIAL REPORTS ============

@financial_router.get("/company/financial-summary")
async def get_financial_summary(
    current_admin: dict = Depends(get_company_admin),
    period: str = "today"  # today, week, month
):
    """Get financial summary for company"""
    company_id = current_admin.get("company_id")
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    elif period == "week":
        start_date = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    elif period == "month":
        start_date = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    else:
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Build query
    query = {"created_at": {"$gte": start_date}}
    if current_admin.get("role") != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    # Aggregate sales
    sales_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"},
            "total_wins": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, "$win_amount", 0]}},
            "winners_count": {"$sum": {"$cond": [{"$in": ["$status", ["WINNER", "PAID"]]}, 1, 0]}},
            "paid_count": {"$sum": {"$cond": [{"$eq": ["$status", "PAID"]}, 1, 0]}},
            "voided_count": {"$sum": {"$cond": [{"$eq": ["$status", "VOID"]}, 1, 0]}}
        }}
    ]
    
    sales_result = await db.lottery_transactions.aggregate(sales_pipeline).to_list(1)
    
    # Aggregate payouts
    payout_query = {"paid_at": {"$gte": start_date}}
    if current_admin.get("role") != UserRole.SUPER_ADMIN:
        payout_query["company_id"] = company_id
    
    payout_pipeline = [
        {"$match": payout_query},
        {"$group": {
            "_id": None,
            "total_payouts": {"$sum": "$payout_amount"},
            "payout_count": {"$sum": 1}
        }}
    ]
    
    payout_result = await db.ticket_payouts.aggregate(payout_pipeline).to_list(1)
    
    # Build summary
    sales = sales_result[0] if sales_result else {}
    payouts = payout_result[0] if payout_result else {}
    
    total_sales = sales.get("total_sales", 0.0)
    total_payouts = payouts.get("total_payouts", 0.0)
    
    return {
        "period": period,
        "start_date": start_date,
        "total_tickets": sales.get("total_tickets", 0),
        "total_sales": total_sales,
        "total_wins_amount": sales.get("total_wins", 0.0),
        "winners_count": sales.get("winners_count", 0),
        "paid_count": sales.get("paid_count", 0),
        "voided_count": sales.get("voided_count", 0),
        "total_payouts": total_payouts,
        "payout_count": payouts.get("payout_count", 0),
        "net_revenue": total_sales - total_payouts,
        "profit_margin": ((total_sales - total_payouts) / total_sales * 100) if total_sales > 0 else 0
    }
