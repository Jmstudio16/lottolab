"""
LOTTOLAB - Professional POS 80mm Ticket Printing System
Handles ticket generation, verification, and professional thermal printing
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
        existing = await db.tickets.find_one({"verification_code": code})
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
# PRINT TICKET - 80mm POS Format
# ============================================================================

@ticket_print_router.get("/ticket/print/{ticket_id}", response_class=HTMLResponse)
async def print_ticket_80mm(
    ticket_id: str,
    auto: bool = False
):
    """
    Generate 80mm POS thermal printer optimized ticket.
    Returns HTML page optimized for window.print()
    """
    ticket = await db.tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Get company info
    company = await db.companies.find_one(
        {"company_id": ticket.get("company_id")},
        {"_id": 0}
    )
    
    # Get company settings for receipt customization
    settings = await db.company_settings.find_one(
        {"company_id": ticket.get("company_id")},
        {"_id": 0}
    )
    
    company_name = company.get("name", "LOTTOLAB") if company else "LOTTOLAB"
    company_logo = company.get("logo_url", "") if company else ""
    receipt_header = settings.get("receipt_header", "©️ JM STUDIO") if settings else "©️ JM STUDIO"
    receipt_footer = settings.get("receipt_footer", "Merci de votre confiance!") if settings else "Merci de votre confiance!"
    currency = ticket.get("currency", "HTG")
    
    # Get succursale and agent info
    succursale = None
    if ticket.get("succursale_id"):
        succursale = await db.succursales.find_one(
            {"succursale_id": ticket.get("succursale_id")},
            {"_id": 0, "nom_succursale": 1, "adresse": 1}
        )
    
    # Generate QR code URL
    verification_code = ticket.get("verification_code", "")
    qr_url = f"https://lotopam.com/verify-ticket/{verification_code}"
    
    # Build plays table
    plays_rows = ""
    for play in ticket.get("plays", []):
        numbers = play.get("numbers", "N/A")
        bet_type = play.get("bet_type", "N/A")
        amount = play.get("amount", 0)
        plays_rows += f"""
        <tr>
            <td class="numbers">{numbers}</td>
            <td class="type">{bet_type}</td>
            <td class="amount">{amount}</td>
        </tr>
        """
    
    # Format date
    created_at = ticket.get("created_at", "")
    if created_at:
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            formatted_date = dt.strftime("%d/%m/%Y %H:%M")
        except:
            formatted_date = created_at[:16] if len(created_at) > 16 else created_at
    else:
        formatted_date = "N/A"
    
    # Status text
    status_map = {
        "ACTIVE": "EN ATTENTE",
        "PENDING_RESULT": "EN ATTENTE",
        "WINNER": "GAGNANT",
        "LOSER": "NON GAGNANT",
        "VOID": "ANNULÉ",
        "PAID": "PAYÉ"
    }
    status = status_map.get(ticket.get("status"), ticket.get("status", "N/A"))
    
    # Void info if cancelled
    void_section = ""
    if ticket.get("status") == "VOID":
        void_section = f"""
        <div class="void-banner">*** TICKET ANNULÉ ***</div>
        <div class="void-reason">Raison: {ticket.get('void_reason', 'N/A')}</div>
        <div class="void-date">Annulé le: {ticket.get('voided_at', 'N/A')[:16] if ticket.get('voided_at') else 'N/A'}</div>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=80mm">
        <title>Ticket #{ticket.get('ticket_code', 'N/A')}</title>
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
                font-size: 12px;
                width: 80mm;
                padding: 4mm;
                background: white;
                color: black;
            }}
            .header {{
                text-align: center;
                border-bottom: 2px dashed black;
                padding-bottom: 8px;
                margin-bottom: 8px;
            }}
            .company-name {{
                font-size: 18px;
                font-weight: bold;
                text-transform: uppercase;
            }}
            .slogan {{
                font-size: 10px;
                margin: 4px 0;
            }}
            .divider {{
                border-top: 1px dashed black;
                margin: 8px 0;
            }}
            .info-section {{
                margin: 8px 0;
            }}
            .info-row {{
                display: flex;
                justify-content: space-between;
                margin: 2px 0;
            }}
            .ticket-number {{
                font-size: 14px;
                font-weight: bold;
                text-align: center;
                margin: 8px 0;
                padding: 4px;
                border: 1px solid black;
            }}
            .plays-table {{
                width: 100%;
                border-collapse: collapse;
                margin: 8px 0;
            }}
            .plays-table th {{
                border-bottom: 1px solid black;
                padding: 4px 0;
                text-align: left;
                font-size: 10px;
            }}
            .plays-table td {{
                padding: 4px 0;
                border-bottom: 1px dashed #ccc;
            }}
            .plays-table .numbers {{
                font-weight: bold;
                font-size: 14px;
            }}
            .plays-table .type {{
                font-size: 10px;
            }}
            .plays-table .amount {{
                text-align: right;
                font-weight: bold;
            }}
            .total-section {{
                border-top: 2px solid black;
                padding-top: 8px;
                margin-top: 8px;
                text-align: center;
            }}
            .total-label {{
                font-size: 12px;
            }}
            .total-amount {{
                font-size: 20px;
                font-weight: bold;
            }}
            .status-badge {{
                text-align: center;
                font-size: 12px;
                font-weight: bold;
                padding: 4px 8px;
                margin: 8px 0;
                border: 1px solid black;
            }}
            .qr-section {{
                text-align: center;
                margin: 12px 0;
            }}
            .qr-section img {{
                width: 100px;
                height: 100px;
            }}
            .verification-code {{
                font-size: 14px;
                font-weight: bold;
                text-align: center;
                letter-spacing: 2px;
                margin: 8px 0;
                padding: 4px;
                background: #f0f0f0;
            }}
            .footer {{
                text-align: center;
                border-top: 2px dashed black;
                padding-top: 8px;
                margin-top: 8px;
                font-size: 10px;
            }}
            .footer p {{
                margin: 2px 0;
            }}
            .void-banner {{
                background: black;
                color: white;
                text-align: center;
                font-size: 14px;
                font-weight: bold;
                padding: 8px;
                margin: 8px 0;
            }}
            .void-reason, .void-date {{
                text-align: center;
                font-size: 10px;
                color: #666;
            }}
            @media print {{
                body {{
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }}
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-name">{company_name}</div>
            <div class="slogan">{receipt_header}</div>
        </div>
        
        <div class="info-section">
            {f'<div class="info-row"><span>Company:</span><span>{company_name}</span></div>' if company_name else ''}
            {f'<div class="info-row"><span>Succursale:</span><span>{succursale.get("nom_succursale", "N/A")}</span></div>' if succursale else ''}
            <div class="info-row"><span>Agent:</span><span>{ticket.get('agent_name', 'N/A')}</span></div>
        </div>
        
        <div class="ticket-number">
            Ticket #: {ticket.get('ticket_code', 'N/A')}
        </div>
        
        <div class="info-section">
            <div class="info-row"><span>Date:</span><span>{formatted_date}</span></div>
        </div>
        
        <div class="divider"></div>
        
        <div class="info-section">
            <div class="info-row"><span>Loterie:</span><span>{ticket.get('lottery_name', 'N/A')}</span></div>
            <div class="info-row"><span>Tirage:</span><span>{ticket.get('draw_name', ticket.get('draw_datetime', 'N/A'))}</span></div>
            <div class="info-row"><span>Statut:</span><span>{status}</span></div>
        </div>
        
        {void_section}
        
        <div class="divider"></div>
        
        <table class="plays-table">
            <thead>
                <tr>
                    <th>NUMEROS</th>
                    <th>TYPE</th>
                    <th style="text-align:right">MONTANT</th>
                </tr>
            </thead>
            <tbody>
                {plays_rows}
            </tbody>
        </table>
        
        <div class="divider"></div>
        
        <div class="total-section">
            <div class="total-label">TOTAL:</div>
            <div class="total-amount">{ticket.get('total_amount', 0):,.0f} {currency}</div>
        </div>
        
        <div class="divider"></div>
        
        <div style="text-align:center;margin:8px 0;">
            <div style="font-size:10px;color:#666;">GAIN POTENTIEL MAX:</div>
            <div style="font-size:16px;font-weight:bold;">{ticket.get('potential_win', 0):,.0f} {currency}</div>
        </div>
        
        <div class="divider"></div>
        
        <div class="verification-code">
            Code Vérification:<br>
            {verification_code}
        </div>
        
        <div class="qr-section">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data={qr_url}" alt="QR Code">
            <p style="font-size:9px;margin-top:4px;">Scannez pour vérifier<br>vos résultats en ligne</p>
        </div>
        
        <div class="footer">
            <p>Stop ventes: 5 min avant tirage</p>
            <p>{receipt_footer}</p>
        </div>
        
        {'<script>window.onload = function() { window.print(); }</script>' if auto else ''}
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)


# ============================================================================
# API ENDPOINT FOR TICKET DATA (for frontend use)
# ============================================================================

@ticket_print_router.get("/api/ticket/{ticket_id}/print-data")
async def get_ticket_print_data(ticket_id: str):
    """Get ticket data for client-side rendering"""
    ticket = await db.tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
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
    
    verification_code = ticket.get("verification_code", "")
    
    return {
        "ticket": ticket,
        "company": company,
        "settings": settings,
        "succursale": succursale,
        "qr_url": f"https://lotopam.com/verify-ticket/{verification_code}",
        "verification_code": verification_code
    }
