"""
Excel Export Module - Export data to Excel format
"""
import io
from datetime import datetime
import xlsxwriter
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional

export_router = APIRouter(prefix="/api/export", tags=["Export"])

db = None

def set_export_db(database):
    global db
    db = database


# Helper function to create Excel workbook
def create_excel_workbook(data: list, columns: list, title: str = "Export"):
    """Create Excel workbook with data"""
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet(title[:31])  # Sheet name max 31 chars
    
    # Formats
    header_format = workbook.add_format({
        'bold': True,
        'bg_color': '#1e293b',
        'font_color': 'white',
        'border': 1,
        'align': 'center',
        'valign': 'vcenter'
    })
    
    cell_format = workbook.add_format({
        'border': 1,
        'align': 'left',
        'valign': 'vcenter'
    })
    
    money_format = workbook.add_format({
        'border': 1,
        'align': 'right',
        'num_format': '#,##0.00'
    })
    
    date_format = workbook.add_format({
        'border': 1,
        'align': 'center',
        'num_format': 'yyyy-mm-dd hh:mm'
    })
    
    # Write headers
    for col, column in enumerate(columns):
        worksheet.write(0, col, column['label'], header_format)
        worksheet.set_column(col, col, column.get('width', 15))
    
    # Write data
    for row, item in enumerate(data, start=1):
        for col, column in enumerate(columns):
            key = column['key']
            value = item.get(key, '')
            
            # Handle nested values
            if '.' in key:
                parts = key.split('.')
                value = item
                for part in parts:
                    if isinstance(value, dict):
                        value = value.get(part, '')
                    else:
                        value = ''
                        break
            
            # Apply appropriate format
            if column.get('type') == 'money':
                worksheet.write_number(row, col, float(value) if value else 0, money_format)
            elif column.get('type') == 'date':
                worksheet.write(row, col, str(value) if value else '', date_format)
            else:
                worksheet.write(row, col, str(value) if value else '', cell_format)
    
    workbook.close()
    output.seek(0)
    return output


# ============ VENDEUR EXPORTS ============

@export_router.get("/vendeur/tickets")
async def export_vendeur_tickets(
    token: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Export vendeur tickets to Excel"""
    from auth import decode_token
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    
    # Build query
    query = {"agent_id": user_id}
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    columns = [
        {"key": "ticket_code", "label": "Code Ticket", "width": 15},
        {"key": "lottery_name", "label": "Loterie", "width": 20},
        {"key": "draw_date", "label": "Date Tirage", "width": 12},
        {"key": "total_amount", "label": "Montant", "width": 12, "type": "money"},
        {"key": "status", "label": "Statut", "width": 12},
        {"key": "win_amount", "label": "Gains", "width": 12, "type": "money"},
        {"key": "created_at", "label": "Date Création", "width": 18, "type": "date"},
    ]
    
    excel_file = create_excel_workbook(tickets, columns, "Mes Tickets")
    
    filename = f"tickets_vendeur_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@export_router.get("/vendeur/winning-tickets")
async def export_vendeur_winning_tickets(token: str):
    """Export vendeur winning tickets to Excel"""
    from auth import decode_token
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    
    tickets = await db.lottery_transactions.find(
        {"agent_id": user_id, "status": {"$in": ["WINNER", "WON", "PAID"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    columns = [
        {"key": "ticket_code", "label": "Code Ticket", "width": 15},
        {"key": "lottery_name", "label": "Loterie", "width": 20},
        {"key": "draw_date", "label": "Date Tirage", "width": 12},
        {"key": "total_amount", "label": "Mise", "width": 12, "type": "money"},
        {"key": "win_amount", "label": "Gains", "width": 12, "type": "money"},
        {"key": "status", "label": "Statut", "width": 12},
        {"key": "created_at", "label": "Date", "width": 18, "type": "date"},
    ]
    
    excel_file = create_excel_workbook(tickets, columns, "Lots Gagnants")
    filename = f"lots_gagnants_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============ SUPERVISOR EXPORTS ============

@export_router.get("/supervisor/tickets")
async def export_supervisor_tickets(
    token: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Export supervisor tickets to Excel"""
    from auth import decode_token
    from models import UserRole
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not user or user.get("role") not in [UserRole.BRANCH_SUPERVISOR, "BRANCH_SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    succursale_id = user.get("succursale_id")
    
    # Get agents under this supervisor
    agents = await db.users.find(
        {"$or": [{"succursale_id": succursale_id}, {"branch_id": succursale_id}]},
        {"user_id": 1}
    ).to_list(500)
    agent_ids = [a["user_id"] for a in agents]
    
    # Build query
    query = {"agent_id": {"$in": agent_ids}}
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    
    columns = [
        {"key": "ticket_code", "label": "Code Ticket", "width": 15},
        {"key": "lottery_name", "label": "Loterie", "width": 20},
        {"key": "agent_name", "label": "Agent", "width": 18},
        {"key": "draw_date", "label": "Date Tirage", "width": 12},
        {"key": "total_amount", "label": "Montant", "width": 12, "type": "money"},
        {"key": "status", "label": "Statut", "width": 12},
        {"key": "win_amount", "label": "Gains", "width": 12, "type": "money"},
        {"key": "created_at", "label": "Date", "width": 18, "type": "date"},
    ]
    
    excel_file = create_excel_workbook(tickets, columns, "Tickets Équipe")
    filename = f"tickets_equipe_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@export_router.get("/supervisor/winning-tickets")
async def export_supervisor_winning_tickets(token: str):
    """Export supervisor winning tickets to Excel"""
    from auth import decode_token
    from models import UserRole
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not user or user.get("role") not in [UserRole.BRANCH_SUPERVISOR, "BRANCH_SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    succursale_id = user.get("succursale_id")
    
    agents = await db.users.find(
        {"$or": [{"succursale_id": succursale_id}, {"branch_id": succursale_id}]},
        {"user_id": 1}
    ).to_list(500)
    agent_ids = [a["user_id"] for a in agents]
    
    tickets = await db.lottery_transactions.find(
        {"agent_id": {"$in": agent_ids}, "status": {"$in": ["WINNER", "WON", "PAID"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    columns = [
        {"key": "ticket_code", "label": "Code Ticket", "width": 15},
        {"key": "lottery_name", "label": "Loterie", "width": 20},
        {"key": "agent_name", "label": "Agent", "width": 18},
        {"key": "draw_date", "label": "Date Tirage", "width": 12},
        {"key": "total_amount", "label": "Mise", "width": 12, "type": "money"},
        {"key": "win_amount", "label": "Gains", "width": 12, "type": "money"},
        {"key": "status", "label": "Statut", "width": 12},
    ]
    
    excel_file = create_excel_workbook(tickets, columns, "Lots Gagnants")
    filename = f"lots_gagnants_equipe_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============ COMPANY ADMIN EXPORTS ============

@export_router.get("/company/tickets")
async def export_company_tickets(
    token: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Export company tickets to Excel"""
    from auth import decode_token
    from models import UserRole
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not user or user.get("role") not in [UserRole.COMPANY_ADMIN, "COMPANY_ADMIN", "COMPANY_MANAGER"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    company_id = user.get("company_id")
    
    # Build query
    query = {"company_id": company_id}
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    
    columns = [
        {"key": "ticket_code", "label": "Code Ticket", "width": 15},
        {"key": "lottery_name", "label": "Loterie", "width": 20},
        {"key": "succursale_name", "label": "Succursale", "width": 18},
        {"key": "agent_name", "label": "Agent", "width": 18},
        {"key": "draw_date", "label": "Date Tirage", "width": 12},
        {"key": "total_amount", "label": "Montant", "width": 12, "type": "money"},
        {"key": "status", "label": "Statut", "width": 12},
        {"key": "win_amount", "label": "Gains", "width": 12, "type": "money"},
        {"key": "created_at", "label": "Date", "width": 18, "type": "date"},
    ]
    
    excel_file = create_excel_workbook(tickets, columns, "Tickets Entreprise")
    filename = f"tickets_entreprise_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@export_router.get("/company/winning-tickets")
async def export_company_winning_tickets(token: str):
    """Export company winning tickets to Excel"""
    from auth import decode_token
    from models import UserRole
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not user or user.get("role") not in [UserRole.COMPANY_ADMIN, "COMPANY_ADMIN", "COMPANY_MANAGER"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    company_id = user.get("company_id")
    
    tickets = await db.lottery_transactions.find(
        {"company_id": company_id, "status": {"$in": ["WINNER", "WON", "PAID"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(2000)
    
    columns = [
        {"key": "ticket_code", "label": "Code Ticket", "width": 15},
        {"key": "lottery_name", "label": "Loterie", "width": 20},
        {"key": "succursale_name", "label": "Succursale", "width": 18},
        {"key": "agent_name", "label": "Agent", "width": 18},
        {"key": "total_amount", "label": "Mise", "width": 12, "type": "money"},
        {"key": "win_amount", "label": "Gains", "width": 12, "type": "money"},
        {"key": "status", "label": "Statut", "width": 12},
    ]
    
    excel_file = create_excel_workbook(tickets, columns, "Lots Gagnants")
    filename = f"lots_gagnants_entreprise_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@export_router.get("/company/sales-report")
async def export_company_sales_report(
    token: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Export company sales report to Excel"""
    from auth import decode_token
    from models import UserRole
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not user or user.get("role") not in [UserRole.COMPANY_ADMIN, "COMPANY_ADMIN", "COMPANY_MANAGER"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    company_id = user.get("company_id")
    
    # Get all tickets
    query = {"company_id": company_id}
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).to_list(10000)
    
    # Aggregate by agent
    agent_sales = {}
    for ticket in tickets:
        agent_id = ticket.get("agent_id", "unknown")
        agent_name = ticket.get("agent_name", agent_id)
        
        if agent_id not in agent_sales:
            agent_sales[agent_id] = {
                "agent_name": agent_name,
                "ticket_count": 0,
                "total_sales": 0,
                "winning_tickets": 0,
                "total_winnings": 0
            }
        
        agent_sales[agent_id]["ticket_count"] += 1
        agent_sales[agent_id]["total_sales"] += ticket.get("total_amount", 0)
        
        if ticket.get("status") in ["WINNER", "WON", "PAID"]:
            agent_sales[agent_id]["winning_tickets"] += 1
            agent_sales[agent_id]["total_winnings"] += ticket.get("win_amount", 0)
    
    data = list(agent_sales.values())
    
    columns = [
        {"key": "agent_name", "label": "Agent", "width": 20},
        {"key": "ticket_count", "label": "Nb Tickets", "width": 12},
        {"key": "total_sales", "label": "Total Ventes", "width": 15, "type": "money"},
        {"key": "winning_tickets", "label": "Tickets Gagnants", "width": 15},
        {"key": "total_winnings", "label": "Total Gains", "width": 15, "type": "money"},
    ]
    
    excel_file = create_excel_workbook(data, columns, "Rapport Ventes")
    filename = f"rapport_ventes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
