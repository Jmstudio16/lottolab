"""
LOTTOLAB - Professional POS 80mm Ticket Printing System
Handles ticket generation, verification, and professional thermal printing
Optimized for thermal POS printers (80mm width)
Uses unified ticket_template.py for consistent formatting
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
from ticket_template import generate_ticket_html, generate_combined_paginated_html

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
# PRINT TICKET - 80mm POS Thermal Format (Uses unified template)
# ============================================================================

@ticket_print_router.get("/ticket/print/{ticket_id}", response_class=HTMLResponse)
async def print_ticket_80mm(
    ticket_id: str,
    token: Optional[str] = None,
    auto: bool = False,
    format: str = "thermal",
    paginate: bool = True
):
    """
    Generate 80mm POS thermal printer optimized ticket.
    Uses unified ticket_template.py for consistent formatting.
    Supports smart pagination for long tickets (>15 plays).
    
    Args:
        ticket_id: ID of the ticket to print
        token: Auth token (optional)
        auto: Auto-print on load
        format: Output format (thermal, pdf)
        paginate: Enable smart pagination for long tickets
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
    
    # Get agent info
    agent = await db.users.find_one(
        {"user_id": ticket.get("agent_id")},
        {"_id": 0, "name": 1, "full_name": 1, "pos_serial_number": 1, "branch_id": 1}
    )
    
    # Get branch/succursale info
    branch_id = ticket.get("branch_id") or ticket.get("succursale_id")
    branch = None
    if branch_id:
        branch = await db.branches.find_one({"branch_id": branch_id}, {"_id": 0, "name": 1})
        if not branch:
            branch = await db.succursales.find_one(
                {"succursale_id": branch_id},
                {"_id": 0, "name": 1, "nom_succursale": 1}
            )
    
    # If no branch from ticket, try agent's branch
    if not branch and agent and agent.get("branch_id"):
        branch = await db.branches.find_one({"branch_id": agent.get("branch_id")}, {"_id": 0, "name": 1})
        if not branch:
            branch = await db.succursales.find_one(
                {"succursale_id": agent.get("branch_id")},
                {"_id": 0, "name": 1, "nom_succursale": 1}
            )
    
    # Check if ticket needs pagination (more than 15 plays)
    plays = ticket.get("plays", [])
    use_pagination = paginate and len(plays) > 15
    
    if use_pagination:
        # Generate HTML with smart pagination
        html = generate_combined_paginated_html(
            ticket=ticket,
            company=company,
            agent=agent,
            branch=branch,
            auto_print=auto,
            base_url="https://lottolab.tech"
        )
    else:
        # Generate standard single-page ticket
        html = generate_ticket_html(
            ticket=ticket,
            company=company,
            agent=agent,
            branch=branch,
            auto_print=auto,
            base_url="https://lottolab.tech"
        )
    
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
