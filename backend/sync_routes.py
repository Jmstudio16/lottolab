"""
Enhanced Real-Time Sync Routes for Agent Devices
Implements 5-second polling sync with full configuration
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import qrcode
import io
import os
import base64

from models import UserRole, TicketStatus
from auth import decode_token
from utils import generate_id, generate_ticket_code, generate_verification_code, get_current_timestamp

sync_router = APIRouter(prefix="/api", tags=["Device Sync"])
security = HTTPBearer()

db: AsyncIOMotorDatabase = None

def set_sync_db(database: AsyncIOMotorDatabase):
    global db
    db = database


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
    
    # Check agent status
    if user.get("status") != "ACTIVE":
        raise HTTPException(status_code=403, detail="Compte agent suspendu")
    
    # Get device session from token
    device_session_id = payload.get("device_session_id")
    if device_session_id:
        session = await db.device_sessions.find_one(
            {"session_id": device_session_id},
            {"_id": 0}
        )
        if session:
            if session.get("status") == "blocked":
                raise HTTPException(status_code=403, detail="Session d'appareil bloquée")
            
            # Update last_seen
            await db.device_sessions.update_one(
                {"session_id": device_session_id},
                {"$set": {"last_seen_at": get_current_timestamp()}}
            )
            
            user["device_session"] = session
    
    return user


def generate_qr_code_base64(data: str) -> str:
    """Generate QR code as base64 string"""
    qr = qrcode.QRCode(version=1, box_size=4, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()


# ============================================================================
# ENHANCED CONFIG ENDPOINT - FULL CONFIGURATION LOAD
# ============================================================================

@sync_router.get("/device/config")
async def get_full_device_config(current_agent: dict = Depends(get_current_agent)):
    """
    Get complete device configuration on startup.
    Called once when agent device starts/logs in.
    Returns ALL configuration needed for POS operation.
    """
    company_id = current_agent.get("company_id")
    agent_id = current_agent.get("user_id")
    succursale_id = current_agent.get("succursale_id")
    device_session = current_agent.get("device_session", {})
    
    # ---- 1. COMPANY INFO ----
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    # ---- 2. COMPANY CONFIGURATION ----
    config = await db.company_configurations.find_one({"company_id": company_id}, {"_id": 0})
    if not config:
        config = {
            "min_bet_amount": 0,  # Pas de limite minimum
            "max_bet_amount": 999999999,  # Pas de limite maximum pratique
            "max_bet_per_number": 999999999,
            "stop_sales_before_draw_minutes": 5,
            "allow_ticket_void": True,
            "void_window_minutes": 5,
            "auto_print_ticket": True
        }
    
    # ---- 3. POS RULES ----
    pos_rules = await db.company_pos_rules.find_one({"company_id": company_id}, {"_id": 0})
    if not pos_rules:
        pos_rules = {
            "block_numbers_enabled": True,
            "limits_enabled": True,
            "allow_void_ticket": True,
            "allow_reprint_ticket": True,
            "allow_manual_results_view": True,
            "ticket_format": "80MM_THERMAL",
            "config_version": 1
        }
    
    # ---- 4. AGENT POLICY ----
    agent_policy = await db.agent_policies.find_one({"agent_id": agent_id}, {"_id": 0})
    if not agent_policy:
        agent_policy = {
            "allowed_device_types": ["POS", "COMPUTER", "PHONE", "TABLET"],
            "must_use_imei": False,
            "max_credit_limit": 50000.0,
            "max_win_limit": 100000.0,
            "commission_percent": 0.0,
            "can_void_ticket": True,
            "can_reprint_ticket": True,
            "status": "active"
        }
    
    # ---- 5. ENABLED LOTTERIES (COMPANY CATALOG + BRANCH FILTER) ----
    # Fixed: Use correct field names for company_lotteries - check all possible field names
    company_lotteries = await db.company_lotteries.find(
        {
            "company_id": company_id, 
            "$or": [
                {"is_enabled_for_company": True},
                {"is_enabled": True},
                {"enabled": True}
            ]
        },
        {"_id": 0}
    ).to_list(300)
    
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    # ---- 5b. BRANCH-LEVEL FILTER ----
    # Get branch-level overrides (disabled lotteries for this branch)
    branch_disabled_ids = set()
    if succursale_id:
        branch_disabled = await db.branch_lotteries.find(
            {"branch_id": succursale_id, "enabled": False},
            {"lottery_id": 1}
        ).to_list(300)
        branch_disabled_ids = {bl["lottery_id"] for bl in branch_disabled}
    
    # Filter out branch-disabled lotteries
    lottery_ids = [lid for lid in lottery_ids if lid not in branch_disabled_ids]
    
    # Get full lottery details from master_lotteries
    lotteries = []
    if lottery_ids:
        # Use master_lotteries as the source of truth
        master_lotteries_data = await db.master_lotteries.find(
            {"lottery_id": {"$in": lottery_ids}, "is_active_global": True},
            {"_id": 0}
        ).to_list(300)
        
        # Also check global_lotteries for backward compatibility
        if not master_lotteries_data:
            master_lotteries_data = await db.global_lotteries.find(
                {"lottery_id": {"$in": lottery_ids}, "is_active": True},
                {"_id": 0}
            ).to_list(300)
        
        # Merge company settings with global lottery data
        cl_map = {cl["lottery_id"]: cl for cl in company_lotteries}
        for gl in master_lotteries_data:
            cl = cl_map.get(gl["lottery_id"], {})
            lotteries.append({
                **gl,
                "lottery_name": gl.get("lottery_name") or cl.get("lottery_name"),
                "state_code": gl.get("state_code") or cl.get("state_code"),
                "flag_type": cl.get("flag_type") or gl.get("flag_type") or "USA",
                "draws": gl.get("draws", []),
                "max_bet_per_ticket": cl.get("max_bet_per_ticket", config.get("max_bet_amount", 10000.0)),
                "max_bet_per_number": cl.get("max_bet_per_number", config.get("max_bet_per_number", 5000.0))
            })
    
    # ---- 6. SCHEDULES FOR TODAY ----
    today_weekday = datetime.now(timezone.utc).weekday()
    schedules = []
    schedule_map = {}  # Map lottery_id -> schedule for merging
    if lottery_ids:
        all_schedules = await db.global_schedules.find(
            {"lottery_id": {"$in": lottery_ids}, "is_active": True},
            {"_id": 0}
        ).to_list(500)
        
        # Filter for today and build map
        for sched in all_schedules:
            days = sched.get("days_of_week", [])
            if not days or today_weekday in days:
                schedules.append(sched)
                # Store schedule by lottery_id (use first schedule if multiple)
                lid = sched.get("lottery_id")
                if lid and lid not in schedule_map:
                    schedule_map[lid] = sched
    
    # ---- 6b. MERGE SCHEDULES INTO LOTTERIES ----
    # Add open_time, close_time, draw_time to each lottery from its schedule
    # Also calculate is_open based on current time in company timezone
    import pytz
    company_tz_str = company.get("timezone", "America/Port-au-Prince")
    try:
        company_tz = pytz.timezone(company_tz_str)
    except:
        company_tz = pytz.timezone("America/Port-au-Prince")
    
    now_local = datetime.now(company_tz)
    current_time_str = now_local.strftime("%H:%M")
    
    for lottery in lotteries:
        lid = lottery.get("lottery_id")
        lottery["is_open"] = False  # Default to closed
        
        if lid in schedule_map:
            sched = schedule_map[lid]
            lottery["open_time"] = sched.get("open_time")
            lottery["close_time"] = sched.get("close_time")
            lottery["draw_time"] = sched.get("draw_time")
            lottery["draw_name"] = sched.get("draw_name")
            
            # Calculate is_open
            open_time = sched.get("open_time", "00:00")
            close_time = sched.get("close_time", "23:59")
            
            if open_time and close_time:
                # Handle overnight schedules (e.g., 22:00 - 02:00)
                if open_time <= close_time:
                    # Normal schedule (same day)
                    lottery["is_open"] = open_time <= current_time_str <= close_time
                else:
                    # Overnight schedule
                    lottery["is_open"] = current_time_str >= open_time or current_time_str <= close_time
    
    # ---- 7. BLOCKED NUMBERS ----
    blocked_numbers = await db.blocked_numbers.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(500)
    
    # Filter expired blocks
    now_iso = get_current_timestamp()
    active_blocks = []
    for block in blocked_numbers:
        expires = block.get("expires_at")
        if not expires or expires > now_iso:
            active_blocks.append(block)
    
    # ---- 8. SALES LIMITS ----
    sales_limits = await db.sales_limits.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(200)
    
    # ---- 9. PRIME/PAYOUT CONFIGS ----
    prime_configs = await db.prime_configs.find(
        {"company_id": company_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # ---- 10. CONFIG VERSION ----
    version_doc = await db.company_config_versions.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    config_version = version_doc.get("version", 1) if version_doc else 1
    
    # ---- 11. LOGOS ----
    system_settings = await db.system_settings.find_one({}, {"_id": 0})
    system_logo = system_settings.get("system_logo_url", "/assets/logos/lottolab-logo.png") if system_settings else "/assets/logos/lottolab-logo.png"
    system_name = system_settings.get("system_name", "LOTTOLAB") if system_settings else "LOTTOLAB"
    company_logo = company.get("company_logo_url")
    display_logo = company_logo if company_logo else system_logo
    
    return {
        "config_version": config_version,
        "company": {
            "company_id": company["company_id"],
            "name": company["name"],
            "currency": company.get("currency", "HTG"),
            "timezone": company.get("timezone", "America/Port-au-Prince"),
            "company_logo_url": company_logo,
            "status": company.get("status", "ACTIVE")
        },
        "logos": {
            "display_logo_url": display_logo,
            "company_logo_url": company_logo,
            "system_logo_url": system_logo,
            "system_name": system_name
        },
        "agent": {
            "agent_id": agent_id,
            "name": current_agent.get("name", ""),
            "email": current_agent.get("email", ""),
            "status": current_agent.get("status", "ACTIVE"),
            "device_session": device_session
        },
        "agent_policy": agent_policy,
        "pos_rules": pos_rules,
        "configuration": config,
        "enabled_lotteries": lotteries,
        "schedules": schedules,
        "blocked_numbers": active_blocks,
        "sales_limits": sales_limits,
        "prime_configs": prime_configs,
        "timestamp": get_current_timestamp()
    }


# ============================================================================
# ENHANCED SYNC ENDPOINT - POLL EVERY 5 SECONDS
# ============================================================================

@sync_router.get("/device/sync")
async def sync_device(
    current_agent: dict = Depends(get_current_agent),
    last_config_version: Optional[int] = None
):
    """
    Real-time synchronization endpoint - poll every 5 seconds.
    Returns:
    - config_version: Compare with local to detect changes
    - latest_results: Today's lottery results
    - blocked_numbers: Current blocked numbers
    - limits: Current sales limits
    - agent_status: Agent account status
    - pos_status: POS device status (if applicable)
    - daily_stats: Agent's sales stats for today
    - balance: Credit/winnings balance
    - config_changed: Boolean indicating if full config reload needed
    """
    company_id = current_agent.get("company_id")
    agent_id = current_agent.get("user_id")
    device_session = current_agent.get("device_session", {})
    
    # ---- 1. CONFIG VERSION CHECK ----
    version_doc = await db.company_config_versions.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    current_version = version_doc.get("version", 1) if version_doc else 1
    config_changed = last_config_version is not None and current_version > last_config_version
    
    # ---- 2. AGENT STATUS CHECK ----
    agent_user = await db.users.find_one(
        {"user_id": agent_id},
        {"_id": 0, "status": 1}
    )
    agent_status = agent_user.get("status", "ACTIVE") if agent_user else "UNKNOWN"
    
    # ---- 3. POS DEVICE STATUS (if hardware POS) ----
    pos_status = None
    pos_device_id = device_session.get("pos_device_id")
    if pos_device_id:
        pos_device = await db.pos_devices.find_one(
            {"device_id": pos_device_id},
            {"_id": 0, "status": 1}
        )
        pos_status = pos_device.get("status") if pos_device else None
    
    # ---- 4. LATEST RESULTS FOR TODAY ----
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get enabled lotteries for this company (check all possible field names)
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "$or": [{"is_enabled": True}, {"enabled": True}, {"is_enabled_for_company": True}]},
        {"_id": 0, "lottery_id": 1}
    ).to_list(200)
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    latest_results = []
    if lottery_ids:
        latest_results = await db.global_results.find(
            {"lottery_id": {"$in": lottery_ids}, "draw_date": today},
            {"_id": 0}
        ).sort("created_at", -1).limit(20).to_list(20)
    
    # ---- 5. BLOCKED NUMBERS ----
    now_iso = get_current_timestamp()
    blocked_numbers = await db.blocked_numbers.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(500)
    
    active_blocks = []
    for block in blocked_numbers:
        expires = block.get("expires_at")
        if not expires or expires > now_iso:
            active_blocks.append({
                "number": block["number"],
                "lottery_id": block.get("lottery_id"),
                "block_type": block.get("block_type", "FULL"),
                "max_amount": block.get("max_amount")
            })
    
    # ---- 6. SALES LIMITS ----
    limits = await db.sales_limits.find(
        {"company_id": company_id},
        {"_id": 0, "limit_id": 1, "lottery_id": 1, "agent_id": 1, "number": 1, "max_amount": 1, "period": 1}
    ).to_list(200)
    
    # ---- 7. DAILY STATS ----
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    pipeline = [
        {"$match": {"agent_id": agent_id, "created_at": {"$gte": today_start}}},
        {"$group": {
            "_id": None,
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"},
            "voided_count": {"$sum": {"$cond": [{"$eq": ["$status", "VOID"]}, 1, 0]}},
            "winners_count": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, 1, 0]}},
            "total_wins": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, "$win_amount", 0]}}
        }}
    ]
    stats_result = await db.lottery_transactions.aggregate(pipeline).to_list(1)
    
    daily_stats = {
        "tickets": 0,
        "sales": 0.0,
        "voided": 0,
        "winners": 0,
        "wins": 0.0,
        "net": 0.0
    }
    
    if stats_result:
        s = stats_result[0]
        daily_stats = {
            "tickets": s.get("total_tickets", 0),
            "sales": s.get("total_sales", 0.0),
            "voided": s.get("voided_count", 0),
            "winners": s.get("winners_count", 0),
            "wins": s.get("total_wins", 0.0),
            "net": s.get("total_sales", 0.0) - s.get("total_wins", 0.0)
        }
    
    # ---- 8. BALANCE ----
    agent_balance = await db.agent_balances.find_one(
        {"agent_id": agent_id},
        {"_id": 0}
    )
    
    balance = {
        "credit": agent_balance.get("credit", 0.0) if agent_balance else 0.0,
        "winnings": agent_balance.get("winnings", 0.0) if agent_balance else 0.0,
        "available": agent_balance.get("available", 0.0) if agent_balance else 0.0
    }
    
    # ---- 9. ENABLED LOTTERIES (only if config changed) ----
    enabled_lotteries = []
    if config_changed:
        if lottery_ids:
            global_lotteries = await db.global_lotteries.find(
                {"lottery_id": {"$in": lottery_ids}, "is_active": True},
                {"_id": 0, "lottery_id": 1, "lottery_name": 1, "game_type": 1, "state_code": 1}
            ).to_list(200)
            enabled_lotteries = global_lotteries
    
    return {
        "config_version": current_version,
        "config_changed": config_changed,
        "agent_status": agent_status,
        "pos_status": pos_status,
        "latest_results": latest_results,
        "blocked_numbers": active_blocks,
        "limits": limits,
        "daily_stats": daily_stats,
        "balance": balance,
        "enabled_lotteries": enabled_lotteries if config_changed else [],
        "server_time": get_current_timestamp()
    }


# ============================================================================
# TICKET PRINTING ENDPOINT - UNIVERSAL FORMAT
# ============================================================================

@sync_router.get("/ticket/print/{ticket_id}", response_class=HTMLResponse)
async def print_ticket_universal(
    ticket_id: str,
    request: Request,
    format: str = "thermal",  # thermal (80mm) or standard (A4)
    token: Optional[str] = None  # Allow token via query param for window.open()
):
    """
    Generate printable ticket HTML - LOTO PAM 80mm thermal format.
    
    IMPORTANT: This ticket does NOT display:
    - "En attente" status text
    - "Gains potentiels" section
    
    Only shows: VALIDÉ status, actual ticket data
    """
    # Get token from query param or header
    auth_token = token
    if not auth_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            auth_token = auth_header.replace("Bearer ", "")
    
    if not auth_token:
        raise HTTPException(status_code=401, detail="Token requis pour l'impression")
    
    payload = decode_token(auth_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    company_id = user.get("company_id")
    
    # Find the ticket
    ticket = await db.lottery_transactions.find_one({
        "ticket_id": ticket_id,
        "company_id": company_id
    }, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    # Get company info
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    company_name = company.get("name", "LOTO PAM") if company else "LOTO PAM"
    company_logo = company.get("company_logo_url") or company.get("logo_url") if company else None
    company_phone = company.get("phone", "") if company else ""
    company_address = company.get("address", "") if company else ""
    header_text = company.get("ticket_header_text", "") if company else ""
    footer_text = company.get("ticket_footer_text", "") if company else ""
    qr_code_enabled = company.get("qr_code_enabled", True) if company else True
    currency = ticket.get("currency", "HTG")
    
    # For the logo, we'll use a simple text-based approach since images may not load correctly
    # The logo will be shown as text "LOTO PAM" with styling
    display_logo = ""  # Leave empty - logo text will be shown instead
    
    # Get agent info for POS ID
    agent = await db.users.find_one({"user_id": ticket.get("agent_id")}, {"_id": 0})
    agent_name = ticket.get("agent_name") or (agent.get("name") if agent else "") or "N/A"
    pos_id = (agent.get("pos_serial_number") if agent else None) or "N/A"
    
    # Get company info
    company = await db.companies.find_one(
        {"company_id": ticket.get("company_id")},
        {"_id": 0, "name": 1, "logo_url": 1}
    )
    company_name = company.get("name", "LOTO PAM") if company else "LOTO PAM"
    
    # Get branch/succursale name
    succursale_name = "N/A"
    if ticket.get("succursale_id") or ticket.get("branch_id"):
        branch_id = ticket.get("succursale_id") or ticket.get("branch_id")
        branch = await db.branches.find_one({"branch_id": branch_id}, {"_id": 0, "name": 1})
        if branch:
            succursale_name = branch.get("name", "N/A")
        else:
            succursale = await db.succursales.find_one({"succursale_id": branch_id}, {"_id": 0, "name": 1})
            if succursale:
                succursale_name = succursale.get("name", "N/A")
    
    # Format date and time - Haiti timezone
    created_at = ticket.get("created_at", "")
    formatted_date = "N/A"
    formatted_time = "N/A"
    if created_at:
        try:
            import pytz
            from datetime import datetime, timezone as tz
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            # Convert to Haiti timezone
            haiti_tz = pytz.timezone("America/Port-au-Prince")
            dt_local = dt.astimezone(haiti_tz)
            formatted_date = dt_local.strftime("%d/%m/%Y")
            formatted_time = dt_local.strftime("%I:%M %p")
        except:
            formatted_date = created_at[:10] if len(created_at) >= 10 else created_at
            formatted_time = created_at[11:16] if len(created_at) >= 16 else ""
    
    # Get draw info
    lottery_name = ticket.get("lottery_name", "N/A")
    draw_name = ticket.get("draw_name", "")
    ticket_code = ticket.get("ticket_code", ticket_id[:12].upper())
    verification_code = ticket.get("verification_code", "")
    
    # Generate QR code if enabled
    qr_code_html = ""
    if qr_code_enabled and verification_code:
        try:
            qr = qrcode.QRCode(version=1, box_size=3, border=1)
            qr_url = f"https://lottolab.tech/api/verify-ticket/{verification_code}"
            qr.add_data(qr_url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            qr_base64 = base64.b64encode(buffer.getvalue()).decode()
            qr_code_html = f'<div class="qr-section"><img src="data:image/png;base64,{qr_base64}" class="qr-code" alt="QR" /></div>'
        except Exception as e:
            qr_code_html = ""
    
    # Build company contact info for ticket
    contact_info_html = ""
    if company_phone or company_address:
        contact_parts = []
        if company_phone:
            contact_parts.append(f"Tél: {company_phone}")
        if company_address:
            contact_parts.append(company_address)
        contact_info_html = '<div class="contact-info">' + '<br>'.join(contact_parts) + '</div>'
    
    # Build plays rows
    plays_rows = ""
    for play in ticket.get("plays", []):
        numbers = play.get("numbers", "N/A")
        amount = play.get("amount", 0)
        plays_rows += f"""
        <div class="play-line">
            <span class="play-numbers">{numbers}</span>
            <span class="play-amount">{amount} {currency}</span>
        </div>
        """
    
    total_amount = ticket.get("total_amount", 0)
    
    # Generate the 80mm thermal receipt HTML - LOTO PAM format
    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=80mm">
    <title>Ticket {ticket_code}</title>
    <style>
        @page {{
            size: 80mm auto;
            margin: 0;
        }}
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            width: 80mm;
            max-width: 80mm;
            padding: 3mm;
            background: white;
            color: black;
            line-height: 1.3;
        }}
        .separator {{
            text-align: center;
            font-size: 10px;
            letter-spacing: 1px;
            margin: 4px 0;
        }}
        .separator-dashed {{
            border-top: 1px dashed black;
            margin: 6px 0;
        }}
        .header {{
            text-align: center;
            margin-bottom: 6px;
        }}
        .logo-text {{
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 2px;
        }}
        .sub-header {{
            font-size: 9px;
            margin: 2px 0;
        }}
        .info-line {{
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
            font-size: 10px;
        }}
        .info-label {{
            font-weight: normal;
        }}
        .info-value {{
            font-weight: bold;
        }}
        .section-title {{
            text-align: center;
            font-weight: bold;
            font-size: 10px;
            margin: 6px 0 4px 0;
            text-transform: uppercase;
        }}
        .lottery-info {{
            text-align: center;
            margin: 6px 0;
        }}
        .lottery-name {{
            font-weight: bold;
            font-size: 12px;
        }}
        .lottery-draw {{
            font-size: 10px;
        }}
        .play-line {{
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            padding: 2px 0;
        }}
        .play-numbers {{
            font-weight: bold;
            font-size: 12px;
            letter-spacing: 1px;
        }}
        .play-amount {{
            font-size: 11px;
        }}
        .total-section {{
            text-align: center;
            margin: 8px 0;
            padding: 6px 0;
            border-top: 1px solid black;
            border-bottom: 1px solid black;
        }}
        .total-label {{
            font-size: 11px;
            font-weight: bold;
        }}
        .total-amount {{
            font-size: 16px;
            font-weight: bold;
            margin-top: 2px;
        }}
        .status-section {{
            text-align: center;
            margin: 6px 0;
        }}
        .status-badge {{
            font-size: 12px;
            font-weight: bold;
            padding: 4px 12px;
            border: 2px solid black;
            display: inline-block;
        }}
        .footer {{
            text-align: center;
            margin-top: 8px;
            font-size: 9px;
        }}
        .footer-url {{
            font-size: 8px;
            margin-top: 4px;
        }}
        .thank-you {{
            font-weight: bold;
            margin-top: 6px;
            font-size: 10px;
        }}
        .contact-info {{
            text-align: center;
            font-size: 8px;
            margin: 4px 0;
            color: black;
        }}
        .qr-section {{
            text-align: center;
            margin: 8px 0;
        }}
        .qr-code {{
            width: 25mm;
            height: 25mm;
        }}
        .print-btn {{
            display: block;
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            background: #333;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 14px;
        }}
        .logo-image {{
            max-width: 60mm;
            max-height: 20mm;
            margin: 0 auto 4px auto;
            display: block;
        }}
        @media print {{
            body {{
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }}
            .no-print {{ display: none !important; }}
            @page {{
                margin: 0;
            }}
        }}
    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">IMPRIMER</button>
    
    <div class="separator">================================</div>
    
    <div class="header">
        {'<img src="' + company.get("logo_url", "") + '" class="logo-image" alt="Logo" onerror="this.style.display=' + "'none'" + '" />' if company and company.get("logo_url") else ''}
        <div class="logo-text">{company_name}</div>
        {contact_info_html}
        <div class="sub-header">{header_text if header_text else ''}</div>
    </div>
    
    <div class="separator">================================</div>
    
    <div class="info-line">
        <span class="info-label">VENDEUR :</span>
        <span class="info-value">{agent_name.upper() if agent_name else 'N/A'}</span>
    </div>
    <div class="info-line">
        <span class="info-label">SUCCURSALE:</span>
        <span class="info-value">{succursale_name if succursale_name else 'N/A'}</span>
    </div>
    <div class="info-line">
        <span class="info-label">TICKET  :</span>
        <span class="info-value">{ticket_code}</span>
    </div>
    
    <div class="separator-dashed"></div>
    
    <div class="lottery-info">
        <div class="lottery-name">LOTTERIE : {lottery_name}</div>
        <div class="lottery-draw">TIRAGE   : {draw_name if draw_name else 'Standard'}</div>
        <div class="lottery-draw">DATE     : {formatted_date}</div>
        <div class="lottery-draw">HEURE    : {formatted_time}</div>
    </div>
    
    <div class="separator-dashed"></div>
    
    <div class="section-title">NUMÉROS JOUÉS</div>
    
    {plays_rows if plays_rows else '<div style="text-align:center;font-size:10px;">Aucun numéro</div>'}
    
    <div class="total-section">
        <div class="total-label">TOTAL MISE :</div>
        <div class="total-amount">{total_amount:,.0f} {currency}</div>
    </div>
    
    <div class="status-section">
        <div class="status-badge">STATUT : VALIDÉ</div>
    </div>
    
    <div class="separator-dashed"></div>
    
    <div class="footer">
        <div class="thank-you">MERCI DE JOUER AVEC<br>{company_name}</div>
        <div style="margin-top:4px;font-size:7px;">
            {footer_text if footer_text else ''}
        </div>
        {qr_code_html}
        <div style="margin-top:6px;font-size:7px;text-align:left;">
            Vérifiez votre ticket avant de vous déplacer.<br>
            Ce ticket doit être payé UNE SEULE FOIS<br>
            dans les 90 jours. Le PREMIER qui<br>
            présente ce ticket est le bénéficiaire.<br>
            Si le numéro est effacé, on NE PAIE PAS.<br>
            Protégez le ticket de la chaleur, humidité<br>
            et ne gardez pas dans les pièces de monnaie.
        </div>
        <div class="footer-url" style="margin-top:6px;font-weight:bold;">LOTTOLAB.TECH</div>
    </div>
    
    <div class="separator">================================</div>
    
    <script>
        if (window.location.search.includes('auto=true')) {{
            window.onload = function() {{ setTimeout(function() {{ window.print(); }}, 300); }};
        }}
    </script>
</body>
</html>"""
    
    return HTMLResponse(content=html)


# ============================================================================
# TICKET REPRINT ENDPOINT
# ============================================================================

@sync_router.post("/ticket/reprint/{ticket_id}")
async def reprint_ticket(
    ticket_id: str,
    request: Request,
    current_agent: dict = Depends(get_current_agent)
):
    """Log ticket reprint and increment count"""
    company_id = current_agent.get("company_id")
    agent_id = current_agent.get("user_id")
    device_session = current_agent.get("device_session", {})
    
    # Check agent can reprint
    policy = await db.agent_policies.find_one({"agent_id": agent_id}, {"_id": 0})
    if policy and not policy.get("can_reprint_ticket", True):
        raise HTTPException(status_code=403, detail="Réimpression non autorisée pour cet agent")
    
    # Find ticket
    ticket = await db.lottery_transactions.find_one({
        "ticket_id": ticket_id,
        "company_id": company_id
    })
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    # Increment print count
    await db.lottery_transactions.update_one(
        {"ticket_id": ticket_id},
        {"$inc": {"printed_count": 1}}
    )
    
    # Log activity
    now = get_current_timestamp()
    await db.activity_logs.insert_one({
        "log_id": generate_id("log_"),
        "action_type": "TICKET_REPRINTED",
        "entity_type": "ticket",
        "entity_id": ticket_id,
        "performed_by": agent_id,
        "company_id": company_id,
        "metadata": {
            "ticket_code": ticket.get("ticket_code"),
            "device_type": device_session.get("device_type"),
            "device_session_id": device_session.get("session_id")
        },
        "ip_address": request.client.host if request.client else None,
        "created_at": now
    })
    
    return {"message": "Réimpression enregistrée", "printed_count": (ticket.get("printed_count", 1) + 1)}


# ============================================================================
# RESULTS ENDPOINT - COMPANY FILTERED
# ============================================================================

@sync_router.get("/results/today")
async def get_today_results(current_agent: dict = Depends(get_current_agent)):
    """Get all results for today for company's enabled lotteries"""
    company_id = current_agent.get("company_id")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get enabled lotteries
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "enabled": True},
        {"_id": 0, "lottery_id": 1}
    ).to_list(200)
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    if not lottery_ids:
        return []
    
    results = await db.global_results.find(
        {"lottery_id": {"$in": lottery_ids}, "draw_date": today},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return results


@sync_router.get("/device/results")
async def get_device_results(
    current_agent: dict = Depends(get_current_agent),
    limit: int = 100
):
    """Get all results for agent device display with auto-sync"""
    company_id = current_agent.get("company_id")
    
    # Get enabled lotteries for this company (check both field names)
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "$or": [{"is_enabled": True}, {"enabled": True}]},
        {"_id": 0, "lottery_id": 1}
    ).to_list(200)
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    if not lottery_ids:
        return []
    
    # Get recent results (last 14 days)
    end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_date = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
    
    results = await db.global_results.find(
        {
            "lottery_id": {"$in": lottery_ids},
            "draw_date": {"$gte": start_date, "$lte": end_date}
        },
        {"_id": 0}
    ).sort([("draw_date", -1), ("created_at", -1)]).limit(limit).to_list(limit)
    
    return results


@sync_router.get("/results/history")
async def get_results_history(
    current_agent: dict = Depends(get_current_agent),
    lottery_id: Optional[str] = None,
    days: int = 7
):
    """Get results history for the past N days"""
    company_id = current_agent.get("company_id")
    
    # Get enabled lotteries
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "enabled": True},
        {"_id": 0, "lottery_id": 1}
    ).to_list(200)
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    if lottery_id:
        if lottery_id not in lottery_ids:
            raise HTTPException(status_code=403, detail="Loterie non disponible")
        lottery_ids = [lottery_id]
    
    if not lottery_ids:
        return []
    
    # Date range
    end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    
    results = await db.global_results.find(
        {
            "lottery_id": {"$in": lottery_ids},
            "draw_date": {"$gte": start_date, "$lte": end_date}
        },
        {"_id": 0}
    ).sort([("draw_date", -1), ("created_at", -1)]).limit(500).to_list(500)
    
    return results
