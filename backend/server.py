from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.exceptions import RequestValidationError
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os
import logging
from pathlib import Path
from typing import List
from datetime import datetime, timezone, timedelta

from models import *
from auth import verify_password, get_password_hash, create_access_token, decode_token
from utils import generate_id, generate_ticket_code, generate_verification_code, generate_qr_code, get_current_timestamp
from activity_logger import log_activity
from rate_limiter import limiter, RATE_LIMITS
from super_admin_routes import super_admin_router, set_db
from super_admin_global_routes import super_admin_global_router, set_super_admin_global_db, set_ticket_processor
from company_routes import company_router, set_company_db
from company_operational_routes import company_operational_router, set_company_operational_db
from company_admin_routes import company_admin_router, set_company_admin_db
from agent_routes import agent_router, set_agent_db
from universal_pos_routes import universal_pos_router, set_universal_pos_db
from sync_routes import sync_router, set_sync_db
from settings_routes import settings_router, set_settings_db
from financial_routes import financial_router, set_financial_db, process_all_tickets_for_result
from online_routes import online_router, online_admin_router, set_online_db
from error_handlers import validation_exception_handler, generic_exception_handler
from websocket_manager import ws_manager, notify_player, notify_admins, NotificationType
from lottery_engine import set_lottery_engine_db, process_result_for_online_tickets
from succursale_routes import succursale_router, set_succursale_db

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="LOTTOLAB API", version="1.0.0", description="Enterprise Lottery SaaS Platform")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Add exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Auth Dependency
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

# ============ AUTH ROUTES ============
@api_router.post("/auth/login", response_model=LoginResponse)
@limiter.limit("10/minute")  # 10 login attempts per minute per IP
async def login(request: Request, credentials: LoginRequest):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc or not verify_password(credentials.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Update last_login
    now = get_current_timestamp()
    await db.users.update_one(
        {"user_id": user_doc["user_id"]},
        {"$set": {"last_login": now}}
    )
    
    user_doc["last_login"] = now
    user_doc.pop("password_hash", None)
    user = User(**user_doc)
    
    token = create_access_token({"user_id": user.user_id, "role": user.role, "company_id": user.company_id})
    
    # Log login activity
    await log_activity(
        db=db,
        action_type="USER_LOGIN",
        entity_type="user",
        entity_id=user.user_id,
        performed_by=user.user_id,
        company_id=user.company_id,
        metadata={"email": user.email, "role": user.role},
        ip_address=request.client.host if request.client else None
    )
    
    redirect_map = {
        UserRole.SUPER_ADMIN: "/super/dashboard",
        UserRole.COMPANY_ADMIN: "/company/dashboard",
        UserRole.COMPANY_MANAGER: "/company/dashboard",
        UserRole.AGENT_POS: "/pos",
        UserRole.AUDITOR_READONLY: "/company/dashboard"
    }
    
    return LoginResponse(token=token, user=user, redirect_path=redirect_map.get(user.role, "/"))

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return User(**current_user)

@api_router.post("/auth/logout")
async def logout():
    return {"message": "Logged out successfully"}

# ============ SUPER ADMIN ROUTES ============
@api_router.get("/super/dashboard/stats", response_model=DashboardStats)
async def get_super_dashboard_stats(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    total_companies = await db.companies.count_documents({})
    active_companies = await db.companies.count_documents({"status": CompanyStatus.ACTIVE})
    total_agents = await db.agents.count_documents({})
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    tickets_today = await db.tickets.count_documents({"created_at": {"$gte": today_start}})
    
    return DashboardStats(
        total_companies=total_companies,
        active_companies=active_companies,
        total_agents=total_agents,
        tickets_today=tickets_today,
        monthly_revenue=0.0
    )

@api_router.get("/super/companies", response_model=List[Company])
async def get_all_companies(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    companies = await db.companies.find({}, {"_id": 0}).to_list(1000)
    return [Company(**c) for c in companies]

@api_router.post("/super/companies", response_model=Company)
async def create_company(company_data: CompanyCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    existing = await db.companies.find_one({"slug": company_data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Company slug already exists")
    
    company_id = generate_id("comp_")
    now = get_current_timestamp()
    
    company = Company(
        company_id=company_id,
        name=company_data.name,
        slug=company_data.slug,
        status=CompanyStatus.ACTIVE,
        plan=company_data.plan,
        currency=company_data.currency,
        timezone=company_data.timezone,
        contact_email=company_data.contact_email,
        contact_phone=company_data.contact_phone,
        created_at=now,
        updated_at=now
    )
    
    await db.companies.insert_one(company.model_dump())
    
    await db.activity_logs.insert_one({
        "log_id": generate_id("log_"),
        "action_type": "COMPANY_CREATED",
        "entity_type": "company",
        "entity_id": company_id,
        "performed_by": current_user["user_id"],
        "metadata": {"company_name": company.name},
        "created_at": now
    })
    
    return company

@api_router.put("/super/companies/{company_id}", response_model=Company)
async def update_company(company_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    updates["updated_at"] = get_current_timestamp()
    await db.companies.update_one({"company_id": company_id}, {"$set": updates})
    
    company_doc = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company_doc:
        raise HTTPException(status_code=404, detail="Company not found")
    
    return Company(**company_doc)

@api_router.delete("/super/companies/{company_id}")
async def delete_company(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.companies.update_one({"company_id": company_id}, {"$set": {"status": CompanyStatus.SUSPENDED}})
    return {"message": "Company suspended successfully"}

@api_router.get("/super/users", response_model=List[User])
async def get_all_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [User(**u) for u in users]

@api_router.post("/super/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_id = generate_id("user_")
    now = get_current_timestamp()
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "company_id": user_data.company_id,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    user_doc.pop("password_hash")
    return User(**user_doc)

@api_router.get("/super/plans", response_model=List[Plan])
async def get_plans(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    plans = await db.plans.find({}, {"_id": 0}).to_list(100)
    return [Plan(**p) for p in plans]

@api_router.get("/super/activity-logs", response_model=List[ActivityLog])
async def get_all_activity_logs(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    return [ActivityLog(**log) for log in logs]

# ============ COMPANY ADMIN ROUTES (Dashboard and Lotteries) ============
@api_router.get("/company/dashboard/stats", response_model=CompanyDashboardStats)
async def get_company_dashboard_stats(current_user: dict = Depends(get_current_user)):
    company_id = current_user.get("company_id")
    if not company_id or current_user["role"] not in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.AUDITOR_READONLY]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    tickets_today = await db.tickets.count_documents({"company_id": company_id, "created_at": {"$gte": today_start}})
    
    pipeline = [
        {"$match": {"company_id": company_id, "created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    result = await db.tickets.aggregate(pipeline).to_list(1)
    sales_today = result[0]["total"] if result else 0.0
    
    active_agents = await db.agents.count_documents({"company_id": company_id, "status": AgentStatus.ACTIVE})
    
    now = datetime.now(timezone.utc)
    open_lotteries = 0
    company_lotteries = await db.company_lotteries.find({"company_id": company_id, "enabled": True}, {"_id": 0}).to_list(100)
    for cl in company_lotteries:
        lottery = await db.lotteries.find_one({"lottery_id": cl["lottery_id"]}, {"_id": 0})
        if lottery and lottery.get("draw_times"):
            for draw_time_str in lottery["draw_times"]:
                try:
                    draw_time = datetime.fromisoformat(draw_time_str.replace("Z", "+00:00"))
                    open_offset = cl.get("sales_open_offset_minutes") or lottery.get("sales_open_offset_minutes", 240)
                    close_offset = cl.get("sales_close_offset_minutes") or lottery.get("sales_close_offset_minutes", 5)
                    
                    open_time = draw_time - timedelta(minutes=open_offset)
                    close_time = draw_time - timedelta(minutes=close_offset)
                    
                    if open_time <= now <= close_time:
                        open_lotteries += 1
                        break
                except:
                    continue
    
    return CompanyDashboardStats(
        tickets_today=tickets_today,
        sales_today=sales_today,
        active_agents=active_agents,
        open_lotteries=open_lotteries
    )

@api_router.get("/company/lotteries")
async def get_company_lotteries(current_user: dict = Depends(get_current_user)):
    """
    Get ALL global lotteries with company-specific enabled status.
    Company Admin can see ALL lotteries from global_lotteries and toggle them.
    """
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get ALL global lotteries (the master catalog)
    all_lotteries = await db.global_lotteries.find({"is_active": True}, {"_id": 0}).to_list(500)
    
    # Also check legacy lotteries collection for backwards compatibility
    legacy_lotteries = await db.lotteries.find({}, {"_id": 0}).to_list(500)
    
    # Merge if needed (avoid duplicates by lottery_id)
    lottery_ids = {l["lottery_id"] for l in all_lotteries}
    for ll in legacy_lotteries:
        if ll["lottery_id"] not in lottery_ids:
            all_lotteries.append(ll)
    
    # Get company's enabled lotteries
    company_lotteries = await db.company_lotteries.find({"company_id": company_id}, {"_id": 0}).to_list(500)
    enabled_map = {cl["lottery_id"]: cl for cl in company_lotteries}
    
    result = []
    for lottery in all_lotteries:
        lottery_id = lottery["lottery_id"]
        lottery["enabled"] = lottery_id in enabled_map and enabled_map[lottery_id].get("enabled", False)
        result.append(lottery)
    
    # Sort by state_code then lottery_name
    result.sort(key=lambda x: (x.get("state_code", ""), x.get("lottery_name", "")))
    
    return result

@api_router.put("/company/lotteries/{lottery_id}/toggle")
async def toggle_lottery(lottery_id: str, enabled: bool, current_user: dict = Depends(get_current_user)):
    """
    Toggle a lottery on/off for the company.
    This will trigger config version increment for real-time sync to agents.
    """
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    existing = await db.company_lotteries.find_one({"company_id": company_id, "lottery_id": lottery_id})
    now = get_current_timestamp()
    
    if existing:
        await db.company_lotteries.update_one(
            {"company_id": company_id, "lottery_id": lottery_id},
            {"$set": {"enabled": enabled, "updated_at": now}}
        )
    else:
        await db.company_lotteries.insert_one({
            "company_id": company_id,
            "lottery_id": lottery_id,
            "enabled": enabled,
            "created_at": now,
            "updated_at": now
        })
    
    # Increment config version for real-time sync to all agents
    await db.company_config_versions.update_one(
        {"company_id": company_id},
        {
            "$inc": {"version": 1},
            "$set": {
                "last_updated_at": now,
                "last_updated_by": current_user.get("user_id"),
                "change_type": "LOTTERY_TOGGLE"
            }
        },
        upsert=True
    )
    
    return {"message": f"Loterie {'activée' if enabled else 'désactivée'} avec succès", "enabled": enabled}


# ============ POS ROUTES ============
@api_router.get("/pos/lotteries/open")
async def get_open_lotteries(current_user: dict = Depends(get_current_user)):
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    company_lotteries = await db.company_lotteries.find({"company_id": company_id, "enabled": True}, {"_id": 0}).to_list(100)
    
    open_lotteries = []
    for cl in company_lotteries:
        lottery = await db.lotteries.find_one({"lottery_id": cl["lottery_id"]}, {"_id": 0})
        if not lottery or not lottery.get("draw_times"):
            continue
        
        for draw_time_str in lottery["draw_times"]:
            try:
                draw_time = datetime.fromisoformat(draw_time_str.replace("Z", "+00:00"))
                open_offset = cl.get("sales_open_offset_minutes") or lottery.get("sales_open_offset_minutes", 240)
                close_offset = cl.get("sales_close_offset_minutes") or lottery.get("sales_close_offset_minutes", 5)
                
                open_time = draw_time - timedelta(minutes=open_offset)
                close_time = draw_time - timedelta(minutes=close_offset)
                
                if open_time <= now <= close_time:
                    lottery["next_draw"] = draw_time_str
                    lottery["closes_at"] = close_time.isoformat()
                    open_lotteries.append(lottery)
                    break
            except Exception as e:
                logger.error(f"Error parsing draw time: {e}")
                continue
    
    return open_lotteries

@api_router.post("/pos/tickets", response_model=Ticket)
async def create_ticket(ticket_data: TicketCreate, current_user: dict = Depends(get_current_user)):
    company_id = current_user.get("company_id")
    agent_id = current_user.get("user_id")
    
    if not company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    lottery = await db.lotteries.find_one({"lottery_id": ticket_data.lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    ticket_id = generate_id("tkt_")
    ticket_code = generate_ticket_code()
    verification_code = generate_verification_code()
    
    total_amount = sum(play.amount for play in ticket_data.plays)
    
    qr_payload = f"{ticket_code}|{verification_code}|{company_id}"
    qr_code_data = generate_qr_code(qr_payload)
    
    now = get_current_timestamp()
    
    ticket = Ticket(
        ticket_id=ticket_id,
        ticket_code=ticket_code,
        verification_code=verification_code,
        qr_payload=qr_code_data,
        agent_id=agent_id,
        company_id=company_id,
        lottery_id=ticket_data.lottery_id,
        lottery_name=lottery["lottery_name"],
        draw_datetime=ticket_data.draw_datetime,
        plays=[TicketLine(**play.model_dump()) for play in ticket_data.plays],
        total_amount=total_amount,
        currency=company.get("currency", "HTG"),
        status=TicketStatus.ACTIVE,
        created_at=now
    )
    
    await db.tickets.insert_one(ticket.model_dump())
    
    return ticket

@api_router.get("/pos/tickets/my", response_model=List[Ticket])
async def get_my_tickets(current_user: dict = Depends(get_current_user)):
    agent_id = current_user.get("user_id")
    
    tickets = await db.tickets.find({"agent_id": agent_id}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return [Ticket(**t) for t in tickets]

@api_router.post("/pos/tickets/verify")
async def verify_ticket(verification_code: str):
    ticket = await db.tickets.find_one({"verification_code": verification_code}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    result = await db.results.find_one({
        "lottery_id": ticket["lottery_id"],
        "draw_datetime": ticket["draw_datetime"]
    }, {"_id": 0})
    
    return {
        "ticket": ticket,
        "result": result if result else None,
        "is_winner": False
    }

@api_router.get("/pos/summary/daily")
async def get_daily_summary(current_user: dict = Depends(get_current_user)):
    agent_id = current_user.get("user_id")
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    tickets_count = await db.tickets.count_documents({"agent_id": agent_id, "created_at": {"$gte": today_start}})
    
    pipeline = [
        {"$match": {"agent_id": agent_id, "created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    result = await db.tickets.aggregate(pipeline).to_list(1)
    total_sales = result[0]["total"] if result else 0.0
    
    return {
        "tickets_count": tickets_count,
        "total_sales": total_sales,
        "date": today_start
    }

# ============ SHARED ROUTES ============
@api_router.get("/states", response_model=List[State])
async def get_states():
    states = await db.states.find({}, {"_id": 0}).to_list(1000)
    return [State(**s) for s in states]

@api_router.get("/lotteries", response_model=List[Lottery])
async def get_all_lotteries():
    lotteries = await db.lotteries.find({}, {"_id": 0}).to_list(1000)
    return [Lottery(**l) for l in lotteries]

# Initialize all routes with database
set_db(db)
set_super_admin_global_db(db)
set_company_db(db)
set_company_operational_db(db)
set_company_admin_db(db)
set_agent_db(db)
set_universal_pos_db(db)
set_sync_db(db)
set_settings_db(db)
set_financial_db(db)
set_online_db(db)
set_lottery_engine_db(db)
set_succursale_db(db)

# Connect ticket processor for automatic winning detection
set_ticket_processor(process_all_tickets_for_result)

# Include all routers
app.include_router(super_admin_router)
app.include_router(super_admin_global_router)
app.include_router(company_router)
app.include_router(company_operational_router)
app.include_router(company_admin_router)
app.include_router(agent_router)
app.include_router(universal_pos_router)
app.include_router(sync_router)
app.include_router(settings_router)
app.include_router(financial_router)

# Include online routers under /api prefix
api_router.include_router(online_router)
api_router.include_router(online_admin_router)

app.include_router(api_router)


# ============ WEBSOCKET ENDPOINTS ============
@app.websocket("/ws/player/{player_id}")
async def websocket_player_endpoint(websocket: WebSocket, player_id: str):
    """WebSocket endpoint for player real-time notifications"""
    await ws_manager.connect_player(websocket, player_id)
    try:
        while True:
            # Keep connection alive, handle incoming messages if needed
            data = await websocket.receive_text()
            # Can handle ping/pong or other client messages here
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect_player(websocket, player_id)
    except Exception as e:
        logger.error(f"WebSocket error for player {player_id}: {e}")
        ws_manager.disconnect_player(websocket, player_id)


@app.websocket("/ws/admin/{user_id}")
async def websocket_admin_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for admin real-time notifications"""
    await ws_manager.connect_admin(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect_admin(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket error for admin {user_id}: {e}")
        ws_manager.disconnect_admin(websocket, user_id)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
