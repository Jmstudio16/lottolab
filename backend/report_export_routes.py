"""
LOTTOLAB - Professional Excel/PDF Export Routes
Complete export functionality for all reports
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorClient
from io import BytesIO
import xlsxwriter
import os
import pytz

from auth import decode_token
from utils import get_current_timestamp

report_export_router = APIRouter(prefix="/api/reports", tags=["Reports & Exports"])

# Database
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "lottolab")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

security = HTTPBearer()

def set_report_export_db(database):
    global db
    db = database


async def get_report_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Authenticate user for reports"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    allowed_roles = ["COMPANY_ADMIN", "COMPANY_MANAGER", "SUPER_ADMIN", "BRANCH_SUPERVISOR", "AUDITOR_READONLY"]
    if payload.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    return payload


def format_haiti_datetime(iso_str: str) -> tuple:
    """Convert ISO datetime to Haiti timezone, returns (date_str, time_str)"""
    try:
        haiti_tz = pytz.timezone("America/Port-au-Prince")
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        dt_local = dt.astimezone(haiti_tz)
        return dt_local.strftime("%d/%m/%Y"), dt_local.strftime("%H:%M:%S")
    except Exception:
        return iso_str[:10] if len(iso_str) >= 10 else "N/A", ""


# ============================================================================
# COMPLETE TICKET HISTORY EXPORT
# ============================================================================

@report_export_router.get("/tickets/excel")
async def export_tickets_history_excel(
    current_user: dict = Depends(get_report_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    vendeur_id: Optional[str] = None,
    succursale_id: Optional[str] = None,
    lottery_id: Optional[str] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None
):
    """
    Export complete ticket history to Excel
    Columns: Ticket ID, Date, Heure, Vendeur, Succursale, POS, Loterie, Tirage, 
             Numéros, Type, Mise, Gain, Statut, Statut Paiement, Client
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
            query["created_at"]["$lte"] = date_to + "T23:59:59"
        else:
            query["created_at"] = {"$lte": date_to + "T23:59:59"}
    
    if vendeur_id:
        query["agent_id"] = vendeur_id
    if succursale_id:
        query["$or"] = [{"succursale_id": succursale_id}, {"branch_id": succursale_id}]
    if lottery_id:
        query["lottery_id"] = lottery_id
    if status:
        query["status"] = status
    if payment_status:
        query["payment_status"] = payment_status
    
    # Fetch tickets
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(50000).to_list(50000)
    
    # Create Excel
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet("Historique Tickets")
    
    # Styles
    header_format = workbook.add_format({
        'bold': True,
        'bg_color': '#1E3A5F',
        'font_color': 'white',
        'border': 1,
        'align': 'center',
        'valign': 'vcenter',
        'text_wrap': True
    })
    
    money_format = workbook.add_format({
        'num_format': '#,##0.00',
        'border': 1,
        'align': 'right'
    })
    
    date_format = workbook.add_format({
        'border': 1,
        'align': 'center'
    })
    
    cell_format = workbook.add_format({'border': 1, 'align': 'left'})
    center_format = workbook.add_format({'border': 1, 'align': 'center'})
    
    winner_format = workbook.add_format({
        'bg_color': '#22C55E',
        'border': 1,
        'font_color': 'white',
        'bold': True,
        'align': 'center'
    })
    
    loser_format = workbook.add_format({
        'bg_color': '#EF4444',
        'border': 1,
        'font_color': 'white',
        'align': 'center'
    })
    
    pending_format = workbook.add_format({
        'bg_color': '#F59E0B',
        'border': 1,
        'font_color': 'white',
        'align': 'center'
    })
    
    paid_format = workbook.add_format({
        'bg_color': '#10B981',
        'border': 1,
        'font_color': 'white',
        'bold': True,
        'align': 'center'
    })
    
    unpaid_format = workbook.add_format({
        'bg_color': '#6366F1',
        'border': 1,
        'font_color': 'white',
        'align': 'center'
    })
    
    # Headers
    headers = [
        "Ticket ID", "Code", "Date", "Heure", "Vendeur", "Succursale", "POS",
        "Loterie", "Tirage", "Numéros Joués", "Type de Jeu", "Mise (HTG)",
        "Gain (HTG)", "Statut", "Paiement", "Client"
    ]
    
    col_widths = [15, 15, 12, 10, 18, 18, 12, 20, 15, 25, 12, 12, 12, 12, 12, 18]
    
    for col, (header, width) in enumerate(zip(headers, col_widths)):
        worksheet.write(0, col, header, header_format)
        worksheet.set_column(col, col, width)
    
    # Freeze header row
    worksheet.freeze_panes(1, 0)
    
    # Data
    total_sales = 0
    total_winnings = 0
    total_paid = 0
    
    for row, ticket in enumerate(tickets, start=1):
        # Extract data
        created_at = ticket.get("created_at", "")
        date_str, time_str = format_haiti_datetime(created_at)
        
        plays = ticket.get("plays", [])
        numbers = ", ".join([p.get("numbers", "") for p in plays])
        bet_types = ", ".join(set([p.get("bet_type", "BORLETTE") for p in plays]))
        
        status = ticket.get("status", "VALIDATED")
        payment = ticket.get("payment_status", "NON PAYÉ")
        
        # Write data
        worksheet.write(row, 0, ticket.get("ticket_id", "")[-12:], cell_format)
        worksheet.write(row, 1, ticket.get("ticket_code", ""), cell_format)
        worksheet.write(row, 2, date_str, date_format)
        worksheet.write(row, 3, time_str, center_format)
        worksheet.write(row, 4, ticket.get("agent_name", ""), cell_format)
        worksheet.write(row, 5, ticket.get("succursale_name", ticket.get("branch_name", "")), cell_format)
        worksheet.write(row, 6, ticket.get("pos_id", ticket.get("machine_id", "")), center_format)
        worksheet.write(row, 7, ticket.get("lottery_name", ""), cell_format)
        worksheet.write(row, 8, ticket.get("draw_name", ""), center_format)
        worksheet.write(row, 9, numbers, cell_format)
        worksheet.write(row, 10, bet_types, center_format)
        
        mise = ticket.get("total_amount", 0)
        worksheet.write(row, 11, mise, money_format)
        total_sales += mise
        
        gain = ticket.get("winnings", 0) or ticket.get("win_amount", 0) or 0
        worksheet.write(row, 12, gain, money_format)
        total_winnings += gain
        
        # Status with color
        status_fmt = pending_format
        if status == "WINNER":
            status_fmt = winner_format
            status = "GAGNANT"
        elif status == "LOSER":
            status_fmt = loser_format
            status = "PERDANT"
        elif status in ["VALIDATED", "ACTIVE"]:
            status = "EN ATTENTE"
        worksheet.write(row, 13, status, status_fmt)
        
        # Payment status
        payment_fmt = unpaid_format
        if payment == "PAID" or payment == "PAYÉ":
            payment_fmt = paid_format
            payment = "PAYÉ"
            total_paid += gain
        else:
            payment = "NON PAYÉ"
        worksheet.write(row, 14, payment, payment_fmt)
        
        worksheet.write(row, 15, ticket.get("client_name", ""), cell_format)
    
    # Summary row
    summary_row = len(tickets) + 2
    summary_format = workbook.add_format({
        'bold': True,
        'bg_color': '#374151',
        'font_color': 'white',
        'border': 2,
        'num_format': '#,##0.00'
    })
    
    worksheet.write(summary_row, 10, "TOTAUX:", summary_format)
    worksheet.write(summary_row, 11, total_sales, summary_format)
    worksheet.write(summary_row, 12, total_winnings, summary_format)
    
    # Add filter info
    info_row = summary_row + 2
    info_format = workbook.add_format({'italic': True, 'font_color': '#6B7280'})
    worksheet.write(info_row, 0, f"Rapport généré le: {datetime.now().strftime('%d/%m/%Y %H:%M')}", info_format)
    worksheet.write(info_row + 1, 0, f"Période: {date_from or 'Début'} à {date_to or 'Maintenant'}", info_format)
    worksheet.write(info_row + 2, 0, f"Total tickets: {len(tickets)}", info_format)
    
    workbook.close()
    output.seek(0)
    
    filename = f"historique_tickets_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================================================
# SALES BY DAY REPORT
# ============================================================================

@report_export_router.get("/sales-by-day/excel")
async def export_sales_by_day_excel(
    current_user: dict = Depends(get_report_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Export daily sales report to Excel"""
    company_id = current_user.get("company_id")
    
    # Default to last 30 days
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")
    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Aggregate by day
    query = {"company_id": company_id} if company_id and current_user.get("role") != "SUPER_ADMIN" else {}
    query["created_at"] = {"$gte": date_from, "$lte": date_to + "T23:59:59"}
    
    pipeline = [
        {"$match": query},
        {"$addFields": {
            "date_only": {"$substr": ["$created_at", 0, 10]}
        }},
        {"$group": {
            "_id": "$date_only",
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"},
            "total_winnings": {"$sum": {"$ifNull": ["$winnings", 0]}},
            "winners_count": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, 1, 0]}},
            "paid_count": {"$sum": {"$cond": [{"$eq": ["$payment_status", "PAID"]}, 1, 0]}}
        }},
        {"$sort": {"_id": -1}}
    ]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(1000)
    
    # Create Excel
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet("Ventes par Jour")
    
    # Styles
    header_format = workbook.add_format({
        'bold': True, 'bg_color': '#1E3A5F', 'font_color': 'white',
        'border': 1, 'align': 'center', 'valign': 'vcenter'
    })
    money_format = workbook.add_format({'num_format': '#,##0.00', 'border': 1, 'align': 'right'})
    cell_format = workbook.add_format({'border': 1, 'align': 'center'})
    profit_positive = workbook.add_format({
        'num_format': '#,##0.00', 'border': 1, 'align': 'right',
        'bg_color': '#D1FAE5', 'font_color': '#065F46'
    })
    profit_negative = workbook.add_format({
        'num_format': '#,##0.00', 'border': 1, 'align': 'right',
        'bg_color': '#FEE2E2', 'font_color': '#991B1B'
    })
    
    # Headers
    headers = ["Date", "Tickets", "Ventes (HTG)", "Gains (HTG)", "Profit (HTG)", "Gagnants", "Payés"]
    widths = [15, 12, 15, 15, 15, 12, 12]
    
    for col, (header, width) in enumerate(zip(headers, widths)):
        worksheet.write(0, col, header, header_format)
        worksheet.set_column(col, col, width)
    
    worksheet.freeze_panes(1, 0)
    
    # Data
    grand_sales = 0
    grand_winnings = 0
    grand_tickets = 0
    
    for row, data in enumerate(results, start=1):
        date_str = data["_id"]
        sales = data["total_sales"]
        winnings = data["total_winnings"]
        profit = sales - winnings
        
        worksheet.write(row, 0, date_str, cell_format)
        worksheet.write(row, 1, data["total_tickets"], cell_format)
        worksheet.write(row, 2, sales, money_format)
        worksheet.write(row, 3, winnings, money_format)
        worksheet.write(row, 4, profit, profit_positive if profit >= 0 else profit_negative)
        worksheet.write(row, 5, data["winners_count"], cell_format)
        worksheet.write(row, 6, data["paid_count"], cell_format)
        
        grand_sales += sales
        grand_winnings += winnings
        grand_tickets += data["total_tickets"]
    
    # Summary
    summary_row = len(results) + 2
    summary_fmt = workbook.add_format({
        'bold': True, 'bg_color': '#374151', 'font_color': 'white',
        'border': 2, 'num_format': '#,##0.00'
    })
    
    worksheet.write(summary_row, 0, "TOTAUX", summary_fmt)
    worksheet.write(summary_row, 1, grand_tickets, summary_fmt)
    worksheet.write(summary_row, 2, grand_sales, summary_fmt)
    worksheet.write(summary_row, 3, grand_winnings, summary_fmt)
    worksheet.write(summary_row, 4, grand_sales - grand_winnings, summary_fmt)
    
    workbook.close()
    output.seek(0)
    
    filename = f"ventes_par_jour_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================================================
# SALES BY AGENT/VENDEUR REPORT
# ============================================================================

@report_export_router.get("/sales-by-agent/excel")
async def export_sales_by_agent_excel(
    current_user: dict = Depends(get_report_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    succursale_id: Optional[str] = None
):
    """Export sales by agent report to Excel"""
    company_id = current_user.get("company_id")
    
    # Default to today
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")
    if not date_from:
        date_from = date_to
    
    query = {"company_id": company_id} if company_id and current_user.get("role") != "SUPER_ADMIN" else {}
    query["created_at"] = {"$gte": date_from, "$lte": date_to + "T23:59:59"}
    
    if succursale_id:
        query["$or"] = [{"succursale_id": succursale_id}, {"branch_id": succursale_id}]
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$agent_id",
            "agent_name": {"$first": "$agent_name"},
            "succursale_name": {"$first": {"$ifNull": ["$succursale_name", "$branch_name"]}},
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"},
            "total_winnings": {"$sum": {"$ifNull": ["$winnings", 0]}},
            "winners_count": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, 1, 0]}},
            "paid_count": {"$sum": {"$cond": [{"$eq": ["$payment_status", "PAID"]}, 1, 0]}}
        }},
        {"$sort": {"total_sales": -1}}
    ]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(1000)
    
    # Create Excel
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet("Ventes par Vendeur")
    
    # Styles
    header_format = workbook.add_format({
        'bold': True, 'bg_color': '#1E3A5F', 'font_color': 'white',
        'border': 1, 'align': 'center'
    })
    money_format = workbook.add_format({'num_format': '#,##0.00', 'border': 1, 'align': 'right'})
    cell_format = workbook.add_format({'border': 1})
    center_format = workbook.add_format({'border': 1, 'align': 'center'})
    
    # Headers
    headers = ["Vendeur", "Succursale", "Tickets", "Ventes (HTG)", "Gains Payés (HTG)", "Commission (%)", "Commission (HTG)", "Gagnants"]
    widths = [20, 18, 10, 15, 15, 12, 15, 10]
    
    for col, (header, width) in enumerate(zip(headers, widths)):
        worksheet.write(0, col, header, header_format)
        worksheet.set_column(col, col, width)
    
    worksheet.freeze_panes(1, 0)
    
    # Get commission rates from users
    agent_ids = [r["_id"] for r in results]
    agents = await db.users.find({"user_id": {"$in": agent_ids}}, {"_id": 0, "user_id": 1, "commission_percent": 1}).to_list(1000)
    commission_map = {a["user_id"]: a.get("commission_percent", 0) for a in agents}
    
    # Data
    grand_sales = 0
    grand_winnings = 0
    grand_commission = 0
    
    for row, data in enumerate(results, start=1):
        sales = data["total_sales"]
        winnings = data["total_winnings"]
        commission_pct = commission_map.get(data["_id"], 0)
        commission_amt = sales * (commission_pct / 100) if commission_pct else 0
        
        worksheet.write(row, 0, data.get("agent_name", "Inconnu"), cell_format)
        worksheet.write(row, 1, data.get("succursale_name", ""), cell_format)
        worksheet.write(row, 2, data["total_tickets"], center_format)
        worksheet.write(row, 3, sales, money_format)
        worksheet.write(row, 4, winnings, money_format)
        worksheet.write(row, 5, commission_pct, center_format)
        worksheet.write(row, 6, commission_amt, money_format)
        worksheet.write(row, 7, data["winners_count"], center_format)
        
        grand_sales += sales
        grand_winnings += winnings
        grand_commission += commission_amt
    
    # Summary
    summary_row = len(results) + 2
    summary_fmt = workbook.add_format({
        'bold': True, 'bg_color': '#374151', 'font_color': 'white',
        'border': 2, 'num_format': '#,##0.00'
    })
    
    worksheet.write(summary_row, 2, "TOTAUX", summary_fmt)
    worksheet.write(summary_row, 3, grand_sales, summary_fmt)
    worksheet.write(summary_row, 4, grand_winnings, summary_fmt)
    worksheet.write(summary_row, 6, grand_commission, summary_fmt)
    
    workbook.close()
    output.seek(0)
    
    filename = f"ventes_par_vendeur_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================================================
# WINNING TICKETS REPORT
# ============================================================================

@report_export_router.get("/winners/excel")
async def export_winners_excel(
    current_user: dict = Depends(get_report_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    payment_status: Optional[str] = None
):
    """Export winning tickets report to Excel"""
    company_id = current_user.get("company_id")
    
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
    
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(10000).to_list(10000)
    
    # Create Excel
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet("Tickets Gagnants")
    
    # Styles
    header_format = workbook.add_format({
        'bold': True, 'bg_color': '#15803D', 'font_color': 'white',
        'border': 1, 'align': 'center'
    })
    money_format = workbook.add_format({'num_format': '#,##0.00', 'border': 1, 'align': 'right'})
    cell_format = workbook.add_format({'border': 1})
    center_format = workbook.add_format({'border': 1, 'align': 'center'})
    
    paid_format = workbook.add_format({
        'bg_color': '#22C55E', 'border': 1, 'font_color': 'white',
        'bold': True, 'align': 'center'
    })
    unpaid_format = workbook.add_format({
        'bg_color': '#EF4444', 'border': 1, 'font_color': 'white',
        'align': 'center'
    })
    
    # Headers
    headers = ["Ticket ID", "Code", "Date", "Vendeur", "Succursale", "Loterie", "Numéros", "Mise", "Gain", "Paiement", "Payé le"]
    widths = [15, 15, 12, 18, 18, 20, 20, 12, 15, 12, 18]
    
    for col, (header, width) in enumerate(zip(headers, widths)):
        worksheet.write(0, col, header, header_format)
        worksheet.set_column(col, col, width)
    
    worksheet.freeze_panes(1, 0)
    
    total_winnings = 0
    total_paid = 0
    
    for row, ticket in enumerate(tickets, start=1):
        created_at = ticket.get("created_at", "")
        date_str, _ = format_haiti_datetime(created_at)
        
        plays = ticket.get("plays", [])
        numbers = ", ".join([p.get("numbers", "") for p in plays])
        
        gain = ticket.get("winnings", 0) or ticket.get("win_amount", 0) or 0
        payment = ticket.get("payment_status", "NON PAYÉ")
        
        worksheet.write(row, 0, ticket.get("ticket_id", "")[-12:], cell_format)
        worksheet.write(row, 1, ticket.get("ticket_code", ""), cell_format)
        worksheet.write(row, 2, date_str, center_format)
        worksheet.write(row, 3, ticket.get("agent_name", ""), cell_format)
        worksheet.write(row, 4, ticket.get("succursale_name", ""), cell_format)
        worksheet.write(row, 5, ticket.get("lottery_name", ""), cell_format)
        worksheet.write(row, 6, numbers, cell_format)
        worksheet.write(row, 7, ticket.get("total_amount", 0), money_format)
        worksheet.write(row, 8, gain, money_format)
        
        total_winnings += gain
        
        if payment == "PAID" or payment == "PAYÉ":
            worksheet.write(row, 9, "PAYÉ", paid_format)
            total_paid += gain
            paid_at = ticket.get("paid_at", "")
            if paid_at:
                paid_date, paid_time = format_haiti_datetime(paid_at)
                worksheet.write(row, 10, f"{paid_date} {paid_time}", center_format)
            else:
                worksheet.write(row, 10, "", center_format)
        else:
            worksheet.write(row, 9, "NON PAYÉ", unpaid_format)
            worksheet.write(row, 10, "", center_format)
    
    # Summary
    summary_row = len(tickets) + 2
    summary_fmt = workbook.add_format({
        'bold': True, 'bg_color': '#15803D', 'font_color': 'white',
        'border': 2, 'num_format': '#,##0.00'
    })
    
    worksheet.write(summary_row, 7, "TOTAUX", summary_fmt)
    worksheet.write(summary_row, 8, total_winnings, summary_fmt)
    worksheet.write(summary_row + 1, 7, "Payés", summary_fmt)
    worksheet.write(summary_row + 1, 8, total_paid, summary_fmt)
    worksheet.write(summary_row + 2, 7, "Non Payés", summary_fmt)
    worksheet.write(summary_row + 2, 8, total_winnings - total_paid, summary_fmt)
    
    workbook.close()
    output.seek(0)
    
    filename = f"tickets_gagnants_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================================================
# SALES BY BRANCH/SUCCURSALE REPORT
# ============================================================================

@report_export_router.get("/sales-by-branch/excel")
async def export_sales_by_branch_excel(
    current_user: dict = Depends(get_report_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Export sales by branch/succursale report to Excel"""
    company_id = current_user.get("company_id")
    
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")
    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    query = {"company_id": company_id} if company_id and current_user.get("role") != "SUPER_ADMIN" else {}
    query["created_at"] = {"$gte": date_from, "$lte": date_to + "T23:59:59"}
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {"$ifNull": ["$succursale_id", "$branch_id"]},
            "succursale_name": {"$first": {"$ifNull": ["$succursale_name", "$branch_name"]}},
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"},
            "total_winnings": {"$sum": {"$ifNull": ["$winnings", 0]}},
            "unique_agents": {"$addToSet": "$agent_id"},
            "winners_count": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, 1, 0]}}
        }},
        {"$addFields": {"agent_count": {"$size": "$unique_agents"}}},
        {"$sort": {"total_sales": -1}}
    ]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(1000)
    
    # Create Excel
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet("Ventes par Succursale")
    
    header_format = workbook.add_format({
        'bold': True, 'bg_color': '#1E3A5F', 'font_color': 'white',
        'border': 1, 'align': 'center'
    })
    money_format = workbook.add_format({'num_format': '#,##0.00', 'border': 1, 'align': 'right'})
    cell_format = workbook.add_format({'border': 1})
    center_format = workbook.add_format({'border': 1, 'align': 'center'})
    profit_positive = workbook.add_format({
        'num_format': '#,##0.00', 'border': 1, 'bg_color': '#D1FAE5',
        'font_color': '#065F46', 'align': 'right'
    })
    profit_negative = workbook.add_format({
        'num_format': '#,##0.00', 'border': 1, 'bg_color': '#FEE2E2',
        'font_color': '#991B1B', 'align': 'right'
    })
    
    headers = ["Succursale", "Vendeurs", "Tickets", "Ventes (HTG)", "Gains (HTG)", "Profit (HTG)", "Marge %"]
    widths = [25, 12, 12, 18, 18, 18, 12]
    
    for col, (header, width) in enumerate(zip(headers, widths)):
        worksheet.write(0, col, header, header_format)
        worksheet.set_column(col, col, width)
    
    worksheet.freeze_panes(1, 0)
    
    grand_sales = 0
    grand_winnings = 0
    
    for row, data in enumerate(results, start=1):
        sales = data["total_sales"]
        winnings = data["total_winnings"]
        profit = sales - winnings
        margin = (profit / sales * 100) if sales > 0 else 0
        
        worksheet.write(row, 0, data.get("succursale_name", "Non assigné"), cell_format)
        worksheet.write(row, 1, data["agent_count"], center_format)
        worksheet.write(row, 2, data["total_tickets"], center_format)
        worksheet.write(row, 3, sales, money_format)
        worksheet.write(row, 4, winnings, money_format)
        worksheet.write(row, 5, profit, profit_positive if profit >= 0 else profit_negative)
        worksheet.write(row, 6, f"{margin:.1f}%", center_format)
        
        grand_sales += sales
        grand_winnings += winnings
    
    # Summary
    summary_row = len(results) + 2
    summary_fmt = workbook.add_format({
        'bold': True, 'bg_color': '#374151', 'font_color': 'white',
        'border': 2, 'num_format': '#,##0.00'
    })
    
    worksheet.write(summary_row, 2, "TOTAUX", summary_fmt)
    worksheet.write(summary_row, 3, grand_sales, summary_fmt)
    worksheet.write(summary_row, 4, grand_winnings, summary_fmt)
    worksheet.write(summary_row, 5, grand_sales - grand_winnings, summary_fmt)
    
    workbook.close()
    output.seek(0)
    
    filename = f"ventes_par_succursale_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================================================
# SALES BY LOTTERY REPORT
# ============================================================================

@report_export_router.get("/sales-by-lottery/excel")
async def export_sales_by_lottery_excel(
    current_user: dict = Depends(get_report_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Export sales by lottery report to Excel"""
    company_id = current_user.get("company_id")
    
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")
    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    query = {"company_id": company_id} if company_id and current_user.get("role") != "SUPER_ADMIN" else {}
    query["created_at"] = {"$gte": date_from, "$lte": date_to + "T23:59:59"}
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$lottery_id",
            "lottery_name": {"$first": "$lottery_name"},
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"},
            "total_winnings": {"$sum": {"$ifNull": ["$winnings", 0]}},
            "winners_count": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, 1, 0]}}
        }},
        {"$sort": {"total_sales": -1}}
    ]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(1000)
    
    # Create Excel
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet("Ventes par Loterie")
    
    header_format = workbook.add_format({
        'bold': True, 'bg_color': '#7C3AED', 'font_color': 'white',
        'border': 1, 'align': 'center'
    })
    money_format = workbook.add_format({'num_format': '#,##0.00', 'border': 1, 'align': 'right'})
    cell_format = workbook.add_format({'border': 1})
    center_format = workbook.add_format({'border': 1, 'align': 'center'})
    
    headers = ["Loterie", "Tickets", "Ventes (HTG)", "Gains (HTG)", "Profit (HTG)", "Gagnants", "Taux Gain %"]
    widths = [30, 12, 18, 18, 18, 12, 12]
    
    for col, (header, width) in enumerate(zip(headers, widths)):
        worksheet.write(0, col, header, header_format)
        worksheet.set_column(col, col, width)
    
    worksheet.freeze_panes(1, 0)
    
    grand_sales = 0
    grand_winnings = 0
    
    for row, data in enumerate(results, start=1):
        sales = data["total_sales"]
        winnings = data["total_winnings"]
        profit = sales - winnings
        win_rate = (data["winners_count"] / data["total_tickets"] * 100) if data["total_tickets"] > 0 else 0
        
        worksheet.write(row, 0, data.get("lottery_name", "Inconnu"), cell_format)
        worksheet.write(row, 1, data["total_tickets"], center_format)
        worksheet.write(row, 2, sales, money_format)
        worksheet.write(row, 3, winnings, money_format)
        worksheet.write(row, 4, profit, money_format)
        worksheet.write(row, 5, data["winners_count"], center_format)
        worksheet.write(row, 6, f"{win_rate:.1f}%", center_format)
        
        grand_sales += sales
        grand_winnings += winnings
    
    # Summary
    summary_row = len(results) + 2
    summary_fmt = workbook.add_format({
        'bold': True, 'bg_color': '#7C3AED', 'font_color': 'white',
        'border': 2, 'num_format': '#,##0.00'
    })
    
    worksheet.write(summary_row, 1, "TOTAUX", summary_fmt)
    worksheet.write(summary_row, 2, grand_sales, summary_fmt)
    worksheet.write(summary_row, 3, grand_winnings, summary_fmt)
    worksheet.write(summary_row, 4, grand_sales - grand_winnings, summary_fmt)
    
    workbook.close()
    output.seek(0)
    
    filename = f"ventes_par_loterie_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================================================
# PROFIT/LOSS SUMMARY REPORT
# ============================================================================

@report_export_router.get("/profit-loss/excel")
async def export_profit_loss_excel(
    current_user: dict = Depends(get_report_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Export profit/loss summary report to Excel"""
    company_id = current_user.get("company_id")
    
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")
    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    query = {"company_id": company_id} if company_id and current_user.get("role") != "SUPER_ADMIN" else {}
    query["created_at"] = {"$gte": date_from, "$lte": date_to + "T23:59:59"}
    
    # Get overall stats
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total_tickets": {"$sum": 1},
            "total_sales": {"$sum": "$total_amount"},
            "total_winnings": {"$sum": {"$ifNull": ["$winnings", 0]}},
            "total_paid": {"$sum": {"$cond": [
                {"$eq": ["$payment_status", "PAID"]},
                {"$ifNull": ["$winnings", 0]},
                0
            ]}},
            "winners_count": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, 1, 0]}},
            "losers_count": {"$sum": {"$cond": [{"$eq": ["$status", "LOSER"]}, 1, 0]}},
            "pending_count": {"$sum": {"$cond": [{"$in": ["$status", ["VALIDATED", "ACTIVE"]]}, 1, 0]}}
        }}
    ]
    
    summary = await db.lottery_transactions.aggregate(pipeline).to_list(1)
    stats = summary[0] if summary else {}
    
    # Create Excel
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet("Gains et Pertes")
    
    title_format = workbook.add_format({
        'bold': True, 'font_size': 16, 'align': 'center'
    })
    header_format = workbook.add_format({
        'bold': True, 'bg_color': '#1E3A5F', 'font_color': 'white',
        'border': 1, 'align': 'center', 'font_size': 12
    })
    label_format = workbook.add_format({
        'bold': True, 'border': 1, 'align': 'left', 'bg_color': '#F3F4F6'
    })
    money_format = workbook.add_format({
        'num_format': '#,##0.00 "HTG"', 'border': 1, 'align': 'right', 'font_size': 12
    })
    profit_format = workbook.add_format({
        'num_format': '#,##0.00 "HTG"', 'border': 2, 'align': 'right',
        'bg_color': '#22C55E', 'font_color': 'white', 'bold': True, 'font_size': 14
    })
    loss_format = workbook.add_format({
        'num_format': '#,##0.00 "HTG"', 'border': 2, 'align': 'right',
        'bg_color': '#EF4444', 'font_color': 'white', 'bold': True, 'font_size': 14
    })
    
    worksheet.set_column(0, 0, 30)
    worksheet.set_column(1, 1, 25)
    
    # Title
    worksheet.merge_range('A1:B1', 'RAPPORT GAINS ET PERTES', title_format)
    worksheet.write('A2', f'Période: {date_from} à {date_to}', workbook.add_format({'italic': True}))
    
    # Data
    row = 4
    total_sales = stats.get("total_sales", 0)
    total_winnings = stats.get("total_winnings", 0)
    total_paid = stats.get("total_paid", 0)
    profit = total_sales - total_winnings
    
    worksheet.write(row, 0, "Total Ventes", label_format)
    worksheet.write(row, 1, total_sales, money_format)
    row += 1
    
    worksheet.write(row, 0, "Total Gains Déclarés", label_format)
    worksheet.write(row, 1, total_winnings, money_format)
    row += 1
    
    worksheet.write(row, 0, "Total Gains Payés", label_format)
    worksheet.write(row, 1, total_paid, money_format)
    row += 1
    
    worksheet.write(row, 0, "Gains Non Payés", label_format)
    worksheet.write(row, 1, total_winnings - total_paid, money_format)
    row += 2
    
    worksheet.write(row, 0, "PROFIT / PERTE NET", header_format)
    worksheet.write(row, 1, profit, profit_format if profit >= 0 else loss_format)
    row += 2
    
    # Stats
    worksheet.write(row, 0, "Total Tickets", label_format)
    worksheet.write(row, 1, stats.get("total_tickets", 0), workbook.add_format({'border': 1, 'align': 'right'}))
    row += 1
    
    worksheet.write(row, 0, "Tickets Gagnants", label_format)
    worksheet.write(row, 1, stats.get("winners_count", 0), workbook.add_format({'border': 1, 'align': 'right'}))
    row += 1
    
    worksheet.write(row, 0, "Tickets Perdants", label_format)
    worksheet.write(row, 1, stats.get("losers_count", 0), workbook.add_format({'border': 1, 'align': 'right'}))
    row += 1
    
    worksheet.write(row, 0, "Tickets En Attente", label_format)
    worksheet.write(row, 1, stats.get("pending_count", 0), workbook.add_format({'border': 1, 'align': 'right'}))
    row += 2
    
    # Margin
    margin = (profit / total_sales * 100) if total_sales > 0 else 0
    worksheet.write(row, 0, "Marge Bénéficiaire", label_format)
    worksheet.write(row, 1, f"{margin:.2f}%", workbook.add_format({'border': 1, 'align': 'right', 'bold': True}))
    
    workbook.close()
    output.seek(0)
    
    filename = f"gains_pertes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
