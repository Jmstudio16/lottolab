"""
Universal Lottery Terminal System
Supports: Hardware POS (IMEI), Computer, Phone, Tablet, Browser
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, EmailStr
from enum import Enum
import uuid
import qrcode
import io
import base64

from models import UserRole, TicketStatus
from auth import verify_password, create_access_token, decode_token, get_password_hash
from utils import generate_id, generate_ticket_code, generate_verification_code, get_current_timestamp

universal_pos_router = APIRouter(prefix="/api", tags=["Universal POS"])
security = HTTPBearer()

db: AsyncIOMotorDatabase = None

def set_universal_pos_db(database: AsyncIOMotorDatabase):
    global db
    db = database


# ============ ENUMS ============
class DeviceType(str, Enum):
    POS = "POS"
    COMPUTER = "COMPUTER"
    PHONE = "PHONE"
    TABLET = "TABLET"
    BROWSER = "BROWSER"

class DeviceSessionStatus(str, Enum):
    ACTIVE = "active"
    BLOCKED = "blocked"

class AgentLoginPermission(str, Enum):
    ANY_DEVICE = "ANY_DEVICE"
    POS_ONLY = "POS_ONLY"


# ============ REQUEST/RESPONSE MODELS ============
class AgentLoginRequest(BaseModel):
    email: EmailStr
    password: str

class AgentLoginResponse(BaseModel):
    token: str
    agent_id: str
    agent_name: str
    company_id: str
    company_name: str
    device_session_id: str
    device_type: str
    is_hardware_pos: bool

class DeviceSessionResponse(BaseModel):
    session_id: str
    agent_id: str
    agent_name: str
    company_id: str
    device_type: str
    device_name: str
    device_identifier: str
    ip_address: str
    status: str
    created_at: str
    last_seen_at: str

class LotterySaleRequest(BaseModel):
    lottery_id: str
    draw_date: str
    draw_name: str
    draw_time: Optional[str] = None  # Draw time e.g. "10:15"
    plays: List[dict]  # [{"numbers": "123", "bet_type": "BORLETTE", "amount": 100}]

class LotterySaleResponse(BaseModel):
    ticket_id: str
    ticket_code: str
    verification_code: str
    lottery_name: str
    draw_date: str
    draw_name: str
    draw_time: Optional[str] = None
    plays: List[dict]
    total_amount: float
    potential_win: Optional[float] = None  # Made optional - not shown on ticket
    currency: str
    agent_name: str
    company_name: str
    device_type: str
    created_at: str
    qr_code: str

class TicketCancelRequest(BaseModel):
    ticket_id: str
    reason: str

class POSDeviceRegisterRequest(BaseModel):
    imei: str
    device_name: str
    branch_id: Optional[str] = None
    location: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    notes: Optional[str] = None


# ============ HELPER FUNCTIONS ============
def detect_device_type(user_agent: str, imei: Optional[str]) -> DeviceType:
    """Detect device type from user agent or IMEI"""
    if imei:
        return DeviceType.POS
    
    user_agent_lower = user_agent.lower() if user_agent else ""
    
    if "mobile" in user_agent_lower or "android" in user_agent_lower or "iphone" in user_agent_lower:
        if "tablet" in user_agent_lower or "ipad" in user_agent_lower:
            return DeviceType.TABLET
        return DeviceType.PHONE
    
    return DeviceType.BROWSER

def generate_device_fingerprint(request: Request, user_agent: str) -> str:
    """Generate a fingerprint for non-POS devices"""
    client_ip = request.client.host if request.client else "unknown"
    return f"{client_ip}_{user_agent[:50] if user_agent else 'unknown'}"

def generate_qr_code_base64(data: str) -> str:
    """Generate QR code as base64 string"""
    qr = qrcode.QRCode(version=1, box_size=4, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()


# ============ AUTH DEPENDENCY ============
async def get_current_agent(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_device_imei: Optional[str] = Header(None)
) -> dict:
    """Get current agent and validate device session"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Agent non trouvé")
    
    if user.get("role") != UserRole.AGENT_POS:
        raise HTTPException(status_code=403, detail="Accès réservé aux agents")
    
    # Get device session from token
    device_session_id = payload.get("device_session_id")
    if device_session_id:
        session = await db.device_sessions.find_one(
            {"session_id": device_session_id, "status": "active"},
            {"_id": 0}
        )
        if not session:
            raise HTTPException(status_code=401, detail="Session d'appareil invalide ou bloquée")
        
        # Update last_seen
        await db.device_sessions.update_one(
            {"session_id": device_session_id},
            {"$set": {"last_seen_at": get_current_timestamp()}}
        )
        
        user["device_session"] = session
    
    return user


# ============ AUTHENTICATION ENDPOINTS ============
@universal_pos_router.post("/auth/agent/login", response_model=AgentLoginResponse)
async def agent_login(
    credentials: AgentLoginRequest,
    request: Request,
    x_device_imei: Optional[str] = Header(None),
    user_agent: Optional[str] = Header(None)
):
    """
    Universal agent login endpoint.
    - With X-Device-IMEI header: Hardware POS authentication
    - Without IMEI: Universal device authentication (computer, phone, tablet, browser)
    """
    # Find user
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc or not verify_password(credentials.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email ou mot de passe invalide")
    
    if user_doc.get("role") != UserRole.AGENT_POS:
        raise HTTPException(status_code=403, detail="Ce compte n'est pas un compte agent")
    
    if user_doc.get("status") != "ACTIVE":
        raise HTTPException(status_code=403, detail="Ce compte est suspendu")
    
    company_id = user_doc.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Aucune entreprise associée")
    
    # Get company info
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    if company.get("status") != "ACTIVE":
        raise HTTPException(status_code=403, detail="L'entreprise est suspendue")
    
    # Check agent login permissions
    agent_config = await db.agent_permissions.find_one(
        {"agent_id": user_doc["user_id"]},
        {"_id": 0}
    )
    
    is_hardware_pos = bool(x_device_imei)
    device_type = detect_device_type(user_agent, x_device_imei)
    
    # If agent is restricted to POS only
    if agent_config and agent_config.get("login_permission") == AgentLoginPermission.POS_ONLY:
        if not is_hardware_pos:
            raise HTTPException(
                status_code=403, 
                detail="Cet agent ne peut se connecter que depuis un terminal POS"
            )
    
    # Handle Hardware POS authentication
    pos_device_id = None
    if is_hardware_pos:
        pos_device = await db.pos_devices.find_one(
            {"imei": x_device_imei, "company_id": company_id},
            {"_id": 0}
        )
        
        if not pos_device:
            raise HTTPException(
                status_code=404, 
                detail="Appareil POS non enregistré. Contactez votre administrateur."
            )
        
        if pos_device.get("status") == "BLOCKED":
            raise HTTPException(status_code=403, detail="Cet appareil POS est bloqué")
        
        if pos_device.get("status") == "PENDING":
            # Auto-activate on first login
            await db.pos_devices.update_one(
                {"device_id": pos_device["device_id"]},
                {"$set": {
                    "status": "ACTIVE",
                    "activated_at": get_current_timestamp(),
                    "assigned_agent_id": user_doc["user_id"]
                }}
            )
        
        pos_device_id = pos_device["device_id"]
        device_identifier = x_device_imei
        device_name = pos_device.get("device_name", "POS Terminal")
    else:
        # Universal device authentication
        device_identifier = generate_device_fingerprint(request, user_agent)
        device_name = f"{device_type.value} - {user_agent[:30] if user_agent else 'Unknown'}"
    
    # Create or update device session
    client_ip = request.client.host if request.client else "unknown"
    now = get_current_timestamp()
    
    # Check if session exists for this device
    existing_session = await db.device_sessions.find_one({
        "agent_id": user_doc["user_id"],
        "device_identifier": device_identifier,
        "status": "active"
    })
    
    if existing_session:
        session_id = existing_session["session_id"]
        await db.device_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"last_seen_at": now, "ip_address": client_ip}}
        )
    else:
        session_id = generate_id("sess_")
        session_doc = {
            "session_id": session_id,
            "agent_id": user_doc["user_id"],
            "agent_name": user_doc["name"],
            "company_id": company_id,
            "device_type": device_type.value,
            "device_name": device_name,
            "device_identifier": device_identifier,
            "pos_device_id": pos_device_id,
            "ip_address": client_ip,
            "status": "active",
            "created_at": now,
            "last_seen_at": now
        }
        await db.device_sessions.insert_one(session_doc)
    
    # Update user last login
    await db.users.update_one(
        {"user_id": user_doc["user_id"]},
        {"$set": {"last_login": now}}
    )
    
    # Create token with device session
    token = create_access_token({
        "user_id": user_doc["user_id"],
        "role": user_doc["role"],
        "company_id": company_id,
        "device_session_id": session_id,
        "is_hardware_pos": is_hardware_pos
    })
    
    return AgentLoginResponse(
        token=token,
        agent_id=user_doc["user_id"],
        agent_name=user_doc["name"],
        company_id=company_id,
        company_name=company["name"],
        device_session_id=session_id,
        device_type=device_type.value,
        is_hardware_pos=is_hardware_pos
    )


# ============ CONFIGURATION & SYNC ENDPOINTS ============
# MOVED TO sync_routes.py for enhanced real-time sync with config versioning


# ============ LOTTERY SALES ENDPOINT ============
@universal_pos_router.post("/lottery/sell", response_model=LotterySaleResponse)
async def sell_lottery_ticket(
    sale_data: LotterySaleRequest,
    request: Request,
    current_agent: dict = Depends(get_current_agent)
):
    """Universal lottery sales endpoint - works from any device"""
    company_id = current_agent.get("company_id")
    agent_id = current_agent.get("user_id")
    device_session = current_agent.get("device_session", {})
    
    # Get lottery info - check master_lotteries first, then global_lotteries
    lottery = await db.master_lotteries.find_one(
        {"lottery_id": sale_data.lottery_id, "is_active_global": True},
        {"_id": 0}
    )
    if not lottery:
        lottery = await db.global_lotteries.find_one(
            {"lottery_id": sale_data.lottery_id, "is_active": True},
            {"_id": 0}
        )
    if not lottery:
        raise HTTPException(status_code=404, detail="Loterie non trouvée ou inactive")
    
    # Check if lottery is enabled for company (check all possible field names)
    company_lottery = await db.company_lotteries.find_one({
        "company_id": company_id,
        "lottery_id": sale_data.lottery_id,
        "$or": [
            {"enabled": True},
            {"is_enabled": True},
            {"is_enabled_for_company": True}
        ]
    })
    if not company_lottery:
        raise HTTPException(status_code=403, detail="Cette loterie n'est pas activée pour votre entreprise")
    
    # Get company config
    config = await db.company_configurations.find_one({"company_id": company_id}, {"_id": 0})
    # NO minimum - Maximum 100000 HTG
    max_bet = 100000
    
    # Get company info for timezone
    company_info = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    
    # Get company-specific bet limits
    company_settings = await db.company_settings.find_one({"company_id": company_id}, {"_id": 0})
    loto4_max_limit = 100000.0
    loto5_max_limit = 100000.0
    
    if company_settings:
        loto4_max_limit = company_settings.get("loto4_max_limit", 100000.0)
        loto5_max_limit = company_settings.get("loto5_max_limit", 100000.0)
    
    # Validate plays
    total_amount = 0.0
    validated_plays = []
    
    for play in sale_data.plays:
        amount = float(play.get("amount", 0))
        bet_type = play.get("bet_type", "BORLETTE")
        
        # Only check positive amount - NO minimum limit
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Montant invalide")
        if amount > max_bet:
            raise HTTPException(status_code=400, detail=f"Mise maximum: {max_bet} HTG")
        
        # Validate Loto4 max limit
        if bet_type in ["LOTO4", "LOTO4_OPT1", "LOTO4_OPT2", "LOTO4_OPT3"]:
            if amount > loto4_max_limit:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Montant maximum pour Loto 4: {loto4_max_limit} HTG"
                )
        
        # Validate Loto5 max limit
        if bet_type in ["LOTO5", "LOTO5_EXTRA1", "LOTO5_EXTRA2"]:
            if amount > loto5_max_limit:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Montant maximum pour Loto 5: {loto5_max_limit} HTG"
                )
        
        validated_plays.append({
            "numbers": play.get("numbers"),
            "bet_type": bet_type,
            "amount": amount
        })
        total_amount += amount
    
    # Check schedule and cutoff time
    schedule = await db.global_schedules.find_one({
        "lottery_id": sale_data.lottery_id,
        "draw_name": sale_data.draw_name,
        "is_active": True
    }, {"_id": 0})
    
    if schedule:
        stop_minutes = config.get("stop_sales_before_draw_minutes", 5) if config else 5
        closing_time_str = schedule.get("close_time") or schedule.get("closing_time") or schedule.get("draw_time", "00:00")
        opening_time_str = schedule.get("open_time") or schedule.get("opening_time", "06:00")
        
        # Parse times
        close_hour, close_minute = map(int, closing_time_str.split(":"))
        open_hour, open_minute = map(int, opening_time_str.split(":"))
        
        # Get company timezone (default to Haiti)
        company_tz_str = company_info.get("timezone", "America/Port-au-Prince") if company_info else "America/Port-au-Prince"
        try:
            import pytz
            company_tz = pytz.timezone(company_tz_str)
            now = datetime.now(company_tz)
        except Exception:
            # Fallback to Haiti time (UTC-5)
            now = datetime.now(timezone.utc) - timedelta(hours=5)
        
        current_time_minutes = now.hour * 60 + now.minute
        close_time_minutes = close_hour * 60 + close_minute
        open_time_minutes = open_hour * 60 + open_minute
        
        # Handle overnight schedules (e.g., open 22:00, close 02:00)
        if open_time_minutes > close_time_minutes:
            # Overnight schedule - open if after open time OR before close time
            is_open = current_time_minutes >= open_time_minutes or current_time_minutes < close_time_minutes
        else:
            # Normal schedule - open if between open and close
            is_open = open_time_minutes <= current_time_minutes < close_time_minutes
        
        if not is_open:
            if current_time_minutes < open_time_minutes:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Cette loterie n'est pas encore ouverte. Ouverture à {opening_time_str}"
                )
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"LOTERIE FERMÉE. Fermeture à {closing_time_str}"
                )
        
        # Check draw time cutoff - only if draw time is today
        draw_time_str = schedule.get("draw_time", "00:00")
        draw_hour, draw_minute = map(int, draw_time_str.split(":"))
        draw_time_minutes = draw_hour * 60 + draw_minute
        
        # Only apply draw cutoff if draw time is after current time today
        # This prevents blocking sales after midnight for next day's draw
        if draw_time_minutes > current_time_minutes:
            cutoff_minutes = draw_time_minutes - stop_minutes
            if current_time_minutes >= cutoff_minutes:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Les ventes sont fermées. Tirage à {draw_time_str}"
                )
    
    # Get company and agent info
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    
    # PHASE 3: Validate betting limits before creating ticket
    from limits_routes import validate_bet_limits
    limit_check = await validate_bet_limits(
        lottery_id=sale_data.lottery_id,
        draw_name=sale_data.draw_name,
        draw_date=sale_data.draw_date,
        plays=validated_plays
    )
    
    if not limit_check["allowed"]:
        # Build error message
        errors = []
        for blocked in limit_check.get("blocked_plays", []):
            errors.append(blocked.get("reason", f"Numéro {blocked.get('number')} bloqué"))
        for exceeded in limit_check.get("exceeded_plays", []):
            errors.append(exceeded.get("reason", f"Limite dépassée pour {exceeded.get('number')}"))
        
        raise HTTPException(
            status_code=400, 
            detail=f"Mise refusée: {'; '.join(errors)}"
        )
    
    # PHASE 4: Validate bet type limits (min/max per game type) - Company Admin configuration
    from bet_type_limits_routes import validate_bet_type_limits
    bet_type_limit_check = await validate_bet_type_limits(
        company_id=company_id,
        plays=validated_plays
    )
    
    if not bet_type_limit_check["allowed"]:
        errors = [e.get("error") for e in bet_type_limit_check.get("errors", [])]
        raise HTTPException(
            status_code=400,
            detail=f"Mise refusée: {'; '.join(errors)}"
        )
    
    # Check agent balance (credit limit)
    agent_balance = await db.agent_balances.find_one({"agent_id": agent_id}, {"_id": 0})
    
    if not agent_balance:
        # Create initial balance for agent
        policy = await db.agent_policies.find_one({"agent_id": agent_id}, {"_id": 0})
        credit_limit = policy.get("max_credit_limit", 50000.0) if policy else 50000.0
        
        agent_balance = {
            "balance_id": generate_id("bal_"),
            "agent_id": agent_id,
            "company_id": company_id,
            "credit_limit": credit_limit,
            "current_balance": 0.0,
            "available_balance": credit_limit,
            "total_sales": 0.0,
            "total_payouts": 0.0,
            "total_winnings": 0.0,
            "created_at": get_current_timestamp(),
            "updated_at": get_current_timestamp()
        }
        await db.agent_balances.insert_one(agent_balance)
    
    available_balance = agent_balance.get("available_balance", 0)
    
    # Check if agent has enough credit
    if total_amount > available_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Crédit insuffisant. Disponible: {available_balance:.2f}, Requis: {total_amount:.2f}"
        )
    
    # Calculate potential win
    prime_configs = await db.prime_configs.find(
        {"company_id": company_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    potential_win = 0.0
    prime_map = {p["bet_type"]: p for p in prime_configs}
    
    # Default payouts if no prime configs defined
    DEFAULT_PAYOUTS = {
        "BORLETTE": 50,
        "LOTO3": 500,
        "LOTO4": 5000,
        "LOTO5": 50000,
        "MARIAGE": 1000
    }
    
    for play in validated_plays:
        bet_type = play["bet_type"]
        if bet_type in prime_map:
            formula = prime_map[bet_type].get("payout_formula", "50")
            first_payout = float(formula.split("|")[0]) if "|" in formula else float(formula)
            potential_win += play["amount"] * first_payout
        else:
            # Use default payout
            default_payout = DEFAULT_PAYOUTS.get(bet_type, 50)
            potential_win += play["amount"] * default_payout
    
    # Generate ticket
    from security_system import (
        check_duplicate_ticket, generate_ticket_signature,
        get_unique_ticket_code, get_unique_verification_code,
        create_audit_log, AuditAction, check_suspicious_activity
    )
    
    now = get_current_timestamp()
    ticket_id = generate_id("tkt_")
    
    # Anti-duplicate check
    duplicate_check = await check_duplicate_ticket(
        db=db,
        lottery_id=sale_data.lottery_id,
        draw_name=sale_data.draw_name,
        plays=validated_plays,
        agent_id=agent_id,
        company_id=company_id
    )
    
    if duplicate_check["is_duplicate"]:
        # Log duplicate attempt
        await create_audit_log(
            db=db,
            action=AuditAction.DUPLICATE_ATTEMPT,
            user_id=agent_id,
            request=request,
            details={
                "existing_ticket_code": duplicate_check.get("existing_ticket_code"),
                "lottery_id": sale_data.lottery_id,
                "draw_name": sale_data.draw_name
            },
            entity_type="ticket",
            entity_id=duplicate_check.get("existing_ticket_id"),
            severity="WARNING",
            company_id=company_id
        )
        
        raise HTTPException(
            status_code=400,
            detail=f"Ticket similaire créé récemment: {duplicate_check.get('existing_ticket_code')}. Attendez ou modifiez les numéros."
        )
    
    # Generate unique codes
    ticket_code = await get_unique_ticket_code(db, "TK")
    verification_code = await get_unique_verification_code(db)
    
    qr_payload = f"{ticket_code}|{verification_code}|{company_id}"
    qr_code = generate_qr_code_base64(qr_payload)
    
    # Generate cryptographic signature
    ticket_signature = generate_ticket_signature(
        ticket_id=ticket_id,
        ticket_code=ticket_code,
        verification_code=verification_code,
        total_amount=total_amount,
        created_at=now
    )
    
    # Check for suspicious activity
    alerts = await check_suspicious_activity(db, agent_id, company_id, AuditAction.TICKET_CREATE)
    if alerts:
        for alert in alerts:
            # Create fraud alert
            await db.fraud_alerts.insert_one({
                "alert_id": generate_id("fraud_"),
                "alert_type": alert["type"],
                "description": alert["message"],
                "entity_type": "agent",
                "entity_id": agent_id,
                "severity": alert["severity"],
                "status": "OPEN",
                "created_by": "SYSTEM",
                "company_id": company_id,
                "created_at": now
            })
    
    # Create transaction record
    transaction = {
        "transaction_id": generate_id("txn_"),
        "ticket_id": ticket_id,
        "ticket_code": ticket_code,
        "verification_code": verification_code,
        "ticket_hash": duplicate_check.get("ticket_hash"),
        "ticket_signature": ticket_signature,
        "qr_payload": qr_payload,
        "agent_id": agent_id,
        "agent_name": current_agent["name"],
        "company_id": company_id,
        "company_name": company["name"],
        "device_session_id": device_session.get("session_id"),
        "pos_device_id": device_session.get("pos_device_id"),
        "device_type": device_session.get("device_type", "BROWSER"),
        "lottery_id": sale_data.lottery_id,
        "lottery_name": lottery["lottery_name"],
        "draw_date": sale_data.draw_date,
        "draw_name": sale_data.draw_name,
        "draw_time": sale_data.draw_time or "",
        "plays": validated_plays,
        "total_amount": total_amount,
        "potential_win": potential_win,
        "currency": company.get("currency", "HTG"),
        "status": "VALIDATED",
        "created_at": now,
        "client_ip": request.client.host if request.client else None
    }
    
    await db.lottery_transactions.insert_one(transaction)
    
    # Create security audit log
    await create_audit_log(
        db=db,
        action=AuditAction.TICKET_CREATE,
        user_id=agent_id,
        request=request,
        details={
            "ticket_code": ticket_code,
            "total_amount": total_amount,
            "lottery_name": lottery["lottery_name"],
            "draw_name": sale_data.draw_name,
            "plays_count": len(validated_plays)
        },
        entity_type="ticket",
        entity_id=ticket_id,
        severity="INFO",
        company_id=company_id
    )
    
    # Update agent balance after successful sale
    new_current_balance = agent_balance.get("current_balance", 0) + total_amount
    new_available_balance = agent_balance.get("available_balance", 0) - total_amount
    new_total_sales = agent_balance.get("total_sales", 0) + total_amount
    
    await db.agent_balances.update_one(
        {"agent_id": agent_id},
        {"$set": {
            "current_balance": new_current_balance,
            "available_balance": new_available_balance,
            "total_sales": new_total_sales,
            "updated_at": now
        }}
    )
    
    # Log sale activity
    await db.activity_logs.insert_one({
        "log_id": generate_id("log_"),
        "action_type": "TICKET_SOLD",
        "entity_type": "ticket",
        "entity_id": ticket_id,
        "performed_by": agent_id,
        "company_id": company_id,
        "metadata": {
            "ticket_code": ticket_code,
            "total_amount": total_amount,
            "lottery_name": lottery["lottery_name"],
            "draw_name": sale_data.draw_name,
            "device_type": device_session.get("device_type", "BROWSER"),
            "plays_count": len(validated_plays)
        },
        "created_at": now
    })
    
    return LotterySaleResponse(
        ticket_id=ticket_id,
        ticket_code=ticket_code,
        verification_code=verification_code,
        lottery_name=lottery["lottery_name"],
        draw_date=sale_data.draw_date,
        draw_name=sale_data.draw_name,
        draw_time=sale_data.draw_time,
        plays=validated_plays,
        total_amount=total_amount,
        potential_win=None,  # Don't return potential_win on ticket
        currency=company.get("currency", "HTG"),
        agent_name=current_agent["name"],
        company_name=company["name"],
        device_type=device_session.get("device_type", "BROWSER"),
        created_at=now,
        qr_code=qr_code
    )


# ============ TICKET CANCEL ENDPOINT ============
@universal_pos_router.post("/lottery/cancel")
async def cancel_ticket(
    cancel_data: TicketCancelRequest,
    current_agent: dict = Depends(get_current_agent)
):
    """Cancel a ticket within the void window"""
    agent_id = current_agent.get("user_id")
    company_id = current_agent.get("company_id")
    
    # Find the ticket
    ticket = await db.lottery_transactions.find_one({
        "ticket_id": cancel_data.ticket_id,
        "agent_id": agent_id,
        "company_id": company_id
    }, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    if ticket["status"] != TicketStatus.PENDING_RESULT.value:
        raise HTTPException(status_code=400, detail="Ce ticket ne peut pas être annulé")
    
    # Check void window
    config = await db.company_configurations.find_one({"company_id": company_id}, {"_id": 0})
    void_minutes = config.get("void_window_minutes", 5) if config else 5
    allow_void = config.get("allow_ticket_void", True) if config else True
    
    if not allow_void:
        raise HTTPException(status_code=403, detail="L'annulation de tickets n'est pas autorisée")
    
    created_at = datetime.fromisoformat(ticket["created_at"].replace("Z", "+00:00"))
    void_deadline = created_at + timedelta(minutes=void_minutes)
    
    if datetime.now(timezone.utc) > void_deadline:
        raise HTTPException(
            status_code=400, 
            detail=f"Délai d'annulation dépassé ({void_minutes} minutes)"
        )
    
    # Cancel the ticket
    await db.lottery_transactions.update_one(
        {"ticket_id": cancel_data.ticket_id},
        {"$set": {
            "status": TicketStatus.VOID.value,
            "void_reason": cancel_data.reason,
            "voided_at": get_current_timestamp(),
            "voided_by": agent_id
        }}
    )
    
    return {"message": "Ticket annulé avec succès", "ticket_id": cancel_data.ticket_id}


# ============ AGENT TICKETS ENDPOINT ============
@universal_pos_router.get("/agent/tickets")
async def get_agent_tickets(
    current_agent: dict = Depends(get_current_agent),
    date: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100
):
    """Get agent's tickets with filters"""
    agent_id = current_agent.get("user_id")
    
    query = {"agent_id": agent_id}
    
    if date:
        query["draw_date"] = date
    
    if status:
        query["status"] = status
    
    tickets = await db.lottery_transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return tickets


# ============ RESULTS ENDPOINT ============
@universal_pos_router.get("/results/latest")
async def get_latest_results(
    current_agent: dict = Depends(get_current_agent),
    date: Optional[str] = None
):
    """Get latest lottery results"""
    company_id = current_agent.get("company_id")
    
    # Get enabled lotteries for company
    enabled_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "enabled": True},
        {"_id": 0}
    ).to_list(100)
    
    lottery_ids = [l["lottery_id"] for l in enabled_lotteries]
    
    query = {"lottery_id": {"$in": lottery_ids}}
    if date:
        query["draw_date"] = date
    else:
        # Default to today
        query["draw_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    results = await db.global_results.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return results


# ============ REPORTS ENDPOINT ============
@universal_pos_router.get("/agent/reports")
async def get_agent_reports(
    current_agent: dict = Depends(get_current_agent),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get agent's sales reports"""
    agent_id = current_agent.get("user_id")
    
    # Default to today if no dates provided
    if not start_date:
        start_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not end_date:
        end_date = start_date
    
    # Build date range query
    start_dt = f"{start_date}T00:00:00Z"
    end_dt = f"{end_date}T23:59:59Z"
    
    pipeline = [
        {"$match": {
            "agent_id": agent_id,
            "created_at": {"$gte": start_dt, "$lte": end_dt}
        }},
        {"$group": {
            "_id": {
                "date": {"$substr": ["$created_at", 0, 10]},
                "lottery_id": "$lottery_id",
                "lottery_name": "$lottery_name"
            },
            "tickets_count": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"},
            "voided_count": {"$sum": {"$cond": [{"$eq": ["$status", "VOID"]}, 1, 0]}},
            "winners_count": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, 1, 0]}},
            "total_wins": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, "$win_amount", 0]}}
        }},
        {"$sort": {"_id.date": -1, "_id.lottery_name": 1}}
    ]
    
    report_data = await db.lottery_transactions.aggregate(pipeline).to_list(100)
    
    # Calculate totals
    totals = {
        "tickets_count": sum(r.get("tickets_count", 0) for r in report_data),
        "total_sales": sum(r.get("total_sales", 0.0) for r in report_data),
        "voided_count": sum(r.get("voided_count", 0) for r in report_data),
        "winners_count": sum(r.get("winners_count", 0) for r in report_data),
        "total_wins": sum(r.get("total_wins", 0.0) for r in report_data)
    }
    totals["net_revenue"] = totals["total_sales"] - totals["total_wins"]
    
    return {
        "period": {"start": start_date, "end": end_date},
        "details": report_data,
        "totals": totals
    }


# ============ TICKET PRINT ENDPOINT ============
# MOVED TO sync_routes.py for enhanced printing with company logo support


# ============ DEVICE SESSION MANAGEMENT (COMPANY ADMIN) ============
@universal_pos_router.get("/admin/device-sessions")
async def get_device_sessions(
    current_user: dict = Depends(get_current_agent),
    status: Optional[str] = None
):
    """Get all device sessions for company (Company Admin only)"""
    # This endpoint is actually for company admin, but reusing agent dependency
    # In production, use proper company admin dependency
    company_id = current_user.get("company_id")
    
    query = {"company_id": company_id}
    if status:
        query["status"] = status
    
    sessions = await db.device_sessions.find(
        query, {"_id": 0}
    ).sort("last_seen_at", -1).to_list(500)
    
    return sessions


@universal_pos_router.put("/admin/device-sessions/{session_id}/block")
async def block_device_session(
    session_id: str,
    current_user: dict = Depends(get_current_agent)
):
    """Block a device session"""
    company_id = current_user.get("company_id")
    
    result = await db.device_sessions.update_one(
        {"session_id": session_id, "company_id": company_id},
        {"$set": {"status": "blocked", "blocked_at": get_current_timestamp()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    return {"message": "Session bloquée"}


@universal_pos_router.put("/admin/device-sessions/{session_id}/unblock")
async def unblock_device_session(
    session_id: str,
    current_user: dict = Depends(get_current_agent)
):
    """Unblock a device session"""
    company_id = current_user.get("company_id")
    
    result = await db.device_sessions.update_one(
        {"session_id": session_id, "company_id": company_id},
        {"$set": {"status": "active"}, "$unset": {"blocked_at": ""}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    return {"message": "Session débloquée"}


# ============ AGENT PERMISSION MANAGEMENT ============
@universal_pos_router.put("/admin/agents/{agent_id}/device-permission")
async def set_agent_device_permission(
    agent_id: str,
    permission: str,  # ANY_DEVICE or POS_ONLY
    current_user: dict = Depends(get_current_agent)
):
    """Set agent's device login permission"""
    company_id = current_user.get("company_id")
    
    # Verify agent belongs to company
    agent = await db.users.find_one({
        "user_id": agent_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS
    })
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé")
    
    await db.agent_permissions.update_one(
        {"agent_id": agent_id},
        {"$set": {
            "agent_id": agent_id,
            "company_id": company_id,
            "login_permission": permission,
            "updated_at": get_current_timestamp()
        }},
        upsert=True
    )
    
    return {"message": f"Permission mise à jour: {permission}"}


# ============ POS DEVICE REGISTRATION (COMPANY ADMIN) ============
@universal_pos_router.post("/admin/pos-devices")
async def register_pos_device(
    device_data: POSDeviceRegisterRequest,
    current_user: dict = Depends(get_current_agent)
):
    """Register a new POS device"""
    company_id = current_user.get("company_id")
    
    # Check if IMEI already exists
    existing = await db.pos_devices.find_one({"imei": device_data.imei})
    if existing:
        raise HTTPException(status_code=400, detail="Cet IMEI est déjà enregistré")
    
    now = get_current_timestamp()
    device_id = generate_id("pos_")
    
    device_doc = {
        "device_id": device_id,
        "company_id": company_id,
        "imei": device_data.imei,
        "device_name": device_data.device_name,
        "branch_id": device_data.branch_id,
        "location": device_data.location,
        "assigned_agent_id": device_data.assigned_agent_id,
        "notes": device_data.notes,
        "status": "PENDING",
        "created_at": now,
        "updated_at": now
    }
    
    await db.pos_devices.insert_one(device_doc)
    
    return {"message": "Appareil POS enregistré", "device_id": device_id}


@universal_pos_router.get("/admin/pos-devices")
async def get_pos_devices(current_user: dict = Depends(get_current_agent)):
    """Get all POS devices for company"""
    company_id = current_user.get("company_id")
    
    devices = await db.pos_devices.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(500)
    
    return devices


@universal_pos_router.put("/admin/pos-devices/{device_id}/status")
async def update_pos_device_status(
    device_id: str,
    status: str,  # ACTIVE, BLOCKED, PENDING
    current_user: dict = Depends(get_current_agent)
):
    """Update POS device status"""
    company_id = current_user.get("company_id")
    
    result = await db.pos_devices.update_one(
        {"device_id": device_id, "company_id": company_id},
        {"$set": {"status": status, "updated_at": get_current_timestamp()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Appareil non trouvé")
    
    return {"message": f"Statut mis à jour: {status}"}
