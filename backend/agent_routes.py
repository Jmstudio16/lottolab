from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from datetime import datetime, timezone, timedelta
import random
import string

from models import UserRole, Ticket, TicketCreate
from auth import decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

agent_router = APIRouter(prefix="/api/agent")
security = HTTPBearer()

db = None

def set_agent_db(database):
    global db
    db = database

async def get_agent_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Strict validation that user is an AGENT_POS"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # STRICT: Only AGENT_POS role allowed
    if user.get("role") != UserRole.AGENT_POS:
        raise HTTPException(status_code=403, detail="Access denied. Agent role required.")
    
    return user

def generate_ticket_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))

def generate_verification_code():
    return ''.join(random.choices(string.digits, k=8))

# ============ AGENT PROFILE ============
@agent_router.get("/profile")
async def get_agent_profile(current_user: dict = Depends(get_agent_user)):
    """Get agent's own profile"""
    agent = await db.agents.find_one(
        {"user_id": current_user["user_id"]}, 
        {"_id": 0}
    )
    return {
        "user": current_user,
        "agent": agent
    }

# ============ AGENT'S OWN TICKETS ============
@agent_router.get("/my-tickets")
async def get_my_tickets(
    current_user: dict = Depends(get_agent_user),
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 200
):
    """Agent can ONLY see their own tickets"""
    query = {"agent_id": current_user["user_id"]}
    
    if status:
        query["status"] = status
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return tickets

@agent_router.get("/my-tickets/{ticket_id}")
async def get_my_ticket_detail(
    ticket_id: str,
    current_user: dict = Depends(get_agent_user)
):
    """Agent can only view their own ticket details"""
    ticket = await db.tickets.find_one(
        {"ticket_id": ticket_id, "agent_id": current_user["user_id"]}, 
        {"_id": 0}
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

# ============ AGENT'S OWN SALES SUMMARY ============
@agent_router.get("/my-sales")
async def get_my_sales_summary(
    current_user: dict = Depends(get_agent_user),
    period: str = "today"
):
    """Agent can ONLY see their own sales summary"""
    now = datetime.now(timezone.utc)
    
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    start_str = start_date.isoformat()
    
    # Total tickets and sales for THIS AGENT ONLY
    pipeline = [
        {"$match": {
            "agent_id": current_user["user_id"],
            "created_at": {"$gte": start_str}
        }},
        {"$group": {
            "_id": None,
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"}
        }}
    ]
    result = await db.tickets.aggregate(pipeline).to_list(1)
    
    total_tickets = result[0]["total_tickets"] if result else 0
    total_sales = result[0]["total_sales"] if result else 0.0
    
    # Sales by lottery for this agent
    lottery_pipeline = [
        {"$match": {
            "agent_id": current_user["user_id"],
            "created_at": {"$gte": start_str}
        }},
        {"$group": {
            "_id": "$lottery_id",
            "lottery_name": {"$first": "$lottery_name"},
            "tickets": {"$sum": 1},
            "sales": {"$sum": "$total_amount"}
        }},
        {"$sort": {"sales": -1}},
        {"$limit": 10}
    ]
    lottery_results = await db.tickets.aggregate(lottery_pipeline).to_list(10)
    
    return {
        "period": period,
        "total_tickets": total_tickets,
        "total_sales": total_sales,
        "sales_by_lottery": lottery_results,
        "agent_name": current_user.get("name"),
        "generated_at": now.isoformat()
    }

# ============ POS - OPEN LOTTERIES ============
@agent_router.get("/pos/lotteries")
async def get_open_lotteries(current_user: dict = Depends(get_agent_user)):
    """Get lotteries currently open for sales"""
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="No company assigned")
    
    now = datetime.now(timezone.utc)
    
    # Get enabled lotteries for company (check both is_enabled and enabled for backward compatibility)
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "$or": [{"is_enabled": True}, {"enabled": True}]}, 
        {"_id": 0}
    ).to_list(100)
    
    if not company_lotteries:
        return []
    
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    lotteries = await db.lotteries.find(
        {"lottery_id": {"$in": lottery_ids}}, 
        {"_id": 0}
    ).to_list(100)
    
    # Get company settings for sales offset
    settings = await db.company_settings.find_one({"company_id": company_id}, {"_id": 0})
    stop_offset = settings.get("stop_sales_before_draw_minutes", 5) if settings else 5
    
    open_lotteries = []
    for lottery in lotteries:
        if lottery.get("draw_times"):
            for draw_time_str in lottery["draw_times"]:
                try:
                    draw_time = datetime.fromisoformat(draw_time_str.replace("Z", "+00:00"))
                    close_time = draw_time - timedelta(minutes=stop_offset)
                    
                    # Check if lottery is open for sales
                    if now < close_time:
                        open_lotteries.append({
                            "lottery_id": lottery["lottery_id"],
                            "lottery_name": lottery["lottery_name"],
                            "game_type": lottery.get("game_type", "PICK3"),
                            "next_draw": draw_time.isoformat(),
                            "closes_at": close_time.isoformat(),
                            "number_format": lottery.get("number_format", "3-digit")
                        })
                        break
                except Exception:
                    continue
    
    return open_lotteries

# ============ POS - SELL TICKET ============
@agent_router.post("/pos/sell")
async def sell_ticket(
    ticket_data: TicketCreate,
    request: Request,
    current_user: dict = Depends(get_agent_user)
):
    """Agent sells a ticket - creates ticket in database"""
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="No company assigned")
    
    # Verify lottery exists and is enabled
    lottery = await db.lotteries.find_one({"lottery_id": ticket_data.lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    company_lottery = await db.company_lotteries.find_one({
        "company_id": company_id, 
        "lottery_id": ticket_data.lottery_id,
        "$or": [{"is_enabled": True}, {"enabled": True}]
    })
    if not company_lottery:
        raise HTTPException(status_code=400, detail="Lottery not enabled for your company")
    
    # Get company settings for validation
    settings = await db.company_settings.find_one({"company_id": company_id}, {"_id": 0})
    min_amount = settings.get("min_ticket_amount", 10) if settings else 10
    max_amount = settings.get("max_ticket_amount", 10000) if settings else 10000
    currency = settings.get("currency", "HTG") if settings else "HTG"
    
    # Calculate total amount
    total_amount = sum(play.amount for play in ticket_data.plays)
    
    if total_amount < min_amount:
        raise HTTPException(status_code=400, detail=f"Minimum ticket amount is {min_amount} {currency}")
    if total_amount > max_amount:
        raise HTTPException(status_code=400, detail=f"Maximum ticket amount is {max_amount} {currency}")
    
    ticket_id = generate_id("tkt_")
    now = get_current_timestamp()
    
    # Get agent info
    agent = await db.agents.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    
    ticket = Ticket(
        ticket_id=ticket_id,
        ticket_code=generate_ticket_code(),
        verification_code=generate_verification_code(),
        company_id=company_id,
        agent_id=current_user["user_id"],
        agent_name=current_user.get("name", "Unknown"),
        pos_device_id=agent.get("pos_device_id") if agent else None,
        lottery_id=ticket_data.lottery_id,
        lottery_name=lottery["lottery_name"],
        draw_datetime=ticket_data.draw_datetime,
        plays=[p.model_dump() for p in ticket_data.plays],
        total_amount=total_amount,
        currency=currency,
        status="ACTIVE",
        created_at=now
    )
    
    await db.tickets.insert_one(ticket.model_dump())
    
    await log_activity(
        db=db,
        action_type="TICKET_SOLD",
        entity_type="ticket",
        entity_id=ticket_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "lottery": lottery["lottery_name"],
            "amount": total_amount,
            "plays_count": len(ticket_data.plays)
        },
        ip_address=request.client.host if request.client else None
    )
    
    return ticket

# ============ POS - DAILY SUMMARY ============
@agent_router.get("/pos/daily-summary")
async def get_pos_daily_summary(current_user: dict = Depends(get_agent_user)):
    """Quick daily summary for POS display"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    pipeline = [
        {"$match": {
            "agent_id": current_user["user_id"],
            "created_at": {"$gte": today_start}
        }},
        {"$group": {
            "_id": None,
            "tickets_count": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"}
        }}
    ]
    result = await db.tickets.aggregate(pipeline).to_list(1)
    
    return {
        "tickets_count": result[0]["tickets_count"] if result else 0,
        "total_sales": result[0]["total_sales"] if result else 0.0
    }
