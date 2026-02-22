"""
LOTO PAM Online Platform Routes
Public and Admin API routes for online lottery platform
"""
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import re

from online_models import *
from auth import verify_password, get_password_hash, create_access_token, decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity
from rate_limiter import limiter

online_router = APIRouter(prefix="/online", tags=["LOTO PAM Online"])
online_admin_router = APIRouter(prefix="/online-admin", tags=["LOTO PAM Admin"])
security = HTTPBearer()

db: AsyncIOMotorDatabase = None

def set_online_db(database: AsyncIOMotorDatabase):
    global db
    db = database


# ============ HELPER FUNCTIONS ============
async def get_online_player(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current online player from JWT token"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or payload.get("type") != "online_player":
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    player_id = payload.get("player_id")
    player = await db.online_players.find_one({"player_id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if player.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended")
    
    return player


async def get_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify super admin access for online admin routes"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user or user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    return user


# ============ PUBLIC ROUTES - PLAYER AUTH ============
@online_router.post("/register")
@limiter.limit("5/minute")
async def register_player(request: Request, data: OnlinePlayerRegister):
    """Register a new online player"""
    # Validate accept terms
    if not data.accept_terms:
        raise HTTPException(status_code=400, detail="You must accept the terms and conditions")
    
    # Check existing email
    existing = await db.online_players.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check existing username
    existing = await db.online_players.find_one({"username": data.username.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Validate username format
    if not re.match(r'^[a-z0-9_]+$', data.username.lower()):
        raise HTTPException(status_code=400, detail="Username must be lowercase letters, numbers, and underscores only")
    
    now = get_current_timestamp()
    player_id = generate_id("player_")
    
    # Create player
    player_doc = {
        "player_id": player_id,
        "full_name": data.full_name,
        "username": data.username.lower(),
        "email": data.email.lower(),
        "phone": data.phone,
        "password_hash": get_password_hash(data.password),
        "status": PlayerStatus.PENDING_KYC.value,
        "preferred_language": data.preferred_language,
        "created_at": now,
        "last_login_at": None,
        "kyc_status": None
    }
    await db.online_players.insert_one(player_doc)
    
    # Create wallet
    wallet_doc = {
        "wallet_id": generate_id("wallet_"),
        "player_id": player_id,
        "balance": 0.0,
        "currency": "HTG",
        "created_at": now,
        "updated_at": now
    }
    await db.online_wallets.insert_one(wallet_doc)
    
    # Create token
    token = create_access_token({
        "player_id": player_id,
        "type": "online_player"
    })
    
    return {
        "message": "Account created successfully",
        "token": token,
        "player": {
            "player_id": player_id,
            "full_name": data.full_name,
            "username": data.username.lower(),
            "email": data.email.lower(),
            "status": PlayerStatus.PENDING_KYC.value
        }
    }


@online_router.post("/login")
@limiter.limit("10/minute")
async def login_player(request: Request, data: OnlinePlayerLogin):
    """Login an online player"""
    player = await db.online_players.find_one({"email": data.email.lower()}, {"_id": 0})
    
    if not player or not verify_password(data.password, player.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if player.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended. Contact support.")
    
    if player.get("status") == "blocked":
        raise HTTPException(status_code=403, detail="Account blocked.")
    
    # Update last login
    now = get_current_timestamp()
    await db.online_players.update_one(
        {"player_id": player["player_id"]},
        {"$set": {"last_login_at": now}}
    )
    
    # Get wallet
    wallet = await db.online_wallets.find_one({"player_id": player["player_id"]}, {"_id": 0})
    
    # Create token
    token = create_access_token({
        "player_id": player["player_id"],
        "type": "online_player"
    })
    
    return {
        "message": "Login successful",
        "token": token,
        "player": {
            "player_id": player["player_id"],
            "full_name": player["full_name"],
            "username": player["username"],
            "email": player["email"],
            "status": player["status"],
            "kyc_status": player.get("kyc_status"),
            "preferred_language": player.get("preferred_language", "fr")
        },
        "wallet": {
            "balance": wallet["balance"] if wallet else 0.0,
            "currency": wallet["currency"] if wallet else "HTG"
        }
    }


@online_router.get("/me")
async def get_player_profile(player: dict = Depends(get_online_player)):
    """Get current player profile"""
    wallet = await db.online_wallets.find_one({"player_id": player["player_id"]}, {"_id": 0})
    
    return {
        "player": {
            "player_id": player["player_id"],
            "full_name": player["full_name"],
            "username": player["username"],
            "email": player["email"],
            "phone": player["phone"],
            "status": player["status"],
            "kyc_status": player.get("kyc_status"),
            "preferred_language": player.get("preferred_language", "fr"),
            "created_at": player["created_at"]
        },
        "wallet": {
            "balance": wallet["balance"] if wallet else 0.0,
            "currency": wallet["currency"] if wallet else "HTG"
        }
    }


# ============ WALLET ROUTES ============
@online_router.get("/wallet")
async def get_wallet(player: dict = Depends(get_online_player)):
    """Get player wallet info"""
    wallet = await db.online_wallets.find_one({"player_id": player["player_id"]}, {"_id": 0})
    
    # Get recent transactions
    transactions = await db.online_wallet_transactions.find(
        {"player_id": player["player_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        "balance": wallet["balance"] if wallet else 0.0,
        "currency": wallet["currency"] if wallet else "HTG",
        "recent_transactions": transactions
    }


@online_router.post("/wallet/deposit")
@limiter.limit("10/minute")
async def request_deposit(request: Request, data: DepositRequest, player: dict = Depends(get_online_player)):
    """Request a deposit (pending admin approval)"""
    if data.amount < 100:
        raise HTTPException(status_code=400, detail="Minimum deposit is 100 HTG")
    
    now = get_current_timestamp()
    transaction_id = generate_id("txn_")
    
    transaction_doc = {
        "transaction_id": transaction_id,
        "player_id": player["player_id"],
        "type": WalletTransactionType.DEPOSIT_REQUEST.value,
        "amount": data.amount,
        "method": data.method.value,
        "reference_code": data.reference_code,
        "sender_phone": data.sender_phone,
        "status": WalletTransactionStatus.PENDING.value,
        "notes": None,
        "admin_id": None,
        "created_at": now,
        "processed_at": None
    }
    await db.online_wallet_transactions.insert_one(transaction_doc)
    
    return {
        "message": "Deposit request submitted. Awaiting confirmation.",
        "transaction_id": transaction_id,
        "amount": data.amount,
        "method": data.method.value,
        "status": "pending"
    }


@online_router.post("/wallet/withdraw")
@limiter.limit("5/minute")
async def request_withdrawal(request: Request, data: WithdrawRequest, player: dict = Depends(get_online_player)):
    """Request a withdrawal (requires KYC)"""
    # Check KYC status
    if player.get("status") != PlayerStatus.VERIFIED.value:
        raise HTTPException(status_code=403, detail="KYC verification required for withdrawals")
    
    # Check balance
    wallet = await db.online_wallets.find_one({"player_id": player["player_id"]})
    if not wallet or wallet["balance"] < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    if data.amount < 500:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is 500 HTG")
    
    now = get_current_timestamp()
    transaction_id = generate_id("txn_")
    
    # Deduct from wallet immediately (hold)
    await db.online_wallets.update_one(
        {"player_id": player["player_id"]},
        {
            "$inc": {"balance": -data.amount},
            "$set": {"updated_at": now}
        }
    )
    
    transaction_doc = {
        "transaction_id": transaction_id,
        "player_id": player["player_id"],
        "type": WalletTransactionType.WITHDRAW_REQUEST.value,
        "amount": data.amount,
        "method": data.method.value,
        "payout_phone": data.payout_phone,
        "status": WalletTransactionStatus.PENDING.value,
        "notes": None,
        "admin_id": None,
        "created_at": now,
        "processed_at": None
    }
    await db.online_wallet_transactions.insert_one(transaction_doc)
    
    return {
        "message": "Withdrawal request submitted. You will be notified when processed.",
        "transaction_id": transaction_id,
        "amount": data.amount,
        "method": data.method.value,
        "status": "pending"
    }


# ============ GAMES ROUTES ============
@online_router.get("/games")
async def get_available_games(player: dict = Depends(get_online_player)):
    """Get available online games"""
    # Get online settings
    settings = await db.online_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {"lottery_enabled": True, "keno_enabled": True, "raffle_enabled": True}
    
    games = []
    
    if settings.get("lottery_enabled", True):
        games.append({
            "type": "lottery",
            "name": "Loterie",
            "description": "50 États + Haïti",
            "icon": "🎰"
        })
    
    if settings.get("keno_enabled", True):
        games.append({
            "type": "keno",
            "name": "Keno",
            "description": "Tirages rapides",
            "icon": "🎯"
        })
    
    if settings.get("raffle_enabled", True):
        games.append({
            "type": "raffle",
            "name": "Raffle",
            "description": "Tombolas spéciales",
            "icon": "🎫"
        })
    
    return {"games": games}


@online_router.get("/lotteries")
async def get_online_lotteries(player: dict = Depends(get_online_player)):
    """Get lotteries available for online play"""
    settings = await db.online_settings.find_one({}, {"_id": 0})
    enabled_ids = settings.get("enabled_lottery_ids", []) if settings else []
    
    # If no specific IDs, get all active lotteries
    if enabled_ids:
        query = {"lottery_id": {"$in": enabled_ids}, "is_active": True}
    else:
        query = {"is_active": True}
    
    lotteries = await db.global_lotteries.find(query, {"_id": 0}).to_list(200)
    
    # Get schedules for today
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    for lottery in lotteries:
        schedules = await db.global_schedules.find(
            {"lottery_id": lottery["lottery_id"], "is_active": True},
            {"_id": 0}
        ).to_list(10)
        lottery["schedules"] = schedules
    
    return {"lotteries": lotteries, "count": len(lotteries)}


@online_router.post("/tickets/create")
@limiter.limit("30/minute")
async def create_online_ticket(request: Request, data: OnlineTicketCreate, player: dict = Depends(get_online_player)):
    """Create an online lottery ticket"""
    # Get wallet
    wallet = await db.online_wallets.find_one({"player_id": player["player_id"]})
    
    # Calculate total
    total_amount = sum(play.get("amount", 0) for play in data.plays)
    
    if not wallet or wallet["balance"] < total_amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Get lottery info
    lottery = await db.global_lotteries.find_one({"lottery_id": data.game_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    # Get schedule
    schedule = await db.global_schedules.find_one({"schedule_id": data.schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check if schedule is open
    now = datetime.now(timezone.utc)
    close_time = schedule.get("close_time", "23:59")
    close_datetime = datetime.strptime(f"{now.strftime('%Y-%m-%d')} {close_time}", "%Y-%m-%d %H:%M")
    close_datetime = close_datetime.replace(tzinfo=timezone.utc)
    
    if now >= close_datetime:
        raise HTTPException(status_code=400, detail="This draw is closed")
    
    now_str = get_current_timestamp()
    ticket_id = generate_id("otkt_")
    
    # Deduct from wallet
    await db.online_wallets.update_one(
        {"player_id": player["player_id"]},
        {
            "$inc": {"balance": -total_amount},
            "$set": {"updated_at": now_str}
        }
    )
    
    # Create transaction
    await db.online_wallet_transactions.insert_one({
        "transaction_id": generate_id("txn_"),
        "player_id": player["player_id"],
        "type": WalletTransactionType.BET_DEBIT.value,
        "amount": total_amount,
        "reference": ticket_id,
        "status": WalletTransactionStatus.APPROVED.value,
        "created_at": now_str,
        "processed_at": now_str
    })
    
    # Calculate potential win
    potential_win = total_amount * 500  # Example multiplier
    
    # Create ticket
    ticket_doc = {
        "ticket_id": ticket_id,
        "player_id": player["player_id"],
        "game_id": data.game_id,
        "game_name": lottery["lottery_name"],
        "schedule_id": data.schedule_id,
        "draw_type": schedule.get("draw_type"),
        "draw_date": now.strftime("%Y-%m-%d"),
        "plays": data.plays,
        "total_amount": total_amount,
        "potential_win": potential_win,
        "actual_win": 0.0,
        "status": OnlineTicketStatus.PENDING.value,
        "created_at": now_str,
        "device_info": request.headers.get("user-agent", ""),
        "ip_hash": str(hash(request.client.host))[:8]
    }
    await db.online_tickets.insert_one(ticket_doc)
    
    return {
        "message": "Ticket created successfully",
        "ticket": {
            "ticket_id": ticket_id,
            "game_name": lottery["lottery_name"],
            "draw_type": schedule.get("draw_type"),
            "plays": data.plays,
            "total_amount": total_amount,
            "potential_win": potential_win,
            "status": "pending"
        }
    }


@online_router.get("/tickets")
async def get_player_tickets(
    player: dict = Depends(get_online_player),
    status: Optional[str] = None,
    limit: int = 50
):
    """Get player's tickets"""
    query = {"player_id": player["player_id"]}
    if status:
        query["status"] = status
    
    tickets = await db.online_tickets.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"tickets": tickets, "count": len(tickets)}


# ============ RESULTS ROUTES ============
@online_router.get("/results")
async def get_public_results(limit: int = 50):
    """Get latest lottery results (public endpoint)"""
    results = await db.global_results.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with lottery info
    for result in results:
        lottery = await db.global_lotteries.find_one(
            {"lottery_id": result.get("lottery_id")},
            {"_id": 0, "lottery_name": 1, "state_code": 1}
        )
        if lottery:
            result["lottery_name"] = lottery.get("lottery_name")
            result["state_code"] = lottery.get("state_code")
    
    return {"results": results}


# ============ KYC ROUTES ============
@online_router.post("/kyc/submit")
async def submit_kyc(data: KYCSubmission, player: dict = Depends(get_online_player)):
    """Submit KYC documents"""
    # Check if already submitted
    existing = await db.kyc_submissions.find_one({"player_id": player["player_id"], "status": "pending"})
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending KYC submission")
    
    now = get_current_timestamp()
    submission_id = generate_id("kyc_")
    
    submission_doc = {
        "submission_id": submission_id,
        "player_id": player["player_id"],
        "document_type": data.document_type,
        "document_number": data.document_number,
        "images": [],  # Would be uploaded separately
        "selfie": None,
        "status": KYCStatus.PENDING.value,
        "reviewed_by": None,
        "reviewed_at": None,
        "notes": None,
        "created_at": now
    }
    await db.kyc_submissions.insert_one(submission_doc)
    
    return {
        "message": "KYC documents submitted. You will be notified once reviewed.",
        "submission_id": submission_id
    }


@online_router.get("/kyc/status")
async def get_kyc_status(player: dict = Depends(get_online_player)):
    """Get player's KYC status"""
    submission = await db.kyc_submissions.find_one(
        {"player_id": player["player_id"]},
        {"_id": 0}
    )
    
    return {
        "player_status": player.get("status"),
        "kyc_status": player.get("kyc_status"),
        "submission": submission
    }


# ============ ONLINE SETTINGS (PUBLIC) ============
@online_router.get("/settings")
async def get_public_settings():
    """Get public platform settings"""
    settings = await db.online_settings.find_one({}, {"_id": 0})
    
    if not settings:
        settings = {
            "platform_name": "LOTO PAM",
            "logo_url": None,
            "primary_color": "#FFD700",
            "secondary_color": "#1a1a2e",
            "contact_phone": "+509 44 77 90 43",
            "moncash_number": "+509 44 77 90 43",
            "natcash_number": "+509 33 45 30 59",
            "maintenance_mode": False
        }
    
    return settings


# ============ ADMIN ROUTES ============
@online_admin_router.get("/overview")
async def get_online_overview(admin: dict = Depends(get_super_admin)):
    """Get online platform overview stats"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    total_players = await db.online_players.count_documents({})
    active_players = await db.online_players.count_documents({"status": {"$ne": "suspended"}})
    pending_kyc = await db.online_players.count_documents({"status": "pending_kyc"})
    
    # Pending transactions
    pending_deposits = await db.online_wallet_transactions.find(
        {"type": "deposit_request", "status": "pending"},
        {"_id": 0, "amount": 1}
    ).to_list(1000)
    
    pending_withdrawals = await db.online_wallet_transactions.find(
        {"type": "withdraw_request", "status": "pending"},
        {"_id": 0, "amount": 1}
    ).to_list(1000)
    
    # Today's activity
    today_tickets = await db.online_tickets.find(
        {"created_at": {"$gte": today_start}},
        {"_id": 0, "total_amount": 1, "actual_win": 1}
    ).to_list(10000)
    
    fraud_alerts = await db.fraud_alerts.count_documents({"status": "NEW"})
    
    return {
        "total_players": total_players,
        "active_players": active_players,
        "pending_kyc": pending_kyc,
        "pending_deposits": {
            "count": len(pending_deposits),
            "total_amount": sum(d["amount"] for d in pending_deposits)
        },
        "pending_withdrawals": {
            "count": len(pending_withdrawals),
            "total_amount": sum(w["amount"] for w in pending_withdrawals)
        },
        "today": {
            "tickets_count": len(today_tickets),
            "bets_amount": sum(t["total_amount"] for t in today_tickets),
            "winnings_amount": sum(t["actual_win"] for t in today_tickets)
        },
        "fraud_alerts": fraud_alerts
    }


@online_admin_router.get("/players")
async def get_all_players(
    admin: dict = Depends(get_super_admin),
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get all online players"""
    query = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"username": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}}
        ]
    
    players = await db.online_players.find(query, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.online_players.count_documents(query)
    
    # Get wallet balances
    for player in players:
        wallet = await db.online_wallets.find_one({"player_id": player["player_id"]}, {"_id": 0, "balance": 1})
        player["balance"] = wallet["balance"] if wallet else 0.0
    
    return {"players": players, "total": total}


@online_admin_router.get("/players/{player_id}")
async def get_player_detail(player_id: str, admin: dict = Depends(get_super_admin)):
    """Get detailed player info"""
    player = await db.online_players.find_one({"player_id": player_id}, {"_id": 0, "password_hash": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    wallet = await db.online_wallets.find_one({"player_id": player_id}, {"_id": 0})
    transactions = await db.online_wallet_transactions.find({"player_id": player_id}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    tickets = await db.online_tickets.find({"player_id": player_id}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    kyc = await db.kyc_submissions.find_one({"player_id": player_id}, {"_id": 0})
    
    return {
        "player": player,
        "wallet": wallet,
        "transactions": transactions,
        "tickets": tickets,
        "kyc": kyc
    }


@online_admin_router.put("/players/{player_id}/status")
async def update_player_status(player_id: str, status: str, admin: dict = Depends(get_super_admin)):
    """Suspend or activate a player"""
    if status not in ["pending_kyc", "verified", "suspended", "blocked"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.online_players.update_one(
        {"player_id": player_id},
        {"$set": {"status": status, "updated_at": get_current_timestamp()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Player not found")
    
    await log_activity(
        db=db,
        action_type="PLAYER_STATUS_UPDATE",
        performed_by=admin["user_id"],
        entity_type="online_player",
        entity_id=player_id,
        metadata={"new_status": status}
    )
    
    return {"message": f"Player status updated to {status}"}


@online_admin_router.get("/deposits/pending")
async def get_pending_deposits(admin: dict = Depends(get_super_admin)):
    """Get pending deposit requests"""
    deposits = await db.online_wallet_transactions.find(
        {"type": "deposit_request", "status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    # Enrich with player info
    for dep in deposits:
        player = await db.online_players.find_one(
            {"player_id": dep["player_id"]},
            {"_id": 0, "full_name": 1, "username": 1, "email": 1}
        )
        dep["player"] = player
    
    return {"deposits": deposits, "count": len(deposits)}


@online_admin_router.post("/deposits/approve")
async def approve_deposit(data: TransactionApproval, admin: dict = Depends(get_super_admin)):
    """Approve or reject a deposit"""
    transaction = await db.online_wallet_transactions.find_one(
        {"transaction_id": data.transaction_id, "type": "deposit_request", "status": "pending"}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found or already processed")
    
    now = get_current_timestamp()
    
    if data.approved:
        # Credit wallet
        await db.online_wallets.update_one(
            {"player_id": transaction["player_id"]},
            {
                "$inc": {"balance": transaction["amount"]},
                "$set": {"updated_at": now}
            }
        )
        
        new_type = WalletTransactionType.DEPOSIT_APPROVED.value
        new_status = WalletTransactionStatus.APPROVED.value
    else:
        new_type = WalletTransactionType.DEPOSIT_REJECTED.value
        new_status = WalletTransactionStatus.REJECTED.value
    
    await db.online_wallet_transactions.update_one(
        {"transaction_id": data.transaction_id},
        {"$set": {
            "type": new_type,
            "status": new_status,
            "notes": data.notes,
            "admin_id": admin["user_id"],
            "processed_at": now
        }}
    )
    
    await log_activity(
        db=db,
        action_type="DEPOSIT_PROCESSED",
        performed_by=admin["user_id"],
        entity_type="wallet_transaction",
        entity_id=data.transaction_id,
        metadata={"approved": data.approved, "amount": transaction["amount"]}
    )
    
    return {"message": f"Deposit {'approved' if data.approved else 'rejected'}"}


@online_admin_router.get("/withdrawals/pending")
async def get_pending_withdrawals(admin: dict = Depends(get_super_admin)):
    """Get pending withdrawal requests"""
    withdrawals = await db.online_wallet_transactions.find(
        {"type": "withdraw_request", "status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    # Enrich with player info
    for w in withdrawals:
        player = await db.online_players.find_one(
            {"player_id": w["player_id"]},
            {"_id": 0, "full_name": 1, "username": 1, "email": 1, "phone": 1}
        )
        w["player"] = player
    
    return {"withdrawals": withdrawals, "count": len(withdrawals)}


@online_admin_router.post("/withdrawals/process")
async def process_withdrawal(data: TransactionMarkPaid, admin: dict = Depends(get_super_admin)):
    """Mark withdrawal as paid or rejected"""
    transaction = await db.online_wallet_transactions.find_one(
        {"transaction_id": data.transaction_id, "type": "withdraw_request", "status": "pending"}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found or already processed")
    
    now = get_current_timestamp()
    
    # Mark as paid
    await db.online_wallet_transactions.update_one(
        {"transaction_id": data.transaction_id},
        {"$set": {
            "type": WalletTransactionType.WITHDRAW_PAID.value,
            "status": WalletTransactionStatus.PAID.value,
            "notes": data.reference_notes,
            "admin_id": admin["user_id"],
            "processed_at": now
        }}
    )
    
    await log_activity(
        db=db,
        action_type="WITHDRAWAL_PAID",
        performed_by=admin["user_id"],
        entity_type="wallet_transaction",
        entity_id=data.transaction_id,
        metadata={"amount": transaction["amount"], "payout_phone": transaction.get("payout_phone")}
    )
    
    return {"message": "Withdrawal marked as paid"}


@online_admin_router.post("/withdrawals/reject")
async def reject_withdrawal(data: TransactionApproval, admin: dict = Depends(get_super_admin)):
    """Reject a withdrawal and refund balance"""
    transaction = await db.online_wallet_transactions.find_one(
        {"transaction_id": data.transaction_id, "type": "withdraw_request", "status": "pending"}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found or already processed")
    
    now = get_current_timestamp()
    
    # Refund wallet
    await db.online_wallets.update_one(
        {"player_id": transaction["player_id"]},
        {
            "$inc": {"balance": transaction["amount"]},
            "$set": {"updated_at": now}
        }
    )
    
    await db.online_wallet_transactions.update_one(
        {"transaction_id": data.transaction_id},
        {"$set": {
            "type": WalletTransactionType.WITHDRAW_REJECTED.value,
            "status": WalletTransactionStatus.REJECTED.value,
            "notes": data.notes,
            "admin_id": admin["user_id"],
            "processed_at": now
        }}
    )
    
    return {"message": "Withdrawal rejected and balance refunded"}


@online_admin_router.get("/tickets")
async def get_all_online_tickets(
    admin: dict = Depends(get_super_admin),
    status: Optional[str] = None,
    game_id: Optional[str] = None,
    player_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """Get all online tickets"""
    query = {}
    if status:
        query["status"] = status
    if game_id:
        query["game_id"] = game_id
    if player_id:
        query["player_id"] = player_id
    
    tickets = await db.online_tickets.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.online_tickets.count_documents(query)
    
    # Enrich with player info
    for ticket in tickets:
        player = await db.online_players.find_one(
            {"player_id": ticket["player_id"]},
            {"_id": 0, "username": 1, "full_name": 1}
        )
        ticket["player"] = player
    
    return {"tickets": tickets, "total": total}


@online_admin_router.get("/kyc/pending")
async def get_pending_kyc(admin: dict = Depends(get_super_admin)):
    """Get pending KYC submissions"""
    submissions = await db.kyc_submissions.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    for sub in submissions:
        player = await db.online_players.find_one(
            {"player_id": sub["player_id"]},
            {"_id": 0, "full_name": 1, "username": 1, "email": 1}
        )
        sub["player"] = player
    
    return {"submissions": submissions, "count": len(submissions)}


@online_admin_router.post("/kyc/review")
async def review_kyc(data: KYCReview, admin: dict = Depends(get_super_admin)):
    """Approve or reject KYC submission"""
    submission = await db.kyc_submissions.find_one({"submission_id": data.submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    now = get_current_timestamp()
    new_status = KYCStatus.APPROVED.value if data.approved else KYCStatus.REJECTED.value
    
    await db.kyc_submissions.update_one(
        {"submission_id": data.submission_id},
        {"$set": {
            "status": new_status,
            "reviewed_by": admin["user_id"],
            "reviewed_at": now,
            "notes": data.notes
        }}
    )
    
    if data.approved:
        # Update player status
        await db.online_players.update_one(
            {"player_id": submission["player_id"]},
            {"$set": {"status": PlayerStatus.VERIFIED.value, "kyc_status": "approved"}}
        )
    else:
        await db.online_players.update_one(
            {"player_id": submission["player_id"]},
            {"$set": {"kyc_status": "rejected"}}
        )
    
    return {"message": f"KYC {'approved' if data.approved else 'rejected'}"}


@online_admin_router.get("/settings")
async def get_online_settings(admin: dict = Depends(get_super_admin)):
    """Get online platform settings"""
    settings = await db.online_settings.find_one({}, {"_id": 0})
    
    if not settings:
        settings = {
            "platform_name": "LOTO PAM",
            "logo_url": None,
            "primary_color": "#FFD700",
            "secondary_color": "#1a1a2e",
            "contact_email": "support@lotopam.com",
            "contact_phone": "+509 44 77 90 43",
            "moncash_number": "+509 44 77 90 43",
            "natcash_number": "+509 33 45 30 59",
            "maintenance_mode": False,
            "terms_content": "",
            "lottery_enabled": True,
            "keno_enabled": True,
            "raffle_enabled": True,
            "enabled_lottery_ids": []
        }
        await db.online_settings.insert_one(settings)
    
    return settings


@online_admin_router.put("/settings")
async def update_online_settings(data: OnlineSettingsUpdate, admin: dict = Depends(get_super_admin)):
    """Update online platform settings"""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = get_current_timestamp()
    update_data["updated_by"] = admin["user_id"]
    
    await db.online_settings.update_one({}, {"$set": update_data}, upsert=True)
    
    await log_activity(
        db=db,
        action_type="ONLINE_SETTINGS_UPDATE",
        performed_by=admin["user_id"],
        entity_type="online_settings",
        entity_id="online_settings",
        metadata=update_data
    )
    
    return {"message": "Settings updated"}


@online_admin_router.put("/games-config")
async def update_games_config(data: OnlineGamesConfig, admin: dict = Depends(get_super_admin)):
    """Update online games configuration"""
    update_data = data.model_dump()
    update_data["updated_at"] = get_current_timestamp()
    
    await db.online_settings.update_one({}, {"$set": update_data}, upsert=True)
    
    return {"message": "Games configuration updated"}
