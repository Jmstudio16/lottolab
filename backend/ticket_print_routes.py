"""
LOTTOLAB - Professional POS 80mm Ticket Printing System
Handles ticket generation, verification, and professional thermal printing
Optimized for thermal POS printers (80mm width)
"""

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from datetime import datetime, timezone, timedelta
from typing import Optional
import random
import string
import base64
import io

from models import UserRole
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

ticket_print_router = APIRouter(prefix="/api", tags=["Ticket Printing"])

db = None

def set_ticket_print_db(database):
    global db
    db = database


def generate_verification_code_12():
    """Generate unique 12-digit verification code"""
    return ''.join(random.choices(string.digits, k=12))


async def get_unique_verification_code():
    """Generate a unique 12-digit verification code"""
    for _ in range(10):  # Try up to 10 times
        code = generate_verification_code_12()
        existing = await db.lottery_transactions.find_one({"verification_code": code})
        if not existing:
            return code
    raise HTTPException(status_code=500, detail="Cannot generate unique verification code")


# ============================================================================
# PUBLIC TICKET VERIFICATION PAGE (No login required)
# ============================================================================

@ticket_print_router.get("/verify-ticket/{verification_code}", response_class=HTMLResponse)
async def verify_ticket_public(verification_code: str):
    """
    PUBLIC page to verify ticket by scanning QR code.
    Accessible without login - for customers to check their tickets.
    """
    # Try both collections
    ticket = await db.lottery_transactions.find_one(
        {"verification_code": verification_code},
        {"_id": 0}
    )
    if not ticket:
        ticket = await db.tickets.find_one(
            {"verification_code": verification_code},
            {"_id": 0}
        )
    
    # Get company info for branding
    company = None
    if ticket:
        company = await db.companies.find_one(
            {"company_id": ticket.get("company_id")},
            {"_id": 0, "name": 1, "logo_url": 1, "currency": 1}
        )
    
    # Status styling
    status_colors = {
        "ACTIVE": ("#3B82F6", "En attente du tirage"),
        "PENDING_RESULT": ("#F59E0B", "En attente des résultats"),
        "WINNER": ("#10B981", "GAGNANT!"),
        "LOSER": ("#6B7280", "Non gagnant"),
        "VOID": ("#EF4444", "ANNULÉ"),
        "PAID": ("#8B5CF6", "Payé")
    }
    
    if not ticket:
        # Ticket not found page
        html = f"""
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Vérification Ticket - LOTTOLAB</title>
            <style>
                * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                body {{ 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #1e1e2e 0%, #0f0f1a 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }}
                .container {{
                    background: #1f2937;
                    border-radius: 16px;
                    padding: 40px;
                    max-width: 400px;
                    width: 100%;
                    text-align: center;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                }}
                .error-icon {{
                    width: 80px;
                    height: 80px;
                    background: #EF4444;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                    font-size: 40px;
                }}
                h1 {{ color: #EF4444; font-size: 24px; margin-bottom: 16px; }}
                p {{ color: #9CA3AF; font-size: 16px; }}
                .code {{ font-family: monospace; color: #F59E0B; font-size: 14px; margin-top: 16px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error-icon">❌</div>
                <h1>Ticket Non Trouvé</h1>
                <p>Le code de vérification est invalide ou le ticket n'existe pas.</p>
                <p class="code">Code: {verification_code}</p>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=html, status_code=404)
    
    # Ticket found - display details
    status = ticket.get("status", "ACTIVE")
    status_color, status_text = status_colors.get(status, ("#6B7280", status))
    company_name = company.get("name", "LOTTOLAB") if company else "LOTTOLAB"
    currency = ticket.get("currency", "HTG")
    
    # Format plays
    plays_html = ""
    for play in ticket.get("plays", []):
        plays_html += f"""
        <div class="play-row">
            <span class="numbers">{play.get('numbers', 'N/A')}</span>
            <span class="type">{play.get('bet_type', 'N/A')}</span>
            <span class="amount">{play.get('amount', 0)} {currency}</span>
        </div>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vérification Ticket - {company_name}</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #1e1e2e 0%, #0f0f1a 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            .container {{
                background: #1f2937;
                border-radius: 16px;
                padding: 32px;
                max-width: 450px;
                width: 100%;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            }}
            .header {{
                text-align: center;
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 2px solid #374151;
            }}
            .company-name {{
                color: #F59E0B;
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 8px;
            }}
            .ticket-code {{
                font-family: monospace;
                font-size: 20px;
                color: #fff;
                background: #111827;
                padding: 12px 24px;
                border-radius: 8px;
                display: inline-block;
            }}
            .status-badge {{
                display: inline-block;
                padding: 12px 32px;
                border-radius: 8px;
                font-weight: bold;
                font-size: 18px;
                margin: 20px 0;
                background: {status_color}20;
                color: {status_color};
                border: 2px solid {status_color};
            }}
            .info-grid {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                margin-bottom: 24px;
            }}
            .info-item {{
                background: #111827;
                padding: 12px;
                border-radius: 8px;
            }}
            .info-label {{
                color: #9CA3AF;
                font-size: 12px;
                text-transform: uppercase;
                margin-bottom: 4px;
            }}
            .info-value {{
                color: #fff;
                font-size: 16px;
                font-weight: 500;
            }}
            .plays-section {{
                background: #111827;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 24px;
            }}
            .plays-title {{
                color: #F59E0B;
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 12px;
                text-transform: uppercase;
            }}
            .play-row {{
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #374151;
            }}
            .play-row:last-child {{ border-bottom: none; }}
            .numbers {{ color: #fff; font-family: monospace; font-weight: bold; }}
            .type {{ color: #9CA3AF; }}
            .amount {{ color: #10B981; font-weight: 500; }}
            .total-section {{
                text-align: center;
                padding: 16px;
                background: #10B98120;
                border-radius: 8px;
                border: 1px solid #10B981;
            }}
            .total-label {{ color: #10B981; font-size: 14px; }}
            .total-value {{ color: #fff; font-size: 28px; font-weight: bold; }}
            .footer {{
                text-align: center;
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px solid #374151;
                color: #6B7280;
                font-size: 12px;
            }}
            .verification-code {{
                font-family: monospace;
                color: #F59E0B;
                font-size: 14px;
                margin-top: 8px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="company-name">{company_name}</div>
                <div class="ticket-code">{ticket.get('ticket_code', 'N/A')}</div>
            </div>
            
            <div style="text-align: center;">
                <div class="status-badge">{status_text}</div>
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Loterie</div>
                    <div class="info-value">{ticket.get('lottery_name', 'N/A')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Tirage</div>
                    <div class="info-value">{ticket.get('draw_name', ticket.get('draw_datetime', 'N/A'))}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Date</div>
                    <div class="info-value">{ticket.get('created_at', 'N/A')[:10] if ticket.get('created_at') else 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Agent</div>
                    <div class="info-value">{ticket.get('agent_name', 'N/A')}</div>
                </div>
            </div>
            
            <div class="plays-section">
                <div class="plays-title">Numéros Joués</div>
                {plays_html if plays_html else '<p style="color:#9CA3AF;text-align:center;">Aucun numéro</p>'}
            </div>
            
            <div class="total-section">
                <div class="total-label">TOTAL</div>
                <div class="total-value">{ticket.get('total_amount', 0):,.0f} {currency}</div>
            </div>
            
            <div class="footer">
                <p>Ticket vérifié le {datetime.now().strftime('%d/%m/%Y à %H:%M')}</p>
                <p class="verification-code">Code: {verification_code}</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)


# ============================================================================
# PRINT TICKET - 80mm POS Thermal Format (LOTO PAM Style)
# ============================================================================

@ticket_print_router.get("/ticket/print/{ticket_id}", response_class=HTMLResponse)
async def print_ticket_80mm(
    ticket_id: str,
    token: Optional[str] = None,
    auto: bool = False,
    format: str = "thermal"
):
    """
    Generate 80mm POS thermal printer optimized ticket.
    Returns HTML page optimized for window.print() - LOTO PAM format
    
    IMPORTANT: This ticket does NOT display:
    - "En attente" status text
    - "Gains potentiels" section
    
    Only shows: VALIDÉ status, actual ticket data
    """
    # Try both collections for backward compatibility
    ticket = await db.lottery_transactions.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        ticket = await db.tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    # Get company info
    company = await db.companies.find_one(
        {"company_id": ticket.get("company_id")},
        {"_id": 0}
    )
    
    company_name = company.get("name", "LOTO PAM") if company else "LOTO PAM"
    header_text = company.get("ticket_header_text", "") if company else ""
    footer_text = company.get("ticket_footer_text", "") if company else ""
    currency = ticket.get("currency", "HTG")
    
    # Get branch info
    branch = await db.branches.find_one(
        {"branch_id": ticket.get("branch_id")},
        {"_id": 0, "name": 1}
    )
    branch_name = branch.get("name", "N/A") if branch else "N/A"
    
    # Get agent info
    agent = await db.users.find_one(
        {"user_id": ticket.get("agent_id")},
        {"_id": 0, "name": 1, "full_name": 1, "pos_serial_number": 1, "branch_id": 1}
    )
    agent_name = ticket.get("agent_name") or (agent.get("name") if agent else "") or (agent.get("full_name") if agent else "") or "N/A"
    
    # If branch_name not found from ticket, try to get from agent
    if branch_name == "N/A" and agent and agent.get("branch_id"):
        agent_branch = await db.branches.find_one(
            {"branch_id": agent.get("branch_id")},
            {"_id": 0, "name": 1}
        )
        branch_name = agent_branch.get("name", "N/A") if agent_branch else "N/A"
    
    # Format date and time in company timezone (Haiti by default)
    created_at = ticket.get("created_at", "")
    formatted_date = "N/A"
    formatted_time = "N/A"
    if created_at:
        try:
            import pytz
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            # Convert to Haiti timezone (America/Port-au-Prince)
            company_tz_str = company.get("timezone", "America/Port-au-Prince") if company else "America/Port-au-Prince"
            try:
                target_tz = pytz.timezone(company_tz_str)
            except:
                target_tz = pytz.timezone("America/Port-au-Prince")
            dt_local = dt.astimezone(target_tz)
            formatted_date = dt_local.strftime("%d/%m/%Y")
            formatted_time = dt_local.strftime("%I:%M %p")
        except Exception as e:
            formatted_date = created_at[:10] if len(created_at) >= 10 else created_at
            formatted_time = created_at[11:16] if len(created_at) >= 16 else ""
    
    # Get draw info
    lottery_name = ticket.get("lottery_name", "N/A")
    draw_name = ticket.get("draw_name", "")
    draw_time = ticket.get("draw_time", "")
    
    # Ticket code
    ticket_code = ticket.get("ticket_code", ticket_id[:12].upper())
    
    # Build plays rows - format: "12 - 25 - 36    50 HTG"
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
    
    # Generate the 80mm thermal receipt HTML
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
        .separator-double {{
            border-top: 2px solid black;
            border-bottom: 2px solid black;
            height: 4px;
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
        @media print {{
            body {{
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }}
            @page {{
                margin: 0;
            }}
        }}
    </style>
</head>
<body>
    <div class="separator">================================</div>
    
    <div class="header">
        <div class="logo-text">{company_name}</div>
        <div class="sub-header">{header_text if header_text else ''}</div>
    </div>
    
    <div class="separator">================================</div>
    
    <div class="info-line">
        <span class="info-label">VENDEUR :</span>
        <span class="info-value">{agent_name.upper()}</span>
    </div>
    <div class="info-line">
        <span class="info-label">SUCCURSALE:</span>
        <span class="info-value">{branch_name}</span>
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
        <div class="status-badge">STATUT : ACTIF</div>
    </div>
    
    <div class="separator-dashed"></div>
    
    <div class="footer">
        <div class="thank-you">MERCI DE JOUER AVEC<br>{company_name}</div>
        <div style="margin-top:4px;font-size:7px;">
            {footer_text if footer_text else ''}
        </div>
        <div style="margin-top:6px;font-size:7px;text-align:left;">
            Vérifiez votre ticket avant de partir.<br>
            Ce ticket doit être payé une seule fois<br>
            dans les 90 jours. Le premier qui<br>
            présente ce ticket est bénéficiaire.<br>
            Si le numéro est effacé, on ne paie pas.<br>
            Protégez le ticket de la chaleur et humidité.
        </div>
        <div class="footer-url" style="margin-top:6px;font-weight:bold;">LOTTOLAB.TECH</div>
    </div>
    
    <div class="separator">================================</div>
    
    {'<script>window.onload = function() { setTimeout(function() { window.print(); }, 300); }</script>' if auto else ''}
</body>
</html>"""
    
    return HTMLResponse(content=html)


# ============================================================================
# API ENDPOINT FOR TICKET DATA (for frontend use)
# ============================================================================

@ticket_print_router.get("/api/ticket/{ticket_id}/print-data")
async def get_ticket_print_data(ticket_id: str):
    """Get ticket data for client-side rendering"""
    # Try both collections
    ticket = await db.lottery_transactions.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        ticket = await db.tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    # Get company info
    company = await db.companies.find_one(
        {"company_id": ticket.get("company_id")},
        {"_id": 0, "name": 1, "logo_url": 1, "currency": 1}
    )
    
    # Get company settings
    settings = await db.company_settings.find_one(
        {"company_id": ticket.get("company_id")},
        {"_id": 0}
    )
    
    # Get succursale
    succursale = None
    if ticket.get("succursale_id"):
        succursale = await db.succursales.find_one(
            {"succursale_id": ticket.get("succursale_id")},
            {"_id": 0, "nom_succursale": 1}
        )
    
    # Get agent info for POS serial
    agent = await db.users.find_one(
        {"user_id": ticket.get("agent_id")},
        {"_id": 0, "name": 1, "full_name": 1, "pos_serial_number": 1}
    )
    
    verification_code = ticket.get("verification_code", "")
    
    return {
        "ticket": ticket,
        "company": company,
        "settings": settings,
        "succursale": succursale,
        "agent": agent,
        "qr_url": f"https://lotopam.com/verify-ticket/{verification_code}",
        "verification_code": verification_code
    }
