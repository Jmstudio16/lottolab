from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import os
import logging
from pathlib import Path
from typing import List
from datetime import datetime, timezone, timedelta
import asyncio

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
from saas_core import saas_core_router, set_saas_core_db
from scheduler_tasks import set_scheduler_db, check_expired_subscriptions, check_expiring_soon
from staff_permissions import staff_router, set_staff_db, create_staff_endpoints
from ticket_print_routes import ticket_print_router, set_ticket_print_db
from supervisor_routes import supervisor_router
from results_routes import results_router, set_results_db
from validation_routes import validation_router, set_validation_db, activate_all_lotteries_for_company
from branch_lottery_routes import branch_lottery_router, set_branch_lottery_db
from vendeur.vendeur_routes import vendeur_router, set_vendeur_db
from export_routes import export_router
from lottery_results_routes import results_router, set_results_db
from scheduled_results_routes import scheduled_results_router, set_scheduled_results_db, check_and_release_scheduled_results, initialize_lottery_schedules

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

# Health check endpoint (no auth required)
@api_router.get("/health")
async def health_check():
    """Health check endpoint for monitoring - validates MongoDB permissions"""
    from pymongo.errors import OperationFailure, ServerSelectionTimeoutError
    
    db_status = "unknown"
    permissions_ok = False
    
    try:
        # Test database connection
        await db.command("ping")
        db_status = "connected"
        
        # Test read permission on users collection
        await db.users.find_one({}, {"_id": 1})
        
        # Test read permission on companies collection  
        await db.companies.find_one({}, {"_id": 1})
        
        permissions_ok = True
        
    except OperationFailure as e:
        db_status = f"auth_error: code={e.code}"
        permissions_ok = False
    except ServerSelectionTimeoutError as e:
        db_status = "connection_timeout"
        permissions_ok = False
    except Exception as e:
        db_status = f"error: {str(e)}"
        permissions_ok = False
    
    status = "healthy" if db_status == "connected" and permissions_ok else "degraded"
    
    return {
        "status": status,
        "database": db_status,
        "permissions": "ok" if permissions_ok else "insufficient",
        "version": "9.0.1",
        "timestamp": get_current_timestamp()
    }

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
    # Log incoming request for debugging
    origin = request.headers.get("origin", "no-origin")
    logger.info(f"[LOGIN] Attempt from origin: {origin}, email: {credentials.email}")
    
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        logger.warning(f"[LOGIN] User not found: {credentials.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if user is suspended or deleted
    if user_doc.get("status") in ["SUSPENDED", "DELETED"]:
        raise HTTPException(status_code=403, detail="Compte suspendu ou supprimé. Contactez l'administrateur.")
    
    # Check if company is suspended or expired (for non-super-admin)
    if user_doc.get("role") != UserRole.SUPER_ADMIN and user_doc.get("company_id"):
        company = await db.companies.find_one(
            {"company_id": user_doc["company_id"]},
            {"_id": 0, "status": 1, "license_end": 1}
        )
        if company:
            if company.get("status") in ["SUSPENDED", "DELETED"]:
                raise HTTPException(status_code=403, detail="Entreprise suspendue. Contactez l'administrateur.")
            if company.get("status") == "EXPIRED":
                raise HTTPException(status_code=403, detail="Abonnement expiré. Contactez l'administrateur.")
            
            # Check license expiration
            license_end = company.get("license_end")
            if license_end:
                try:
                    from datetime import datetime, timezone
                    end_date = datetime.fromisoformat(license_end.replace("Z", "+00:00"))
                    if end_date < datetime.now(timezone.utc):
                        # Auto-expire the company
                        await db.companies.update_one(
                            {"company_id": user_doc["company_id"]},
                            {"$set": {"status": "EXPIRED", "updated_at": get_current_timestamp()}}
                        )
                        raise HTTPException(status_code=403, detail="Abonnement expiré. Contactez l'administrateur.")
                except ValueError:
                    pass
    
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
        UserRole.BRANCH_SUPERVISOR: "/supervisor/dashboard",
        UserRole.BRANCH_USER: "/supervisor/dashboard",
        UserRole.AGENT_POS: "/agent/pos",
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
    
    # Auto-activate all lotteries for the new company
    lotteries_activated = await activate_all_lotteries_for_company(company_id)
    
    await db.activity_logs.insert_one({
        "log_id": generate_id("log_"),
        "action_type": "COMPANY_CREATED",
        "entity_type": "company",
        "entity_id": company_id,
        "performed_by": current_user["user_id"],
        "metadata": {"company_name": company.name, "lotteries_activated": lotteries_activated},
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

@api_router.get("/super/activity-logs")
async def get_all_activity_logs(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    return logs

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
    
    # Get Haiti time
    from pytz import timezone as pytz_timezone
    haiti_tz = pytz_timezone('America/Port-au-Prince')
    now_haiti = datetime.now(haiti_tz)
    current_time_str = now_haiti.strftime("%H:%M")
    current_day = now_haiti.weekday()
    
    open_lotteries = 0
    company_lotteries = await db.company_lotteries.find({"company_id": company_id, "enabled": True}, {"_id": 0}).to_list(500)
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    # Use global_schedules to determine open lotteries (same as sync_routes)
    schedules = await db.global_schedules.find({
        "lottery_id": {"$in": lottery_ids},
        "is_active": True
    }, {"_id": 0}).to_list(1000)
    
    seen_lottery_ids = set()
    for schedule in schedules:
        lottery_id = schedule.get("lottery_id")
        if lottery_id in seen_lottery_ids:
            continue
            
        open_time = schedule.get("open_time", "00:00")
        close_time = schedule.get("close_time", "23:59")
        days_of_week = schedule.get("days_of_week", [0, 1, 2, 3, 4, 5, 6])
        
        if current_day in days_of_week:
            if open_time <= current_time_str <= close_time:
                open_lotteries += 1
                seen_lottery_ids.add(lottery_id)
    
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
    
    # Get ALL global lotteries (the master catalog) - check master_lotteries first
    all_lotteries = await db.master_lotteries.find({"is_active_global": True}, {"_id": 0}).to_list(500)
    
    # If no master_lotteries, check global_lotteries for backward compatibility
    if not all_lotteries:
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
        cl = enabled_map.get(lottery_id, {})
        # Check both is_enabled and enabled for backward compatibility
        is_enabled = cl.get("is_enabled", False) or cl.get("enabled", False)
        lottery["enabled"] = is_enabled
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
            {"$set": {
                "enabled": enabled,
                "is_enabled": enabled,  # Add both fields for compatibility
                "is_enabled_for_company": enabled,
                "updated_at": now
            }}
        )
    else:
        await db.company_lotteries.insert_one({
            "company_id": company_id,
            "lottery_id": lottery_id,
            "enabled": enabled,
            "is_enabled": enabled,
            "is_enabled_for_company": enabled,
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


@api_router.get("/company/schedules")
async def get_company_schedules(current_user: dict = Depends(get_current_user)):
    """Get all schedules for company's enabled lotteries"""
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get enabled lottery IDs
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "$or": [{"enabled": True}, {"is_enabled": True}]},
        {"_id": 0, "lottery_id": 1}
    ).to_list(500)
    
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    # Get schedules for these lotteries
    schedules = await db.global_schedules.find(
        {"lottery_id": {"$in": lottery_ids}, "is_active": True},
        {"_id": 0}
    ).to_list(1000)
    
    return schedules


# ============ POS ROUTES ============
@api_router.get("/pos/lotteries/open")
async def get_open_lotteries(current_user: dict = Depends(get_current_user)):
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    # Check both is_enabled and enabled for backward compatibility
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "$or": [{"is_enabled": True}, {"enabled": True}]}, 
        {"_id": 0}
    ).to_list(100)
    
    # Optimized: Batch fetch all lotteries in one query instead of N+1
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    lotteries = await db.lotteries.find({"lottery_id": {"$in": lottery_ids}}, {"_id": 0}).to_list(100)
    lottery_map = {l["lottery_id"]: l for l in lotteries}
    
    open_lotteries = []
    for cl in company_lotteries:
        lottery = lottery_map.get(cl["lottery_id"])
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


# ============ VENDEUR CONVENIENCE ROUTES ============
# These routes redirect to the vendeur router but are placed here for backward compatibility

from vendeur.vendeur_routes import SellRequest, PlayCreate

@api_router.post("/lottery/sell")
async def lottery_sell_redirect(
    request: Request,
    sell_data: SellRequest,
    current_user: dict = Depends(get_current_user)
):
    """Convenience endpoint for selling lottery tickets - redirects to vendeur/sell"""
    vendeur_id = current_user.get("user_id")
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    # Check if user can sell
    allowed_roles = [UserRole.AGENT_POS, "VENDEUR", "AGENT_POS"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès réservé aux vendeurs")
    
    # Validate lottery exists
    lottery = await db.master_lotteries.find_one({"lottery_id": sell_data.lottery_id}, {"_id": 0})
    if not lottery:
        lottery = await db.global_lotteries.find_one({"lottery_id": sell_data.lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée")
    
    # Check company lottery enabled
    company_lottery = await db.company_lotteries.find_one({
        "company_id": company_id,
        "lottery_id": sell_data.lottery_id,
        "$or": [{"is_enabled": True}, {"enabled": True}]
    })
    if not company_lottery:
        raise HTTPException(status_code=403, detail="Loterie non activée")
    
    # Get company
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    
    # Calculate totals
    total_amount = sum(play.amount for play in sell_data.plays)
    
    # Calculate potential win
    potential_win = 0
    for play in sell_data.plays:
        multiplier = 70
        if play.bet_type == "LOTO3": multiplier = 500
        elif play.bet_type == "LOTO4": multiplier = 5000
        elif play.bet_type == "LOTO5": multiplier = 50000
        elif play.bet_type == "MARIAGE": multiplier = 1000
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
        "agent_name": current_user.get("name") or current_user.get("full_name", ""),
        "company_id": company_id,
        "succursale_id": succursale_id,
        "lottery_id": sell_data.lottery_id,
        "lottery_name": lottery.get("lottery_name", ""),
        "draw_date": sell_data.draw_date,
        "draw_name": sell_data.draw_name,
        "plays": [{"numbers": p.numbers, "bet_type": p.bet_type, "amount": p.amount} for p in sell_data.plays],
        "total_amount": total_amount,
        "potential_win": potential_win,
        "currency": company.get("currency", "HTG") if company else "HTG",
        "status": "VALIDATED",
        "printed_count": 0,
        "device_type": "WEB",
        "created_at": now,
        "updated_at": now
    }
    
    await db.lottery_transactions.insert_one(ticket_doc)
    
    return {
        "ticket_id": ticket_id,
        "ticket_code": ticket_code,
        "verification_code": verification_code,
        "lottery_name": lottery.get("lottery_name", ""),
        "draw_date": sell_data.draw_date,
        "draw_name": sell_data.draw_name,
        "total_amount": total_amount,
        "potential_win": potential_win,
        "plays": [{"numbers": p.numbers, "bet_type": p.bet_type, "amount": p.amount} for p in sell_data.plays],
        "created_at": now
    }


@api_router.get("/results")
async def get_results_global(
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    lottery_id: Optional[str] = None,
    date: Optional[str] = None
):
    """Get lottery results for the user's company"""
    company_id = current_user.get("company_id")
    
    # Get enabled lottery IDs for this company
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
    
    results = await db.global_results.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Format winning numbers to avoid React rendering error
    for result in results:
        wn = result.get("winning_numbers")
        if isinstance(wn, dict):
            nums = []
            if wn.get("first"): nums.append(str(wn["first"]))
            if wn.get("second"): nums.append(str(wn["second"]))
            if wn.get("third"): nums.append(str(wn["third"]))
            result["winning_numbers_display"] = " - ".join(nums)
            result["winning_numbers"] = nums
        elif isinstance(wn, str):
            result["winning_numbers_display"] = wn
        else:
            result["winning_numbers_display"] = "-"
    
    return results


@api_router.get("/ticket/verify/{ticket_code}")
async def verify_ticket_by_code(ticket_code: str):
    """
    Public endpoint to verify a ticket by its code.
    No authentication required - for customer use.
    """
    ticket = await db.lottery_transactions.find_one(
        {"$or": [
            {"ticket_code": ticket_code},
            {"verification_code": ticket_code},
            {"ticket_id": ticket_code}
        ]},
        {"_id": 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé. Vérifiez le code et réessayez.")
    
    # Get result if exists
    result = None
    if ticket.get("draw_date"):
        result = await db.global_results.find_one(
            {
                "lottery_id": ticket.get("lottery_id"),
                "draw_date": ticket.get("draw_date")
            },
            {"_id": 0, "winning_numbers": 1}
        )
    
    # Format plays for display
    plays = ticket.get("plays", [])
    formatted_plays = []
    for play in plays:
        formatted_plays.append({
            "numbers": play.get("numbers"),
            "bet_type": play.get("bet_type"),
            "amount": play.get("amount")
        })
    
    # Determine display status
    status = ticket.get("status", "UNKNOWN")
    payment_status = ticket.get("payment_status", "UNPAID")
    
    display_status = status
    if status == "WINNER" and payment_status == "PAID":
        display_status = "PAYÉ"
    elif status == "WINNER":
        display_status = "GAGNANT"
    elif status == "LOSER":
        display_status = "PERDANT"
    elif status == "VALIDATED":
        display_status = "EN ATTENTE"
    elif status in ["VOID", "DELETED", "CANCELLED"]:
        display_status = "ANNULÉ"
    
    return {
        "found": True,
        "ticket_id": ticket.get("ticket_id"),
        "ticket_code": ticket.get("ticket_code"),
        "verification_code": ticket.get("verification_code"),
        "lottery_name": ticket.get("lottery_name"),
        "draw_date": ticket.get("draw_date"),
        "draw_name": ticket.get("draw_name"),
        "plays": formatted_plays,
        "total_amount": ticket.get("total_amount", 0),
        "status": status,
        "display_status": display_status,
        "is_winner": ticket.get("status") == "WINNER",
        "winnings": ticket.get("winnings", 0) or ticket.get("win_amount", 0),
        "payment_status": payment_status,
        "paid_at": ticket.get("paid_at"),
        "winning_numbers": result.get("winning_numbers") if result else None,
        "created_at": ticket.get("created_at"),
        "currency": "HTG"
    }


@api_router.post("/init/create-super-admin")
async def create_super_admin_endpoint(secret_key: str = "LOTTOLAB_INIT_2026"):
    """
    Emergency endpoint to create Super Admin if login fails.
    This is a one-time use endpoint for production deployment recovery.
    Secret key required for security.
    """
    if secret_key != "LOTTOLAB_INIT_2026":
        raise HTTPException(status_code=403, detail="Invalid secret key")
    
    from utils import generate_id, get_current_timestamp
    from auth import get_password_hash
    
    now = get_current_timestamp()
    
    # Check if jefferson@jmstudio.com already exists
    existing_jefferson = await db.users.find_one({"email": "jefferson@jmstudio.com"})
    if existing_jefferson:
        # Update password
        await db.users.update_one(
            {"email": "jefferson@jmstudio.com"},
            {"$set": {
                "password_hash": get_password_hash("JMStudio@2026!"),
                "status": "ACTIVE",
                "updated_at": now
            }}
        )
        return {"message": "Super Admin jefferson@jmstudio.com updated - password reset to JMStudio@2026!"}
    
    # Create new Super Admin
    super_admin = {
        "user_id": generate_id("user_"),
        "email": "jefferson@jmstudio.com",
        "password_hash": get_password_hash("JMStudio@2026!"),
        "name": "Jefferson Admin",
        "role": "SUPER_ADMIN",
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(super_admin)
    
    return {
        "message": "Super Admin created successfully!",
        "email": "jefferson@jmstudio.com",
        "password": "JMStudio@2026!",
        "warning": "Please change this password immediately after login!"
    }

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
set_saas_core_db(db)
set_staff_db(db)
set_ticket_print_db(db)
set_results_db(db)
set_validation_db(db)
set_branch_lottery_db(db)
set_vendeur_db(db)
set_results_db(db)
set_scheduled_results_db(db)

# Initialize staff endpoints with dependency
create_staff_endpoints(get_current_user)

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
app.include_router(succursale_router)
app.include_router(saas_core_router)
app.include_router(supervisor_router)

# Include ticket print router (PUBLIC routes for verification)
app.include_router(ticket_print_router)

# Include results router
app.include_router(results_router)

# Include scheduled results router
app.include_router(scheduled_results_router)

# Include validation router (admin only)
app.include_router(validation_router)

# Include branch lottery router (company admin)
app.include_router(branch_lottery_router)

# Include vendeur router
app.include_router(vendeur_router)

# Include export router
app.include_router(export_router)

# Include lottery results router
app.include_router(results_router)

# Include staff router under /api prefix
api_router.include_router(staff_router)

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


# CORS Configuration - Allow any origin dynamically
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

class DynamicCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        origin = request.headers.get("origin", "*")
        
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = Response(status_code=200)
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, X-Requested-With"
            response.headers["Access-Control-Max-Age"] = "86400"
            return response
        
        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, X-Requested-With"
        return response

app.add_middleware(DynamicCORSMiddleware)

# Mount static files for company logos
UPLOAD_DIR = "/app/backend/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(f"{UPLOAD_DIR}/company-logos", exist_ok=True)
os.makedirs(f"{UPLOAD_DIR}/vendeur-photos", exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ============ SCHEDULER INITIALIZATION ============
scheduler = AsyncIOScheduler()


async def initialize_super_admin_if_empty():
    """
    Create default Super Admin and seed lotteries if database is empty.
    This is essential for production deployment with empty MongoDB Atlas.
    """
    try:
        # Check if any users exist
        user_count = await db.users.count_documents({})
        if user_count > 0:
            logger.info(f"[INIT] Database has {user_count} users - skipping initialization")
            return
        
        logger.info("[INIT] Empty database detected - Starting initialization...")
        
        # Create default super admin
        from utils import generate_id, get_current_timestamp
        from auth import get_password_hash
        import json
        
        now = get_current_timestamp()
        
        # Create primary Super Admin (jefferson@jmstudio.com)
        super_admin_1 = {
            "user_id": generate_id("user_"),
            "email": "jefferson@jmstudio.com",
            "password_hash": get_password_hash("JMStudio@2026!"),
            "name": "Jefferson Admin",
            "role": "SUPER_ADMIN",
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        }
        
        # Create backup Super Admin (admin@lottolab.tech)
        super_admin_2 = {
            "user_id": generate_id("user_"),
            "email": "admin@lottolab.tech",
            "password_hash": get_password_hash("LottoLab@2026!"),
            "name": "Super Administrateur",
            "role": "SUPER_ADMIN",
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        }
        
        await db.users.insert_many([super_admin_1, super_admin_2])
        logger.info(f"[INIT] ✅ Super Admins created successfully!")
        logger.info(f"[INIT] Primary: jefferson@jmstudio.com / JMStudio@2026!")
        logger.info(f"[INIT] Backup: admin@lottolab.tech / LottoLab@2026!")
        logger.info(f"[INIT] ⚠️  IMPORTANT: Change passwords after first login!")
        
        # Create default system settings if not exist
        settings_exist = await db.system_settings.count_documents({})
        if settings_exist == 0:
            default_settings = {
                "settings_id": generate_id("settings_"),
                "system_name": "LOTTOLAB",
                "system_logo_url": "/assets/logos/lottolab-logo.png",
                "default_currency": "HTG",
                "default_language": "fr",
                "support_email": "support@lottolab.tech",
                "created_at": now,
                "updated_at": now
            }
            await db.system_settings.insert_one(default_settings)
            logger.info("[INIT] ✅ Default system settings created")
        
        # Seed all 234 lotteries
        lottery_count = await db.master_lotteries.count_documents({})
        if lottery_count == 0:
            logger.info("[INIT] Seeding master lotteries...")
            try:
                seed_file = Path(__file__).parent / "seed_lotteries.json"
                if seed_file.exists():
                    with open(seed_file, 'r') as f:
                        lotteries = json.load(f)
                    
                    if lotteries:
                        # Update timestamps for fresh insert
                        for lottery in lotteries:
                            lottery["created_at"] = now
                            lottery["updated_at"] = now
                        
                        await db.master_lotteries.insert_many(lotteries)
                        logger.info(f"[INIT] ✅ {len(lotteries)} lotteries seeded successfully!")
                else:
                    logger.warning("[INIT] ⚠️ seed_lotteries.json not found - skipping lottery seed")
            except Exception as e:
                logger.error(f"[INIT] Error seeding lotteries: {str(e)}")
        else:
            logger.info(f"[INIT] Database already has {lottery_count} lotteries")
            
    except Exception as e:
        logger.error(f"[INIT] Error during initialization: {str(e)}")


@app.on_event("startup")
async def startup_event():
    """Initialize scheduler on startup"""
    # Initialize Super Admin if database is empty (for production deployment)
    await initialize_super_admin_if_empty()
    
    # Set database for scheduler
    set_scheduler_db(db)
    
    # Initialize lottery schedules for Plop Plop and Loto Rapid
    await initialize_lottery_schedules()
    
    # Initialize Haiti lotteries (idempotent - safe to run multiple times)
    try:
        from haiti_lottery_init import initialize_haiti_lotteries
        result = await initialize_haiti_lotteries(db)
        logger.info(f"[STARTUP] Haiti lotteries initialized: Created {result['created']}, Updated {result['updated']}")
    except Exception as e:
        logger.warning(f"[STARTUP] Haiti lottery init skipped: {str(e)}")
    
    # Add daily job to check expired subscriptions at 00:00
    scheduler.add_job(
        check_expired_subscriptions,
        CronTrigger(hour=0, minute=0),
        id="check_expired_subscriptions",
        name="Daily Subscription Expiration Check",
        replace_existing=True
    )
    
    # Add job to check expiring soon (runs at 06:00 for notifications)
    scheduler.add_job(
        check_expiring_soon,
        CronTrigger(hour=6, minute=0),
        id="check_expiring_soon",
        name="Check Expiring Subscriptions",
        replace_existing=True
    )
    
    # Add job to check and release scheduled results every minute
    scheduler.add_job(
        check_and_release_scheduled_results,
        CronTrigger(minute="*"),  # Every minute
        id="check_scheduled_results",
        name="Check Scheduled Results",
        replace_existing=True
    )
    
    # Start the scheduler
    scheduler.start()
    logger.info("[SCHEDULER] Started - Daily subscription check at 00:00, Results check every minute")
    
    # Run initial check at startup
    asyncio.create_task(check_expired_subscriptions())


@app.on_event("shutdown")
async def shutdown_db_client():
    # Shutdown scheduler
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[SCHEDULER] Stopped")
    client.close()


# ============ MANUAL CRON TRIGGER (Super Admin Only) ============
@api_router.post("/admin/trigger-subscription-check")
async def trigger_subscription_check(current_user: dict = Depends(get_current_user)):
    """Manually trigger subscription check (Super Admin only)"""
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await check_expired_subscriptions()
    await check_expiring_soon()
    
    return {"message": "Vérification des abonnements terminée", "timestamp": get_current_timestamp()}


# ============ SUPERVISOR ROUTES ============
@api_router.get("/supervisor/agents")
async def get_supervisor_agents(current_user: dict = Depends(get_current_user)):
    """Get agents managed by this supervisor"""
    if current_user.get("role") not in [UserRole.BRANCH_SUPERVISOR, "BRANCH_SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Access denied - Supervisor only")
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    # Get agents in the same succursale or created by this supervisor
    query = {
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    }
    
    agents = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(100)
    
    # Get sales for today
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for agent in agents:
        tickets_today = await db.tickets.count_documents({
            "agent_id": agent.get("user_id"),
            "created_at": {"$regex": f"^{today}"}
        })
        agent["tickets_today"] = tickets_today
        agent["sales_today"] = 0  # TODO: Calculate actual sales
    
    return agents


@api_router.get("/supervisor/dashboard-stats")
async def get_supervisor_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard stats for supervisor"""
    if current_user.get("role") not in [UserRole.BRANCH_SUPERVISOR, "BRANCH_SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Access denied - Supervisor only")
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    # Count agents
    query = {
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
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


@api_router.put("/supervisor/agents/{agent_id}/suspend")
async def supervisor_suspend_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Suspend an agent (Supervisor only)"""
    if current_user.get("role") not in [UserRole.BRANCH_SUPERVISOR, "BRANCH_SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Access denied - Supervisor only")
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    # Verify agent belongs to supervisor
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


@api_router.put("/supervisor/agents/{agent_id}/activate")
async def supervisor_activate_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Activate an agent (Supervisor only)"""
    if current_user.get("role") not in [UserRole.BRANCH_SUPERVISOR, "BRANCH_SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Access denied - Supervisor only")
    
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


@api_router.delete("/supervisor/agents/{agent_id}")
async def supervisor_delete_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an agent (Supervisor only)"""
    if current_user.get("role") not in [UserRole.BRANCH_SUPERVISOR, "BRANCH_SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Access denied - Supervisor only")
    
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
        raise HTTPException(status_code=400, detail=f"Impossible de supprimer: {active_tickets} tickets actifs")
    
    # Soft delete
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": {"status": "DELETED", "deleted_at": get_current_timestamp()}}
    )
    
    return {"message": "Agent supprimé avec succès"}


@api_router.put("/supervisor/agents/{agent_id}")
async def supervisor_update_agent(agent_id: str, update_data: dict, current_user: dict = Depends(get_current_user)):
    """Update agent info (Supervisor only)"""
    if current_user.get("role") not in [UserRole.BRANCH_SUPERVISOR, "BRANCH_SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Access denied - Supervisor only")
    
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
    
    # Only allow certain fields to be updated
    allowed_fields = {"name", "telephone", "commission_percent"}
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    update_fields["updated_at"] = get_current_timestamp()
    
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": update_fields}
    )
    
    return {"message": "Agent mis à jour avec succès"}


@api_router.get("/supervisor/agents/{agent_id}/tickets")
async def supervisor_get_agent_tickets(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Get tickets for a specific agent (Supervisor only)"""
    if current_user.get("role") not in [UserRole.BRANCH_SUPERVISOR, "BRANCH_SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Access denied - Supervisor only")
    
    company_id = current_user.get("company_id")
    
    # Get recent tickets (last 50)
    tickets = await db.tickets.find(
        {"agent_id": agent_id, "company_id": company_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return tickets

