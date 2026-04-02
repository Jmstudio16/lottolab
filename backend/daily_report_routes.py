"""
LOTTOLAB - Daily Report Routes
==============================
Routes pour les rapports journaliers de Company Admin et Supervisor.
Similaire au système SGL avec calculs de profits/pertes par agent.

Colonnes du rapport:
- No, Agent, Tfiche (tickets), Vente, A payé (gains), 
- %Agent, P/P sans %agent, P/P avec %agent, %Sup, B.Final
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from auth import decode_token
from models import UserRole
from utils import get_current_timestamp

daily_report_router = APIRouter(prefix="/api/reports", tags=["Daily Reports"])
security = HTTPBearer()

db = None

def set_daily_report_db(database):
    global db
    db = database


# ============ AUTH HELPERS ============

async def get_company_admin_or_supervisor(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get authenticated Company Admin or Supervisor"""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    allowed_roles = ["COMPANY_ADMIN", "SUPERVISOR"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès Company Admin ou Superviseur requis")
    
    return user


# ============ RAPPORT JOURNALIER - Style SGL ============

@daily_report_router.get("/daily-summary")
async def get_daily_summary_report(
    start_date: str,
    end_date: str,
    current_user: dict = Depends(get_company_admin_or_supervisor)
):
    """
    Rapport Journalier complet par agent.
    
    Colonnes:
    - No: Numéro séquentiel
    - Agent: Nom du vendeur
    - Tfiche: Nombre de fiches (tickets)
    - Vente: Total des ventes HTG
    - A_paye: Total des gains payés aux gagnants
    - Pct_Agent: Commission agent (%)
    - PP_sans_agent: Profit/Perte sans commission = Vente - A_paye
    - PP_avec_agent: Profit/Perte avec commission agent
    - Pct_Sup: Commission superviseur (%)
    - B_Final: Balance finale
    """
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID requis")
    
    # Get all vendors for this company (VENDEUR or AGENT_POS roles)
    vendors = await db.users.find(
        {"company_id": company_id, "role": {"$in": ["VENDEUR", "AGENT_POS"]}},
        {"_id": 0, "user_id": 1, "name": 1, "commission_percent": 1}
    ).to_list(500)
    
    vendor_map = {v["user_id"]: v for v in vendors}
    vendor_ids = list(vendor_map.keys())
    
    if not vendor_ids:
        return {
            "start_date": start_date,
            "end_date": end_date,
            "company_id": company_id,
            "total_pos": 0,
            "agents": [],
            "totals": {
                "total_tickets": 0,
                "total_vente": 0,
                "total_paye": 0,
                "total_profit_loss": 0,
                "total_balance": 0
            }
        }
    
    # Build date range for query
    start_dt = f"{start_date}T00:00:00"
    end_dt = f"{end_date}T23:59:59"
    
    # Aggregate sales per vendor
    sales_pipeline = [
        {
            "$match": {
                "company_id": company_id,
                "agent_id": {"$in": vendor_ids},
                "created_at": {"$gte": start_dt, "$lte": end_dt}
            }
        },
        {
            "$group": {
                "_id": "$agent_id",
                "ticket_count": {"$sum": 1},
                "total_sales": {"$sum": {"$ifNull": ["$total_amount", 0]}},
                "winning_count": {
                    "$sum": {"$cond": [{"$in": ["$status", ["WINNER", "WON", "PAID"]]}, 1, 0]}
                },
                "total_payouts": {
                    "$sum": {
                        "$cond": [
                            {"$in": ["$status", ["WINNER", "WON", "PAID"]]},
                            {"$ifNull": ["$win_amount", {"$ifNull": ["$winnings", 0]}]},
                            0
                        ]
                    }
                }
            }
        }
    ]
    
    sales_data = await db.lottery_transactions.aggregate(sales_pipeline).to_list(500)
    sales_map = {s["_id"]: s for s in sales_data}
    
    # Build agent reports
    agent_reports = []
    totals = {
        "total_tickets": 0,
        "total_vente": 0,
        "total_paye": 0,
        "total_profit_loss": 0,
        "total_balance": 0
    }
    
    for idx, (vendor_id, vendor) in enumerate(vendor_map.items(), start=1):
        sales = sales_map.get(vendor_id, {})
        
        ticket_count = sales.get("ticket_count", 0)
        total_vente = float(sales.get("total_sales", 0))
        total_paye = float(sales.get("total_payouts", 0))
        
        # Get agent commission (default 0)
        commission_pct = float(vendor.get("commission_percent", 0) or 0)
        
        # Calculate P/P (Profit/Perte)
        pp_sans_agent = total_vente - total_paye
        
        # Commission calculation
        commission_amount = (total_vente * commission_pct / 100) if commission_pct > 0 else 0
        pp_avec_agent = pp_sans_agent - commission_amount
        
        # Supervisor commission (13% by default for LottoLab)
        sup_pct = 13.0
        sup_commission = (total_vente * sup_pct / 100)
        
        # Balance finale = P/P avec agent - Sup commission
        balance_final = pp_avec_agent - sup_commission
        
        # Determine if positive (green) or negative (red)
        is_negative = balance_final < 0
        
        agent_report = {
            "no": idx,
            "agent_id": vendor_id,
            "agent_name": vendor.get("name", "Inconnu"),
            "tfiche": ticket_count,
            "vente": round(total_vente, 2),
            "a_paye": round(total_paye, 2),
            "pct_agent": round(commission_pct, 2),
            "pp_sans_agent": round(pp_sans_agent, 2),
            "pp_avec_agent": round(pp_avec_agent, 2),
            "pct_sup": round(sup_pct, 2),
            "b_final": round(balance_final, 2),
            "is_negative": is_negative
        }
        
        agent_reports.append(agent_report)
        
        # Update totals
        totals["total_tickets"] += ticket_count
        totals["total_vente"] += total_vente
        totals["total_paye"] += total_paye
        totals["total_profit_loss"] += pp_sans_agent
        totals["total_balance"] += balance_final
    
    # Sort by agent name
    agent_reports.sort(key=lambda x: x["agent_name"])
    
    # Re-number after sorting
    for idx, report in enumerate(agent_reports, start=1):
        report["no"] = idx
    
    # Round totals
    for key in totals:
        totals[key] = round(totals[key], 2)
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "company_id": company_id,
        "total_pos": len(agent_reports),
        "agents": agent_reports,
        "totals": totals
    }


# ============ RAPPORT FICHES GAGNANTES - Style SGL ============

@daily_report_router.get("/winning-tickets-by-lottery")
async def get_winning_tickets_by_lottery(
    start_date: str,
    end_date: str,
    vendor_id: Optional[str] = None,
    current_user: dict = Depends(get_company_admin_or_supervisor)
):
    """
    Rapport des fiches gagnantes groupé par loterie.
    
    Structure:
    - Groupé par lottery_name (Florida matin, Florida soir, etc.)
    - Chaque groupe: #Ticket, Agent, Date, Mise, Gain
    - Totaux par groupe: Total mise, Total gain
    """
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID requis")
    
    start_dt = f"{start_date}T00:00:00"
    end_dt = f"{end_date}T23:59:59"
    
    # Build match query
    match_query = {
        "company_id": company_id,
        "status": {"$in": ["WINNER", "WON", "PAID"]},
        "created_at": {"$gte": start_dt, "$lte": end_dt}
    }
    
    if vendor_id and vendor_id != "all":
        match_query["agent_id"] = vendor_id
    
    # Get winning tickets
    tickets = await db.lottery_transactions.find(
        match_query,
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    # Get vendor names
    vendor_ids = list(set(t.get("agent_id") for t in tickets if t.get("agent_id")))
    vendors = await db.users.find(
        {"user_id": {"$in": vendor_ids}},
        {"_id": 0, "user_id": 1, "name": 1}
    ).to_list(500)
    vendor_map = {v["user_id"]: v["name"] for v in vendors}
    
    # Group by lottery
    lottery_groups = {}
    for ticket in tickets:
        lottery_key = f"{ticket.get('lottery_name', 'Inconnu')} {ticket.get('draw_name', '')}"
        
        if lottery_key not in lottery_groups:
            lottery_groups[lottery_key] = {
                "lottery_name": lottery_key,
                "tickets": [],
                "total_mise": 0,
                "total_gain": 0
            }
        
        mise = float(ticket.get("total_amount", 0))
        gain = float(ticket.get("win_amount", ticket.get("winnings", 0)))
        
        lottery_groups[lottery_key]["tickets"].append({
            "ticket_id": ticket.get("ticket_id"),
            "agent_name": vendor_map.get(ticket.get("agent_id"), "Inconnu"),
            "date": ticket.get("created_at", "")[:19].replace("T", " "),
            "mise": round(mise, 2),
            "gain": round(gain, 2)
        })
        
        lottery_groups[lottery_key]["total_mise"] += mise
        lottery_groups[lottery_key]["total_gain"] += gain
    
    # Round totals
    for group in lottery_groups.values():
        group["total_mise"] = round(group["total_mise"], 2)
        group["total_gain"] = round(group["total_gain"], 2)
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "vendor_filter": vendor_id or "all",
        "lotteries": list(lottery_groups.values()),
        "grand_total_mise": round(sum(g["total_mise"] for g in lottery_groups.values()), 2),
        "grand_total_gain": round(sum(g["total_gain"] for g in lottery_groups.values()), 2)
    }


# ============ RAPPORT FICHES VENDUES - Style SGL ============

@daily_report_router.get("/sold-tickets")
async def get_sold_tickets_report(
    start_date: str,
    end_date: str,
    succursale_id: Optional[str] = None,
    lottery_id: Optional[str] = None,
    current_user: dict = Depends(get_company_admin_or_supervisor)
):
    """
    Rapport des fiches vendues.
    
    Structure:
    - No Ticket, Agent, Tirage, Date, Vente
    - Total en haut
    """
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID requis")
    
    start_dt = f"{start_date}T00:00:00"
    end_dt = f"{end_date}T23:59:59"
    
    # Build match query
    match_query = {
        "company_id": company_id,
        "created_at": {"$gte": start_dt, "$lte": end_dt}
    }
    
    if succursale_id and succursale_id != "all":
        match_query["succursale_id"] = succursale_id
    
    if lottery_id and lottery_id != "all":
        match_query["lottery_id"] = lottery_id
    
    # Get tickets
    tickets = await db.lottery_transactions.find(
        match_query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Get vendor names
    vendor_ids = list(set(t.get("agent_id") for t in tickets if t.get("agent_id")))
    vendors = await db.users.find(
        {"user_id": {"$in": vendor_ids}},
        {"_id": 0, "user_id": 1, "name": 1}
    ).to_list(500)
    vendor_map = {v["user_id"]: v["name"] for v in vendors}
    
    total_vente = 0
    formatted_tickets = []
    
    for ticket in tickets:
        vente = float(ticket.get("total_amount", 0))
        total_vente += vente
        
        formatted_tickets.append({
            "ticket_id": ticket.get("ticket_id"),
            "agent_name": vendor_map.get(ticket.get("agent_id"), "Inconnu"),
            "tirage": f"{ticket.get('lottery_name', '')} {ticket.get('draw_name', '')}",
            "date": ticket.get("created_at", "")[:19].replace("T", " "),
            "vente": round(vente, 2)
        })
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "succursale_filter": succursale_id or "all",
        "lottery_filter": lottery_id or "all",
        "total_fiche": len(formatted_tickets),
        "total_vente": round(total_vente, 2),
        "tickets": formatted_tickets
    }


# ============ VENTE PAR POS - Liste Vendeurs ============

@daily_report_router.get("/pos-list")
async def get_pos_list(
    current_user: dict = Depends(get_company_admin_or_supervisor)
):
    """
    Liste des POS (Vendeurs) avec leur succursale et superviseur.
    """
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID requis")
    
    # Get all vendors (VENDEUR or AGENT_POS roles)
    vendors = await db.users.find(
        {"company_id": company_id, "role": {"$in": ["VENDEUR", "AGENT_POS"]}},
        {"_id": 0, "user_id": 1, "name": 1, "succursale_id": 1, "supervisor_id": 1, "device_id": 1}
    ).to_list(500)
    
    # Get succursales
    succursale_ids = list(set(v.get("succursale_id") for v in vendors if v.get("succursale_id")))
    succursales = await db.succursales.find(
        {"succursale_id": {"$in": succursale_ids}},
        {"_id": 0, "succursale_id": 1, "name": 1}
    ).to_list(100)
    succursale_map = {s["succursale_id"]: s.get("name", "N/A") for s in succursales}
    
    # Get supervisors
    supervisor_ids = list(set(v.get("supervisor_id") for v in vendors if v.get("supervisor_id")))
    supervisors = await db.users.find(
        {"user_id": {"$in": supervisor_ids}},
        {"_id": 0, "user_id": 1, "name": 1}
    ).to_list(100)
    supervisor_map = {s["user_id"]: s.get("name", "N/A") for s in supervisors}
    
    pos_list = []
    for v in vendors:
        pos_list.append({
            "vendor_id": v["user_id"],
            "vendor_name": v.get("name", "Inconnu"),
            "succursale_name": succursale_map.get(v.get("succursale_id"), "N/A"),
            "supervisor_name": supervisor_map.get(v.get("supervisor_id"), "N/A"),
            "device_id": v.get("device_id", "N/A")
        })
    
    # Sort by vendor name
    pos_list.sort(key=lambda x: x["vendor_name"])
    
    return {
        "company_id": company_id,
        "total_pos": len(pos_list),
        "pos_list": pos_list
    }
