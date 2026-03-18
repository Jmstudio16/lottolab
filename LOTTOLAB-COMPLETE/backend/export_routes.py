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
    min_bet: float = 10.0
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
                "min_bet": config.get("min_bet_amount", 10),
                "max_bet": config.get("max_bet_amount", 10000),
                "max_bet_per_number": config.get("max_bet_per_number", 5000),
                "max_total_per_ticket": 50000
            }
    
    if limits:
        min_bet = limits.get("min_bet", 10)
        max_bet = limits.get("max_bet", 10000)
        max_per_num = limits.get("max_bet_per_number", 5000)
        max_total = limits.get("max_total_per_ticket", 50000)
        
        total_amount = 0
        for play in plays:
            amount = play.get("amount", 0)
            num = play.get("numbers", "")
            total_amount += amount
            
            if amount < min_bet:
                errors.append(f"Mise minimum {min_bet} HTG pour le numéro {num}")
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
