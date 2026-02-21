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
    device_session = current_agent.get("device_session", {})
    
    # ---- 1. COMPANY INFO ----
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    # ---- 2. COMPANY CONFIGURATION ----
    config = await db.company_configurations.find_one({"company_id": company_id}, {"_id": 0})
    if not config:
        config = {
            "min_bet_amount": 10.0,
            "max_bet_amount": 10000.0,
            "max_bet_per_number": 5000.0,
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
    
    # ---- 5. ENABLED LOTTERIES (COMPANY CATALOG) ----
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "enabled": True},
        {"_id": 0}
    ).to_list(200)
    
    lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
    
    # Get full lottery details
    lotteries = []
    if lottery_ids:
        global_lotteries = await db.global_lotteries.find(
            {"lottery_id": {"$in": lottery_ids}, "is_active": True},
            {"_id": 0}
        ).to_list(200)
        
        # Merge company settings with global lottery data
        cl_map = {cl["lottery_id"]: cl for cl in company_lotteries}
        for gl in global_lotteries:
            cl = cl_map.get(gl["lottery_id"], {})
            lotteries.append({
                **gl,
                "max_bet_per_ticket": cl.get("max_bet_per_ticket", config.get("max_bet_amount", 10000.0)),
                "max_bet_per_number": cl.get("max_bet_per_number", config.get("max_bet_per_number", 5000.0))
            })
    
    # ---- 6. SCHEDULES FOR TODAY ----
    today_weekday = datetime.now(timezone.utc).weekday()
    schedules = []
    if lottery_ids:
        all_schedules = await db.global_schedules.find(
            {"lottery_id": {"$in": lottery_ids}, "is_active": True},
            {"_id": 0}
        ).to_list(500)
        
        # Filter for today
        for sched in all_schedules:
            days = sched.get("days_of_week", [])
            if not days or today_weekday in days:
                schedules.append(sched)
    
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
    
    # Get enabled lotteries for this company
    company_lotteries = await db.company_lotteries.find(
        {"company_id": company_id, "enabled": True},
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
    format: str = "thermal",  # thermal (80mm) or standard (A4)
    current_agent: dict = Depends(get_current_agent)
):
    """
    Generate printable ticket HTML.
    Supports thermal (80mm) and standard (A4) formats.
    """
    company_id = current_agent.get("company_id")
    
    # Find the ticket
    ticket = await db.lottery_transactions.find_one({
        "ticket_id": ticket_id,
        "company_id": company_id
    }, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    # Get company info
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    config = await db.company_configurations.find_one({"company_id": company_id}, {"_id": 0})
    
    # Get logos
    system_settings = await db.system_settings.find_one({}, {"_id": 0})
    system_logo = system_settings.get("system_logo_url", "/assets/logos/lottolab-logo.png") if system_settings else "/assets/logos/lottolab-logo.png"
    company_logo = company.get("company_logo_url") if company else None
    display_logo = company_logo if company_logo else system_logo
    
    # Generate QR code
    qr_payload = ticket.get("qr_payload", f"{ticket.get('ticket_code')}|{ticket.get('verification_code')}|{company_id}")
    qr_code = generate_qr_code_base64(qr_payload)
    
    # Build plays HTML
    plays_html = ""
    for play in ticket.get("plays", []):
        plays_html += f"""
        <tr>
            <td class="num">{play.get('numbers', '')}</td>
            <td class="type">{play.get('bet_type', '')}</td>
            <td class="amt">{play.get('amount', 0):.0f}</td>
        </tr>
        """
    
    # Receipt header/footer
    receipt_header = config.get("receipt_header", "") if config else ""
    receipt_footer = config.get("receipt_footer", "Merci et bonne chance!") if config else "Merci et bonne chance!"
    
    # Status badge
    status = ticket.get("status", "PENDING_RESULT")
    status_class = "pending"
    status_text = "En attente"
    if status == "WINNER":
        status_class = "winner"
        status_text = "GAGNANT"
    elif status == "LOSER":
        status_class = "loser"
        status_text = "Perdant"
    elif status == "VOID":
        status_class = "void"
        status_text = "ANNULÉ"
    elif status == "PAID":
        status_class = "paid"
        status_text = "PAYÉ"
    
    # Format-specific styling
    if format == "thermal":
        page_style = """
            @page { size: 80mm auto; margin: 2mm; }
            body { width: 76mm; font-size: 11px; }
        """
    else:
        page_style = """
            @page { size: A4; margin: 10mm; }
            body { width: 210mm; font-size: 14px; max-width: 300px; margin: 0 auto; }
        """
    
    html = f"""
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Ticket {ticket.get('ticket_code', '')}</title>
    <style>
        {page_style}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: 'Courier New', monospace;
            padding: 3mm;
            background: #fff;
        }}
        .header {{
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 4px;
            margin-bottom: 6px;
        }}
        .company-name {{
            font-size: 1.3em;
            font-weight: bold;
            letter-spacing: 1px;
        }}
        .sub-header {{
            font-size: 0.85em;
            color: #555;
        }}
        .ticket-code {{
            text-align: center;
            font-size: 1.4em;
            font-weight: bold;
            padding: 6px;
            margin: 6px 0;
            border: 2px solid #000;
            letter-spacing: 2px;
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            font-size: 0.9em;
        }}
        .info-label {{ font-weight: bold; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 6px 0;
        }}
        th {{
            border-bottom: 1px solid #000;
            padding: 3px;
            text-align: left;
            font-size: 0.85em;
        }}
        td {{
            padding: 3px;
            border-bottom: 1px dotted #ccc;
        }}
        .num {{ font-weight: bold; font-size: 1.1em; }}
        .type {{ font-size: 0.85em; }}
        .amt {{ text-align: right; font-weight: bold; }}
        .total {{
            text-align: right;
            font-size: 1.2em;
            font-weight: bold;
            border-top: 2px solid #000;
            padding-top: 4px;
            margin-top: 4px;
        }}
        .potential {{
            text-align: right;
            font-size: 0.95em;
            color: #333;
        }}
        .qr-section {{
            text-align: center;
            margin: 8px 0;
        }}
        .qr-section img {{
            width: 80px;
            height: 80px;
        }}
        .logo-section {{
            text-align: center;
            margin-bottom: 6px;
        }}
        .logo-section img {{
            max-width: 60mm;
            max-height: 25mm;
            object-fit: contain;
        }}
        .verification {{
            text-align: center;
            font-size: 0.8em;
            color: #666;
        }}
        .footer {{
            text-align: center;
            border-top: 2px dashed #000;
            padding-top: 4px;
            margin-top: 6px;
            font-size: 0.85em;
        }}
        .status {{
            text-align: center;
            padding: 4px;
            margin: 4px 0;
            font-weight: bold;
            border-radius: 3px;
        }}
        .status.pending {{ background: #fff3cd; color: #856404; }}
        .status.winner {{ background: #d4edda; color: #155724; }}
        .status.loser {{ background: #f8d7da; color: #721c24; }}
        .status.void {{ background: #f5f5f5; color: #666; text-decoration: line-through; }}
        .status.paid {{ background: #cce5ff; color: #004085; }}
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
        @media print {{
            .no-print {{ display: none !important; }}
        }}
    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">IMPRIMER</button>
    
    <div class="logo-section">
        <img src="{display_logo}" alt="Logo" onerror="this.style.display='none'" />
    </div>
    
    <div class="header">
        <div class="company-name">{company.get('name', 'LOTTOLAB')}</div>
        {f'<div class="sub-header">{receipt_header}</div>' if receipt_header else ''}
    </div>
    
    <div class="ticket-code">{ticket.get('ticket_code', '')}</div>
    
    <div class="status {status_class}">{status_text}</div>
    
    <div class="info-row">
        <span class="info-label">Loterie:</span>
        <span>{ticket.get('lottery_name', '')}</span>
    </div>
    <div class="info-row">
        <span class="info-label">Tirage:</span>
        <span>{ticket.get('draw_name', '')} - {ticket.get('draw_date', '')}</span>
    </div>
    <div class="info-row">
        <span class="info-label">Agent:</span>
        <span>{ticket.get('agent_name', '')}</span>
    </div>
    <div class="info-row">
        <span class="info-label">Date:</span>
        <span>{ticket.get('created_at', '')[:16].replace('T', ' ')}</span>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Numéro</th>
                <th>Type</th>
                <th style="text-align:right;">Montant</th>
            </tr>
        </thead>
        <tbody>
            {plays_html}
        </tbody>
    </table>
    
    <div class="total">
        TOTAL: {ticket.get('total_amount', 0):.0f} {ticket.get('currency', 'HTG')}
    </div>
    <div class="potential">
        Gain potentiel: {ticket.get('potential_win', 0):.0f} {ticket.get('currency', 'HTG')}
    </div>
    
    <div class="qr-section">
        <img src="data:image/png;base64,{qr_code}" alt="QR" />
    </div>
    
    <div class="verification">
        Vérification: {ticket.get('verification_code', '')}
    </div>
    
    <div class="footer">
        {receipt_footer}
        <br>
        <small>Appareil: {ticket.get('device_type', '')}</small>
    </div>
    
    <script>
        if (window.location.search.includes('auto=true')) {{
            window.onload = function() {{ window.print(); }};
        }}
    </script>
</body>
</html>
    """
    
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
