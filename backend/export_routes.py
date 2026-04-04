"""
Export & Validation Routes - Export Excel/PDF + Blocked Numbers + Bet Limits
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from io import BytesIO
import xlsxwriter
import base64
import os

# ReportLab for PDF
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from auth import decode_token
from utils import get_current_timestamp, generate_id

export_router = APIRouter(prefix="/api/export", tags=["Export & Reports"])

# Database connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "lottolab")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

security = HTTPBearer()

async def get_company_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Authenticate company user"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    if payload.get("role") not in ["COMPANY_ADMIN", "COMPANY_MANAGER", "SUPER_ADMIN", "BRANCH_SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    return payload


# ============================================================================
# EXPORT EXCEL/PDF
# ============================================================================

@export_router.get("/tickets/excel")
async def export_tickets_excel(
    current_user: dict = Depends(get_company_user),
    date_from: str = None,
    date_to: str = None,
    vendeur_id: str = None,
    lottery_id: str = None,
    status: str = None
):
    """
    Export tickets to Excel format.
    Columns: ID, Code, Vendeur, Loterie, Numéros, Montant, Date, Statut
    """
    company_id = current_user.get("company_id")
    
    # Build query
    query = {}
    if company_id and current_user.get("role") != "SUPER_ADMIN":
        query["company_id"] = company_id
    
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    if vendeur_id:
        query["agent_id"] = vendeur_id
    if lottery_id:
        query["lottery_id"] = lottery_id
    if status:
        query["status"] = status
    
    # Fetch tickets
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(10000).to_list(10000)
    
    # Create Excel file
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet("Tickets")
    
    # Styles
    header_format = workbook.add_format({
        'bold': True,
        'bg_color': '#2D3748',
        'font_color': 'white',
        'border': 1,
        'align': 'center',
        'valign': 'vcenter'
    })
    money_format = workbook.add_format({'num_format': '#,##0.00', 'border': 1})
    date_format = workbook.add_format({'num_format': 'dd/mm/yyyy hh:mm', 'border': 1})
    cell_format = workbook.add_format({'border': 1})
    winner_format = workbook.add_format({'bg_color': '#48BB78', 'border': 1, 'font_color': 'white'})
    loser_format = workbook.add_format({'bg_color': '#F56565', 'border': 1, 'font_color': 'white'})
    
    # Headers
    headers = ["ID Ticket", "Code", "Vendeur", "Loterie", "Tirage", "Numéros", "Montant (HTG)", "Date", "Statut", "Gain (HTG)"]
    for col, header in enumerate(headers):
        worksheet.write(0, col, header, header_format)
        worksheet.set_column(col, col, 15)
    
    # Data
    total_sales = 0
    total_winnings = 0
    
    for row, ticket in enumerate(tickets, start=1):
        # Extract numbers
        plays = ticket.get("plays", [])
        numbers = ", ".join([p.get("numbers", "") for p in plays])
        
        worksheet.write(row, 0, ticket.get("ticket_id", ""), cell_format)
        worksheet.write(row, 1, ticket.get("ticket_code", ""), cell_format)
        worksheet.write(row, 2, ticket.get("agent_name", ""), cell_format)
        worksheet.write(row, 3, ticket.get("lottery_name", ""), cell_format)
        worksheet.write(row, 4, ticket.get("draw_name", ""), cell_format)
        worksheet.write(row, 5, numbers, cell_format)
        worksheet.write(row, 6, ticket.get("total_amount", 0), money_format)
        worksheet.write(row, 7, ticket.get("created_at", "")[:16].replace("T", " "), cell_format)
        
        status = ticket.get("status", "")
        status_format = winner_format if status == "WINNER" else (loser_format if status == "LOSER" else cell_format)
        worksheet.write(row, 8, status, status_format)
        worksheet.write(row, 9, ticket.get("winnings", 0) or 0, money_format)
        
        total_sales += ticket.get("total_amount", 0)
        total_winnings += ticket.get("winnings", 0) or 0
    
    # Summary row
    summary_row = len(tickets) + 2
    worksheet.write(summary_row, 5, "TOTAUX:", header_format)
    worksheet.write(summary_row, 6, total_sales, money_format)
    worksheet.write(summary_row, 9, total_winnings, money_format)
    
    workbook.close()
    output.seek(0)
    
    filename = f"tickets_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@export_router.get("/tickets/pdf")
async def export_tickets_pdf(
    current_user: dict = Depends(get_company_user),
    date_from: str = None,
    date_to: str = None,
    vendeur_id: str = None,
    lottery_id: str = None,
    status: str = None
):
    """
    Export tickets to PDF format with summary table.
    """
    company_id = current_user.get("company_id")
    
    # Build query
    query = {}
    if company_id and current_user.get("role") != "SUPER_ADMIN":
        query["company_id"] = company_id
    
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    if vendeur_id:
        query["agent_id"] = vendeur_id
    if lottery_id:
        query["lottery_id"] = lottery_id
    if status:
        query["status"] = status
    
    # Fetch tickets
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    
    # Get company info
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    company_name = company.get("name", "LottoLab") if company else "LottoLab"
    
    # Create PDF
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], alignment=TA_CENTER, fontSize=18)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], alignment=TA_CENTER, fontSize=10, textColor=colors.grey)
    
    elements = []
    
    # Title
    elements.append(Paragraph(f"Rapport des Ventes - {company_name}", title_style))
    elements.append(Spacer(1, 10))
    
    # Date range
    date_str = f"Période: {date_from or 'Début'} à {date_to or 'Maintenant'}"
    elements.append(Paragraph(date_str, subtitle_style))
    elements.append(Paragraph(f"Généré le: {datetime.now().strftime('%d/%m/%Y %H:%M')}", subtitle_style))
    elements.append(Spacer(1, 20))
    
    # Summary
    total_tickets = len(tickets)
    total_sales = sum(t.get("total_amount", 0) for t in tickets)
    total_winnings = sum(t.get("winnings", 0) or 0 for t in tickets)
    winners = len([t for t in tickets if t.get("status") == "WINNER"])
    
    summary_data = [
        ["Statistiques", "Valeur"],
        ["Total Tickets", str(total_tickets)],
        ["Total Ventes", f"{total_sales:,.0f} HTG"],
        ["Total Gains Payés", f"{total_winnings:,.0f} HTG"],
        ["Tickets Gagnants", str(winners)],
        ["Profit/Perte", f"{total_sales - total_winnings:,.0f} HTG"]
    ]
    
    summary_table = Table(summary_data, colWidths=[200, 150])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2D3748')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F7FAFC')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0'))
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 30))
    
    # Tickets table
    elements.append(Paragraph("Détail des Tickets", styles['Heading2']))
    elements.append(Spacer(1, 10))
    
    ticket_data = [["Code", "Vendeur", "Loterie", "Numéros", "Montant", "Statut"]]
    
    for ticket in tickets[:100]:  # Limit to 100 for PDF
        plays = ticket.get("plays", [])
        numbers = ", ".join([p.get("numbers", "") for p in plays[:3]])
        if len(plays) > 3:
            numbers += "..."
        
        ticket_data.append([
            ticket.get("ticket_code", "")[:12],
            ticket.get("agent_name", "")[:15],
            ticket.get("lottery_name", "")[:15],
            numbers[:20],
            f"{ticket.get('total_amount', 0):,.0f}",
            ticket.get("status", "")
        ])
    
    ticket_table = Table(ticket_data, colWidths=[70, 80, 90, 80, 60, 60])
    ticket_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2D3748')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F7FAFC')])
    ]))
    elements.append(ticket_table)
    
    doc.build(elements)
    output.seek(0)
    
    filename = f"rapport_ventes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================================================
# BLOCKED NUMBERS MANAGEMENT
# ============================================================================

class BlockedNumberRequest(BaseModel):
    lottery_id: str
    draw_date: str
    blocked_numbers: List[str]
    reason: Optional[str] = None


@export_router.post("/blocked-numbers")
async def add_blocked_numbers(
    request: BlockedNumberRequest,
    current_user: dict = Depends(get_company_user)
):
    """Add blocked numbers for a specific lottery and draw date"""
    company_id = current_user.get("company_id")
    
    blocked_entry = {
        "id": generate_id("blocked_"),
        "company_id": company_id,
        "lottery_id": request.lottery_id,
        "draw_date": request.draw_date,
        "blocked_numbers": request.blocked_numbers,
        "reason": request.reason or "Blocage manuel",
        "created_by": current_user.get("user_id"),
        "created_at": get_current_timestamp(),
        "is_active": True
    }
    
    # Upsert - update if exists for same lottery/date
    await db.blocked_numbers.update_one(
        {
            "company_id": company_id,
            "lottery_id": request.lottery_id,
            "draw_date": request.draw_date
        },
        {"$set": blocked_entry},
        upsert=True
    )
    
    return {"message": f"Numéros bloqués ajoutés: {', '.join(request.blocked_numbers)}", "blocked": blocked_entry}


@export_router.get("/blocked-numbers")
async def get_blocked_numbers(
    current_user: dict = Depends(get_company_user),
    lottery_id: str = None,
    draw_date: str = None
):
    """Get blocked numbers for a company"""
    company_id = current_user.get("company_id")
    
    query = {"company_id": company_id, "is_active": True}
    if lottery_id:
        query["lottery_id"] = lottery_id
    if draw_date:
        query["draw_date"] = draw_date
    
    blocked = await db.blocked_numbers.find(query, {"_id": 0}).to_list(100)
    return blocked


@export_router.delete("/blocked-numbers/{blocked_id}")
async def remove_blocked_numbers(
    blocked_id: str,
    current_user: dict = Depends(get_company_user)
):
    """Remove blocked numbers entry"""
    company_id = current_user.get("company_id")
    
    result = await db.blocked_numbers.update_one(
        {"id": blocked_id, "company_id": company_id},
        {"$set": {"is_active": False, "deactivated_at": get_current_timestamp()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Entrée non trouvée")
    
    return {"message": "Numéros débloqués"}


# ============================================================================
# BET LIMITS CONFIGURATION
# ============================================================================

class BetLimitsRequest(BaseModel):
    lottery_id: Optional[str] = None  # None = global for all lotteries
    min_bet: float = 1.0
    max_bet: float = 10000.0
    max_bet_per_number: float = 5000.0
    max_total_per_ticket: float = 50000.0
    is_active: bool = True


@export_router.post("/bet-limits")
async def set_bet_limits(
    request: BetLimitsRequest,
    current_user: dict = Depends(get_company_user)
):
    """Set bet limits for a lottery or globally"""
    company_id = current_user.get("company_id")
    
    limits = {
        "id": generate_id("limit_"),
        "company_id": company_id,
        "lottery_id": request.lottery_id,  # None = global
        "min_bet": request.min_bet,
        "max_bet": request.max_bet,
        "max_bet_per_number": request.max_bet_per_number,
        "max_total_per_ticket": request.max_total_per_ticket,
        "is_active": request.is_active,
        "updated_by": current_user.get("user_id"),
        "updated_at": get_current_timestamp()
    }
    
    # Upsert
    await db.bet_limits.update_one(
        {
            "company_id": company_id,
            "lottery_id": request.lottery_id
        },
        {"$set": limits},
        upsert=True
    )
    
    return {"message": "Limites de mise configurées", "limits": limits}


@export_router.get("/bet-limits")
async def get_bet_limits(
    current_user: dict = Depends(get_company_user),
    lottery_id: str = None
):
    """Get bet limits for a company"""
    company_id = current_user.get("company_id")
    
    query = {"company_id": company_id, "is_active": True}
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    limits = await db.bet_limits.find(query, {"_id": 0}).to_list(100)
    
    # Also get global limits
    global_limits = await db.bet_limits.find_one(
        {"company_id": company_id, "lottery_id": None, "is_active": True},
        {"_id": 0}
    )
    
    return {
        "specific_limits": limits,
        "global_limits": global_limits
    }


# ============================================================================
# VALIDATION HELPER FUNCTIONS (to be used by vendeur routes)
# ============================================================================

async def validate_ticket_sale(company_id: str, lottery_id: str, draw_date: str, plays: list):
    """
    Validate a ticket sale against blocked numbers and bet limits.
    Returns (is_valid, error_message)
    """
    errors = []
    
    # 1. Check blocked numbers
    blocked_entry = await db.blocked_numbers.find_one({
        "company_id": company_id,
        "lottery_id": lottery_id,
        "draw_date": draw_date,
        "is_active": True
    }, {"_id": 0})
    
    if blocked_entry:
        blocked_nums = blocked_entry.get("blocked_numbers", [])
        for play in plays:
            num = play.get("numbers", "")
            if num in blocked_nums:
                errors.append(f"Numéro [{num}] bloqué pour cette loterie")
    
    # 2. Check bet limits
    # First try specific lottery limits
    limits = await db.bet_limits.find_one({
        "company_id": company_id,
        "lottery_id": lottery_id,
        "is_active": True
    }, {"_id": 0})
    
    # If no specific limits, use global
    if not limits:
        limits = await db.bet_limits.find_one({
            "company_id": company_id,
            "lottery_id": None,
            "is_active": True
        }, {"_id": 0})
    
    # If still no limits, use company config
    if not limits:
        config = await db.company_configurations.find_one(
            {"company_id": company_id},
            {"_id": 0}
        )
        if config:
            limits = {
                "min_bet": config.get("min_bet_amount", 1),
                "max_bet": config.get("max_bet_amount", 10000),
                "max_bet_per_number": config.get("max_bet_per_number", 5000),
                "max_total_per_ticket": 50000
            }
    
    if limits:
        max_bet = limits.get("max_bet", 10000)
        max_per_num = limits.get("max_bet_per_number", 5000)
        max_total = limits.get("max_total_per_ticket", 50000)
        
        total_amount = 0
        for play in plays:
            amount = play.get("amount", 0)
            num = play.get("numbers", "")
            total_amount += amount
            
            # NO minimum validation - only check maximum
            if amount > max_per_num:
                errors.append(f"Mise maximum {max_per_num} HTG par numéro ({num}: {amount} HTG)")
        
        if total_amount > max_total:
            errors.append(f"Total ticket ({total_amount} HTG) dépasse le maximum ({max_total} HTG)")
    
    if errors:
        return False, errors
    
    return True, None


# ============================================================================
# COMPANY LOGO MANAGEMENT
# ============================================================================

@export_router.post("/company/logo")
async def upload_company_logo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_company_user)
):
    """Upload company logo for ticket printing"""
    company_id = current_user.get("company_id")
    
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Le fichier doit être une image")
    
    # Read and encode to base64
    contents = await file.read()
    
    # Limit file size (500KB)
    if len(contents) > 500 * 1024:
        raise HTTPException(status_code=400, detail="Taille maximum: 500KB")
    
    logo_data = base64.b64encode(contents).decode('utf-8')
    
    # Update company settings
    await db.companies.update_one(
        {"company_id": company_id},
        {
            "$set": {
                "logo_base64": logo_data,
                "logo_content_type": file.content_type,
                "logo_updated_at": get_current_timestamp()
            }
        }
    )
    
    return {"message": "Logo uploadé avec succès"}


@export_router.get("/company/logo")
async def get_company_logo(current_user: dict = Depends(get_company_user)):
    """Get company logo"""
    company_id = current_user.get("company_id")
    
    company = await db.companies.find_one(
        {"company_id": company_id},
        {"_id": 0, "logo_base64": 1, "logo_content_type": 1}
    )
    
    if not company or not company.get("logo_base64"):
        raise HTTPException(status_code=404, detail="Logo non configuré")
    
    return {
        "logo_base64": company.get("logo_base64"),
        "content_type": company.get("logo_content_type", "image/png")
    }


class TicketSettingsRequest(BaseModel):
    show_logo: bool = True
    show_company_name: bool = True
    show_address: bool = True
    show_phone: bool = True
    show_qr_code: bool = True
    header_text: Optional[str] = None
    footer_text: Optional[str] = None
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None


@export_router.post("/company/ticket-settings")
async def update_ticket_settings(
    request: TicketSettingsRequest,
    current_user: dict = Depends(get_company_user)
):
    """Update ticket print settings"""
    company_id = current_user.get("company_id")
    
    settings = {
        "ticket_show_logo": request.show_logo,
        "ticket_show_company_name": request.show_company_name,
        "ticket_show_address": request.show_address,
        "ticket_show_phone": request.show_phone,
        "ticket_show_qr_code": request.show_qr_code,
        "ticket_header_text": request.header_text,
        "ticket_footer_text": request.footer_text,
        "ticket_company_name": request.company_name,
        "ticket_company_address": request.company_address,
        "ticket_company_phone": request.company_phone,
        "ticket_settings_updated_at": get_current_timestamp()
    }
    
    await db.companies.update_one(
        {"company_id": company_id},
        {"$set": settings}
    )
    
    return {"message": "Paramètres du ticket mis à jour"}


@export_router.get("/company/ticket-settings")
async def get_ticket_settings(current_user: dict = Depends(get_company_user)):
    """Get ticket print settings"""
    company_id = current_user.get("company_id")
    
    company = await db.companies.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    return {
        "show_logo": company.get("ticket_show_logo", True),
        "show_company_name": company.get("ticket_show_company_name", True),
        "show_address": company.get("ticket_show_address", True),
        "show_phone": company.get("ticket_show_phone", True),
        "show_qr_code": company.get("ticket_show_qr_code", True),
        "header_text": company.get("ticket_header_text"),
        "footer_text": company.get("ticket_footer_text"),
        "company_name": company.get("ticket_company_name") or company.get("name"),
        "company_address": company.get("ticket_company_address") or company.get("address"),
        "company_phone": company.get("ticket_company_phone") or company.get("phone"),
        "logo_exists": bool(company.get("logo_base64"))
    }



# ============================================================================
# TICKET PDF GENERATION (Individual Ticket)
# ============================================================================

@export_router.get("/ticket/pdf/{ticket_id}")
async def generate_single_ticket_pdf(
    ticket_id: str,
    token: Optional[str] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Generate professional PDF for a single ticket.
    Can be shared via WhatsApp, Email, etc.
    """
    from ticket_template import generate_ticket_html
    
    # Get token
    auth_token = token or (credentials.credentials if credentials else None)
    if not auth_token:
        raise HTTPException(status_code=401, detail="Token requis")
    
    payload = decode_token(auth_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    company_id = payload.get("company_id")
    
    # Find ticket
    ticket = await db.lottery_transactions.find_one({
        "ticket_id": ticket_id
    }, {"_id": 0})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    
    # Get company info
    company = await db.companies.find_one({"company_id": ticket.get("company_id")}, {"_id": 0})
    
    # Get agent info
    agent = await db.users.find_one(
        {"user_id": ticket.get("agent_id")},
        {"_id": 0, "name": 1, "full_name": 1, "pos_serial_number": 1, "branch_id": 1}
    )
    
    # Get branch info
    branch_id = ticket.get("branch_id") or ticket.get("succursale_id")
    branch = None
    if branch_id:
        branch = await db.branches.find_one({"branch_id": branch_id}, {"_id": 0})
        if not branch:
            branch = await db.succursales.find_one({"succursale_id": branch_id}, {"_id": 0})
    
    # Generate HTML for PDF
    html_content = generate_ticket_html(
        ticket=ticket,
        company=company,
        agent=agent,
        branch=branch,
        auto_print=False,
        base_url="https://lottolab.tech"
    )
    
    # Create PDF using ReportLab
    buffer = BytesIO()
    
    # PDF with 80mm width (approximately 226 points)
    from reportlab.lib.pagesizes import mm
    page_width = 80 * mm
    page_height = 200 * mm  # Variable height
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=(page_width, page_height),
        rightMargin=5*mm,
        leftMargin=5*mm,
        topMargin=5*mm,
        bottomMargin=5*mm
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles for ticket
    title_style = ParagraphStyle(
        'TicketTitle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=6
    )
    
    normal_style = ParagraphStyle(
        'TicketNormal',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=10,
        alignment=TA_CENTER,
        spaceAfter=3
    )
    
    small_style = ParagraphStyle(
        'TicketSmall',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        alignment=TA_CENTER,
        spaceAfter=2
    )
    
    elements = []
    
    # Company name
    company_name = company.get("name", "LOTTOLAB") if company else "LOTTOLAB"
    elements.append(Paragraph(f"<b>{company_name}</b>", title_style))
    
    # Phone/Address
    if company:
        if company.get("phone"):
            elements.append(Paragraph(f"Tél: {company.get('phone')}", small_style))
        if company.get("address"):
            elements.append(Paragraph(company.get("address"), small_style))
    
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("=" * 35, normal_style))
    
    # Ticket info
    agent_name = agent.get("name") or agent.get("full_name") if agent else ticket.get("agent_name", "Vendeur")
    branch_name = branch.get("name") or branch.get("nom_succursale") if branch else "Principal"
    
    elements.append(Paragraph(f"VENDEUR: {agent_name}", normal_style))
    elements.append(Paragraph(f"SUCCURSALE: {branch_name}", normal_style))
    elements.append(Paragraph(f"TICKET: {ticket.get('ticket_code', ticket_id[:12])}", normal_style))
    
    elements.append(Spacer(1, 5))
    elements.append(Paragraph("-" * 35, normal_style))
    
    # Lottery info
    elements.append(Paragraph(f"LOTERIE: {ticket.get('lottery_name', 'N/A')}", normal_style))
    elements.append(Paragraph(f"TIRAGE: {ticket.get('draw_name', 'Standard')}", normal_style))
    
    created = ticket.get("created_at", "")
    if created:
        date_str = created[:10] if len(created) >= 10 else created
        time_str = created[11:19] if len(created) >= 19 else ""
        elements.append(Paragraph(f"DATE: {date_str}", normal_style))
        elements.append(Paragraph(f"HEURE: {time_str}", normal_style))
    
    elements.append(Spacer(1, 5))
    elements.append(Paragraph("-" * 35, normal_style))
    elements.append(Paragraph("<b>NUMÉROS JOUÉS</b>", normal_style))
    
    # Plays
    for play in ticket.get("plays", []):
        numbers = play.get("numbers", "-")
        amount = play.get("amount", 0)
        elements.append(Paragraph(f"{numbers} ............. {amount} HTG", normal_style))
    
    elements.append(Spacer(1, 5))
    elements.append(Paragraph("-" * 35, normal_style))
    
    # Total
    total = ticket.get("total_amount", 0)
    elements.append(Paragraph(f"<b>TOTAL: {total} HTG</b>", title_style))
    
    elements.append(Spacer(1, 5))
    elements.append(Paragraph("=" * 35, normal_style))
    elements.append(Paragraph("<b>STATUT: VALIDÉ</b>", title_style))
    elements.append(Paragraph("=" * 35, normal_style))
    
    # Footer
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(f"MERCI DE JOUER AVEC<br/>{company_name}", normal_style))
    elements.append(Spacer(1, 5))
    elements.append(Paragraph("-" * 35, small_style))
    elements.append(Paragraph("Ticket valable 90 jours", small_style))
    elements.append(Paragraph("Paiement UNE SEULE FOIS", small_style))
    elements.append(Paragraph("-" * 35, small_style))
    elements.append(Paragraph("<b>LOTTOLAB.TECH</b>", normal_style))
    
    # Build PDF
    doc.build(elements)
    
    buffer.seek(0)
    
    ticket_code = ticket.get('ticket_code', ticket_id[:12])
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=ticket_{ticket_code}.pdf"
        }
    )


# ============================================================================
# TICKET CONFIGURATION FOR ADMIN
# ============================================================================

class TicketTextConfig(BaseModel):
    slogan: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    ticket_header_text: Optional[str] = None
    ticket_footer_text: Optional[str] = None
    ticket_thank_you_text: Optional[str] = None
    ticket_legal_text: Optional[str] = None
    qr_code_enabled: Optional[bool] = True
    ticket_font_size: Optional[str] = "normal"  # small, normal, large
    paper_width: Optional[str] = "80mm"  # 58mm, 80mm


@export_router.get("/ticket-text-config")
async def get_ticket_text_config(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get all ticket text configuration for admin editing"""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    company_id = payload.get("company_id")
    
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Compagnie non trouvée")
    
    return {
        "company_name": company.get("name", ""),
        "slogan": company.get("slogan", "JOUER POU GENYEN"),
        "phone": company.get("phone", ""),
        "address": company.get("address", ""),
        "logo_url": company.get("logo_url") or company.get("company_logo_url", ""),
        "ticket_header_text": company.get("ticket_header_text", ""),
        "ticket_footer_text": company.get("ticket_footer_text", ""),
        "ticket_thank_you_text": company.get("ticket_thank_you_text", f"MERCI DE JOUER AVEC {company.get('name', 'LOTTOLAB')}"),
        "ticket_legal_text": company.get("ticket_legal_text", """Vérifiez votre ticket avant de vous déplacer.
Ce ticket doit être payé UNE SEULE FOIS dans les 90 jours.
Le PREMIER qui présente ce ticket est le bénéficiaire.
Si le numéro est effacé, on ne paie pas.
Protégez le ticket de la chaleur, humidité et ne gardez pas dans les pièces de monnaie."""),
        "qr_code_enabled": company.get("qr_code_enabled", True),
        "ticket_font_size": company.get("ticket_font_size", "normal"),
        "paper_width": company.get("paper_width", "80mm")
    }


@export_router.put("/ticket-text-config")
async def update_ticket_text_config(
    config: TicketTextConfig,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Update ticket text configuration - Admin only"""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    role = payload.get("role")
    if role not in ["SUPER_ADMIN", "COMPANY_ADMIN"]:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    
    company_id = payload.get("company_id")
    
    # Build update data from config
    update_data = {}
    if config.slogan is not None:
        update_data["slogan"] = config.slogan
    if config.phone is not None:
        update_data["phone"] = config.phone
    if config.address is not None:
        update_data["address"] = config.address
    if config.ticket_header_text is not None:
        update_data["ticket_header_text"] = config.ticket_header_text
    if config.ticket_footer_text is not None:
        update_data["ticket_footer_text"] = config.ticket_footer_text
    if config.ticket_thank_you_text is not None:
        update_data["ticket_thank_you_text"] = config.ticket_thank_you_text
    if config.ticket_legal_text is not None:
        update_data["ticket_legal_text"] = config.ticket_legal_text
    if config.qr_code_enabled is not None:
        update_data["qr_code_enabled"] = config.qr_code_enabled
    if config.ticket_font_size is not None:
        update_data["ticket_font_size"] = config.ticket_font_size
    if config.paper_width is not None:
        update_data["paper_width"] = config.paper_width
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.companies.update_one(
        {"company_id": company_id},
        {"$set": update_data}
    )
    
    return {
        "message": "Configuration du ticket mise à jour",
        "modified": result.modified_count > 0
    }



# ============================================================================
# PDF REPORT EXPORTS - Sales, Winners, Financial
# ============================================================================

@export_router.get("/reports/sales/pdf")
async def export_sales_report_pdf(
    current_user: dict = Depends(get_company_user),
    date_from: str = None,
    date_to: str = None
):
    """
    Export Sales Report to PDF format.
    Columns: #, Agent, Date, Loterie, Numéros, Type, Montant, Statut
    """
    from pdf_service import create_sales_report_pdf
    
    company_id = current_user.get("company_id")
    
    # Build query
    query = {}
    if company_id and current_user.get("role") != "SUPER_ADMIN":
        query["company_id"] = company_id
    
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to + "T23:59:59"
        else:
            query["created_at"] = {"$lte": date_to + "T23:59:59"}
    
    # Fetch tickets
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(1000).to_list(1000)
    
    # Get company name
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0, "name": 1})
    company_name = company.get("name", "LOTTOLAB") if company else "LOTTOLAB"
    
    # Format data for PDF
    sales_data = []
    for ticket in tickets:
        plays = ticket.get("plays", [])
        numbers = ", ".join([p.get("numbers", "") for p in plays[:3]])
        if len(plays) > 3:
            numbers += "..."
        
        bet_types = ", ".join(set(p.get("bet_type", "") for p in plays))
        
        sales_data.append({
            "agent_name": ticket.get("agent_name", "Agent"),
            "created_at": ticket.get("created_at", ""),
            "lottery_name": ticket.get("lottery_name", ""),
            "numbers": numbers,
            "bet_type": bet_types,
            "amount": ticket.get("total_amount", 0),
            "status": ticket.get("status", "VALIDATED")
        })
    
    # Calculate totals
    totals = {
        "total_amount": sum(t.get("total_amount", 0) for t in tickets)
    }
    
    # Generate period string
    period = "Tout"
    if date_from and date_to:
        period = f"{date_from} au {date_to}"
    elif date_from:
        period = f"Depuis {date_from}"
    elif date_to:
        period = f"Jusqu'au {date_to}"
    
    # Generate PDF
    pdf_buffer = create_sales_report_pdf(
        sales_data=sales_data,
        company_name=company_name,
        period=period,
        totals=totals
    )
    
    filename = f"rapport_ventes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@export_router.get("/reports/winners/pdf")
async def export_winners_report_pdf(
    current_user: dict = Depends(get_company_user),
    date_from: str = None,
    date_to: str = None,
    payment_status: str = None
):
    """
    Export Winners Report to PDF format.
    Columns: #, Ticket, Agent, Loterie, Numéros, Mise, Gain, Statut
    """
    from pdf_service import create_winners_report_pdf
    
    company_id = current_user.get("company_id")
    
    # Build query
    query = {"status": "WINNER"}
    if company_id and current_user.get("role") != "SUPER_ADMIN":
        query["company_id"] = company_id
    
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to + "T23:59:59"
        else:
            query["created_at"] = {"$lte": date_to + "T23:59:59"}
    
    if payment_status:
        query["payment_status"] = payment_status
    
    # Fetch winning tickets
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(1000).to_list(1000)
    
    # Get company name
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0, "name": 1})
    company_name = company.get("name", "LOTTOLAB") if company else "LOTTOLAB"
    
    # Format data for PDF
    winners_data = []
    for ticket in tickets:
        plays = ticket.get("plays", [])
        winning_numbers = ", ".join([p.get("numbers", "") for p in plays if p.get("is_winner")])
        if not winning_numbers:
            winning_numbers = ", ".join([p.get("numbers", "") for p in plays[:2]])
        
        winners_data.append({
            "ticket_id": ticket.get("ticket_code", ticket.get("ticket_id", "")),
            "agent_name": ticket.get("agent_name", "Agent"),
            "lottery_name": ticket.get("lottery_name", ""),
            "winning_numbers": winning_numbers,
            "bet_amount": ticket.get("total_amount", 0),
            "payout_amount": ticket.get("winnings", 0) or ticket.get("win_amount", 0),
            "is_paid": ticket.get("payment_status") == "PAID"
        })
    
    # Calculate totals
    totals = {
        "total_payout": sum(t.get("winnings", 0) or t.get("win_amount", 0) for t in tickets)
    }
    
    # Generate period string
    period = "Tout"
    if date_from and date_to:
        period = f"{date_from} au {date_to}"
    elif date_from:
        period = f"Depuis {date_from}"
    elif date_to:
        period = f"Jusqu'au {date_to}"
    
    # Generate PDF
    pdf_buffer = create_winners_report_pdf(
        winners_data=winners_data,
        company_name=company_name,
        period=period,
        totals=totals
    )
    
    filename = f"fiches_gagnantes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@export_router.get("/reports/financial/pdf")
async def export_financial_report_pdf(
    current_user: dict = Depends(get_company_user),
    date_from: str = None,
    date_to: str = None
):
    """
    Export Financial Report to PDF format.
    Columns: #, Agent, Tickets, Ventes, Payé, %Agent, Profit/Perte, Balance
    """
    from pdf_service import create_financial_report_pdf
    
    company_id = current_user.get("company_id")
    
    # Build date query
    date_query = {}
    if date_from:
        date_query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in date_query:
            date_query["created_at"]["$lte"] = date_to + "T23:59:59"
        else:
            date_query["created_at"] = {"$lte": date_to + "T23:59:59"}
    
    # Build main query
    query = {}
    if company_id and current_user.get("role") != "SUPER_ADMIN":
        query["company_id"] = company_id
    query.update(date_query)
    
    # Aggregation to get agent-level financials
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$agent_id",
            "agent_name": {"$first": "$agent_name"},
            "ticket_count": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"},
            "total_winnings": {"$sum": {"$ifNull": ["$winnings", 0]}},
            "total_paid": {"$sum": {"$cond": [{"$eq": ["$payment_status", "PAID"]}, {"$ifNull": ["$winnings", 0]}, 0]}}
        }},
        {"$sort": {"total_sales": -1}}
    ]
    
    agents_data = await db.lottery_transactions.aggregate(pipeline).to_list(500)
    
    # Get company name
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0, "name": 1})
    company_name = company.get("name", "LOTTOLAB") if company else "LOTTOLAB"
    
    # Format data for PDF - get commission rates for each agent
    report_data = []
    for agent in agents_data:
        agent_id = agent.get("_id")
        if not agent_id:
            continue
        
        # Get agent's commission rate
        agent_doc = await db.users.find_one(
            {"user_id": agent_id},
            {"_id": 0, "commission_percent": 1, "commission_rate": 1}
        )
        commission_percent = 0
        if agent_doc:
            commission_percent = agent_doc.get("commission_percent") or agent_doc.get("commission_rate") or 0
        
        total_sales = agent.get("total_sales", 0)
        total_paid = agent.get("total_paid", 0) or agent.get("total_winnings", 0)
        commission_amount = total_sales * (commission_percent / 100)
        profit = total_sales - total_paid - commission_amount
        balance = total_sales - commission_amount
        
        agent_name = agent.get("agent_name")
        if not agent_name:
            agent_name = f"Agent {str(agent_id)[:8]}"
        
        report_data.append({
            "agent_name": agent_name,
            "ticket_count": agent.get("ticket_count", 0),
            "total_sales": total_sales,
            "total_paid": total_paid,
            "commission_percent": commission_percent,
            "profit": profit,
            "balance": balance
        })
    
    # Calculate totals
    totals = {
        "total_sales": sum(a.get("total_sales", 0) for a in report_data),
        "total_paid": sum(a.get("total_paid", 0) for a in report_data),
        "net_profit": sum(a.get("profit", 0) for a in report_data)
    }
    
    # Generate period string
    period = "Tout"
    if date_from and date_to:
        period = f"{date_from} au {date_to}"
    elif date_from:
        period = f"Depuis {date_from}"
    elif date_to:
        period = f"Jusqu'au {date_to}"
    
    # Generate PDF
    pdf_buffer = create_financial_report_pdf(
        report_data=report_data,
        company_name=company_name,
        period=period,
        totals=totals
    )
    
    filename = f"rapport_financier_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@export_router.get("/reports/daily/pdf")
async def export_daily_report_pdf(
    current_user: dict = Depends(get_company_user),
    start_date: str = None,
    end_date: str = None
):
    """
    Export Daily Report (SGL-style) to PDF format.
    Columns: No, Agent, Tfiche, Vente, A payé, %Agent, P/P, B.Final
    """
    from pdf_service import create_daily_report_pdf
    
    company_id = current_user.get("company_id")
    
    # Default to today if no dates provided
    if not start_date:
        start_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not end_date:
        end_date = start_date
    
    # Build date query
    query = {
        "created_at": {
            "$gte": start_date,
            "$lte": end_date + "T23:59:59"
        }
    }
    if company_id and current_user.get("role") != "SUPER_ADMIN":
        query["company_id"] = company_id
    
    # Aggregation to get agent-level data
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$agent_id",
            "agent_name": {"$first": "$agent_name"},
            "ticket_count": {"$sum": 1},
            "sales": {"$sum": "$total_amount"},
            "winnings": {"$sum": {"$ifNull": ["$winnings", 0]}},
            "paid": {"$sum": {"$cond": [{"$eq": ["$payment_status", "PAID"]}, {"$ifNull": ["$winnings", 0]}, 0]}}
        }},
        {"$sort": {"sales": -1}}
    ]
    
    agents_data = await db.lottery_transactions.aggregate(pipeline).to_list(500)
    
    # Get company name
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0, "name": 1})
    company_name = company.get("name", "LOTTOLAB") if company else "LOTTOLAB"
    
    # Format data for PDF
    report_data = []
    for agent in agents_data:
        agent_id = agent.get("_id")
        if not agent_id:
            continue
        
        # Get agent's commission rate
        agent_doc = await db.users.find_one(
            {"user_id": agent_id},
            {"_id": 0, "commission_percent": 1, "commission_rate": 1}
        )
        commission_percent = 0
        if agent_doc:
            commission_percent = agent_doc.get("commission_percent") or agent_doc.get("commission_rate") or 0
        
        sales = agent.get("sales", 0)
        paid = agent.get("paid", 0) or agent.get("winnings", 0)
        commission = sales * (commission_percent / 100)
        profit_loss = sales - paid
        final_balance = sales - commission
        
        agent_name = agent.get("agent_name")
        if not agent_name:
            agent_name = f"Agent {str(agent_id)[:8]}"
        
        report_data.append({
            "agent_name": agent_name,
            "ticket_count": agent.get("ticket_count", 0),
            "sales": sales,
            "paid": paid,
            "commission_percent": commission_percent,
            "profit_loss": profit_loss,
            "final_balance": final_balance
        })
    
    # Generate PDF
    date_display = start_date
    if start_date != end_date:
        date_display = f"{start_date} - {end_date}"
    
    pdf_buffer = create_daily_report_pdf(
        report_data=report_data,
        company_name=company_name,
        date=date_display
    )
    
    filename = f"rapport_journalier_{start_date}_{end_date}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
