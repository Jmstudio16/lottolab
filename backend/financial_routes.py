"""
LOTTOLAB - Financial Management System (PHASE 2)
=================================================
Complete financial management for lottery operations:
1. Daily Cash Register (Opening/Closing)
2. Automatic Reconciliation
3. Agent Credit/Advance Management
4. Financial Reports & Analytics
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from decimal import Decimal
import logging

from models import UserRole
from auth import decode_token
from utils import generate_id, get_current_timestamp
from security_system import create_audit_log, AuditAction

financial_router = APIRouter(prefix="/api/financial", tags=["Financial Management"])
security = HTTPBearer()
logger = logging.getLogger(__name__)

db = None

def set_financial_db(database):
    global db
    db = database


# ============================================================================
# AUTHENTICATION HELPERS
# ============================================================================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user"""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return user


async def require_financial_access(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require roles that can access financial data"""
    user = await get_current_user(credentials)
    allowed_roles = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.BRANCH_SUPERVISOR]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès financier requis")
    return user


async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require admin roles"""
    user = await get_current_user(credentials)
    allowed_roles = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return user


# ============================================================================
# MODELS
# ============================================================================

class CashRegisterOpen(BaseModel):
    opening_balance: float = Field(..., ge=0, description="Solde d'ouverture en HTG")
    notes: Optional[str] = None
    succursale_id: Optional[str] = None


class CashRegisterClose(BaseModel):
    closing_balance: float = Field(..., ge=0, description="Solde de fermeture en HTG")
    cash_counted: float = Field(..., ge=0, description="Espèces comptées")
    notes: Optional[str] = None


class AgentCreditRequest(BaseModel):
    agent_id: str
    amount: float = Field(..., gt=0)
    transaction_type: str  # CREDIT, DEBIT, ADVANCE, REPAYMENT, DEPOSIT, WITHDRAWAL
    notes: Optional[str] = None


class ReconciliationRequest(BaseModel):
    date: str  # YYYY-MM-DD
    succursale_id: Optional[str] = None


# ============================================================================
# 1. DAILY CASH REGISTER
# ============================================================================

@financial_router.post("/cash-register/open")
async def open_cash_register(
    request: Request,
    data: CashRegisterOpen,
    current_user: dict = Depends(require_financial_access)
):
    """
    Open daily cash register.
    Each agent/supervisor can have one open register per day.
    """
    company_id = current_user.get("company_id")
    user_id = current_user.get("user_id")
    role = current_user.get("role")
    now = get_current_timestamp()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check if register already open today
    existing = await db.cash_registers.find_one({
        "company_id": company_id,
        "opened_by": user_id,
        "date": today,
        "status": "OPEN"
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Caisse déjà ouverte aujourd'hui (ID: {existing['register_id']})"
        )
    
    # Get previous closing balance if exists
    previous = await db.cash_registers.find_one(
        {"company_id": company_id, "opened_by": user_id, "status": "CLOSED"},
        sort=[("closed_at", -1)]
    )
    previous_closing = previous.get("closing_balance", 0) if previous else 0
    
    register_id = generate_id("reg_")
    
    register = {
        "register_id": register_id,
        "company_id": company_id,
        "succursale_id": data.succursale_id or current_user.get("succursale_id"),
        "opened_by": user_id,
        "opened_by_name": current_user.get("name", ""),
        "opened_by_role": role,
        "date": today,
        "opening_balance": data.opening_balance,
        "previous_closing_balance": previous_closing,
        "balance_difference": data.opening_balance - previous_closing,
        "current_balance": data.opening_balance,
        "total_sales": 0.0,
        "total_payouts": 0.0,
        "total_deposits": 0.0,
        "total_withdrawals": 0.0,
        "transaction_count": 0,
        "status": "OPEN",
        "notes": data.notes,
        "opened_at": now,
        "closed_at": None,
        "closing_balance": None,
        "cash_counted": None,
        "variance": None
    }
    
    await db.cash_registers.insert_one(register)
    
    # Create audit log
    await create_audit_log(
        db=db,
        action="CASH_REGISTER_OPEN",
        user_id=user_id,
        request=request,
        details={
            "register_id": register_id,
            "opening_balance": data.opening_balance,
            "previous_closing": previous_closing
        },
        entity_type="cash_register",
        entity_id=register_id,
        severity="INFO",
        company_id=company_id
    )
    
    return {
        "message": "Caisse ouverte avec succès",
        "register_id": register_id,
        "opening_balance": data.opening_balance,
        "previous_closing_balance": previous_closing,
        "date": today
    }


@financial_router.post("/cash-register/close")
async def close_cash_register(
    request: Request,
    data: CashRegisterClose,
    current_user: dict = Depends(require_financial_access)
):
    """
    Close daily cash register.
    Calculates variance and creates reconciliation record.
    """
    company_id = current_user.get("company_id")
    user_id = current_user.get("user_id")
    now = get_current_timestamp()
    
    # Find open register
    register = await db.cash_registers.find_one({
        "company_id": company_id,
        "opened_by": user_id,
        "status": "OPEN"
    })
    
    if not register:
        raise HTTPException(status_code=404, detail="Aucune caisse ouverte trouvée")
    
    # Calculate expected balance
    expected_balance = (
        register.get("opening_balance", 0) +
        register.get("total_sales", 0) +
        register.get("total_deposits", 0) -
        register.get("total_payouts", 0) -
        register.get("total_withdrawals", 0)
    )
    
    # Calculate variance
    variance = data.cash_counted - expected_balance
    variance_type = "NONE"
    if variance > 0:
        variance_type = "SURPLUS"
    elif variance < 0:
        variance_type = "SHORTAGE"
    
    # Update register
    await db.cash_registers.update_one(
        {"register_id": register["register_id"]},
        {"$set": {
            "status": "CLOSED",
            "closing_balance": data.closing_balance,
            "cash_counted": data.cash_counted,
            "expected_balance": expected_balance,
            "variance": variance,
            "variance_type": variance_type,
            "variance_percentage": (variance / expected_balance * 100) if expected_balance > 0 else 0,
            "closed_at": now,
            "closing_notes": data.notes
        }}
    )
    
    # Create daily reconciliation record
    recon_id = generate_id("recon_")
    reconciliation = {
        "reconciliation_id": recon_id,
        "register_id": register["register_id"],
        "company_id": company_id,
        "succursale_id": register.get("succursale_id"),
        "date": register["date"],
        "performed_by": user_id,
        "opening_balance": register.get("opening_balance", 0),
        "total_sales": register.get("total_sales", 0),
        "total_payouts": register.get("total_payouts", 0),
        "total_deposits": register.get("total_deposits", 0),
        "total_withdrawals": register.get("total_withdrawals", 0),
        "expected_balance": expected_balance,
        "actual_balance": data.cash_counted,
        "variance": variance,
        "variance_type": variance_type,
        "status": "COMPLETED",
        "created_at": now
    }
    
    await db.daily_reconciliations.insert_one(reconciliation)
    
    # Create audit log
    await create_audit_log(
        db=db,
        action="CASH_REGISTER_CLOSE",
        user_id=user_id,
        request=request,
        details={
            "register_id": register["register_id"],
            "expected_balance": expected_balance,
            "actual_balance": data.cash_counted,
            "variance": variance,
            "variance_type": variance_type
        },
        entity_type="cash_register",
        entity_id=register["register_id"],
        severity="WARNING" if abs(variance) > 100 else "INFO",
        company_id=company_id
    )
    
    return {
        "message": "Caisse fermée avec succès",
        "register_id": register["register_id"],
        "reconciliation_id": recon_id,
        "summary": {
            "opening_balance": register.get("opening_balance", 0),
            "total_sales": register.get("total_sales", 0),
            "total_payouts": register.get("total_payouts", 0),
            "total_deposits": register.get("total_deposits", 0),
            "total_withdrawals": register.get("total_withdrawals", 0),
            "expected_balance": expected_balance,
            "cash_counted": data.cash_counted,
            "variance": variance,
            "variance_type": variance_type
        }
    }


@financial_router.get("/cash-register/current")
async def get_current_register(
    current_user: dict = Depends(require_financial_access)
):
    """Get current open cash register for the user"""
    company_id = current_user.get("company_id")
    user_id = current_user.get("user_id")
    
    register = await db.cash_registers.find_one(
        {"company_id": company_id, "opened_by": user_id, "status": "OPEN"},
        {"_id": 0}
    )
    
    if not register:
        return {"is_open": False, "register": None}
    
    # Calculate current expected balance
    expected_balance = (
        register.get("opening_balance", 0) +
        register.get("total_sales", 0) +
        register.get("total_deposits", 0) -
        register.get("total_payouts", 0) -
        register.get("total_withdrawals", 0)
    )
    register["expected_balance"] = expected_balance
    
    return {"is_open": True, "register": register}


@financial_router.get("/cash-register/history")
async def get_register_history(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    succursale_id: Optional[str] = None,
    limit: int = Query(default=30, le=100),
    current_user: dict = Depends(require_financial_access)
):
    """Get cash register history"""
    company_id = current_user.get("company_id")
    user_id = current_user.get("user_id")
    role = current_user.get("role")
    
    query = {"company_id": company_id}
    
    # Non-admin users can only see their own registers
    if role not in [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER]:
        query["opened_by"] = user_id
    
    if succursale_id:
        query["succursale_id"] = succursale_id
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    registers = await db.cash_registers.find(
        query,
        {"_id": 0}
    ).sort("date", -1).limit(limit).to_list(limit)
    
    return registers


# ============================================================================
# 2. AUTOMATIC RECONCILIATION
# ============================================================================

@financial_router.post("/reconciliation/generate")
async def generate_reconciliation(
    request: Request,
    data: ReconciliationRequest,
    current_user: dict = Depends(require_admin)
):
    """Generate automatic reconciliation report for a specific date."""
    company_id = current_user.get("company_id")
    target_date = data.date
    now = get_current_timestamp()
    
    query = {"company_id": company_id, "date": target_date}
    if data.succursale_id:
        query["succursale_id"] = data.succursale_id
    
    registers = await db.cash_registers.find(
        {**query, "status": "CLOSED"},
        {"_id": 0}
    ).to_list(100)
    
    # Aggregate sales
    sales_pipeline = [
        {"$match": {
            "company_id": company_id,
            "created_at": {"$regex": f"^{target_date}"}
        }},
        {"$group": {
            "_id": None,
            "total_sales": {"$sum": "$total_amount"},
            "ticket_count": {"$sum": 1}
        }}
    ]
    sales_result = await db.lottery_transactions.aggregate(sales_pipeline).to_list(1)
    total_sales = sales_result[0]["total_sales"] if sales_result else 0
    ticket_count = sales_result[0]["ticket_count"] if sales_result else 0
    
    # Aggregate payouts
    payouts_pipeline = [
        {"$match": {
            "company_id": company_id,
            "paid_at": {"$regex": f"^{target_date}"}
        }},
        {"$group": {
            "_id": None,
            "total_payouts": {"$sum": "$amount_paid"},
            "payout_count": {"$sum": 1}
        }}
    ]
    payouts_result = await db.payouts.aggregate(payouts_pipeline).to_list(1)
    total_payouts = payouts_result[0]["total_payouts"] if payouts_result else 0
    payout_count = payouts_result[0]["payout_count"] if payouts_result else 0
    
    # Calculate register totals
    register_totals = {
        "opening_balance": sum(r.get("opening_balance", 0) for r in registers),
        "total_sales": sum(r.get("total_sales", 0) for r in registers),
        "total_payouts": sum(r.get("total_payouts", 0) for r in registers),
        "closing_balance": sum(r.get("closing_balance", 0) or 0 for r in registers),
        "total_variance": sum(r.get("variance", 0) or 0 for r in registers)
    }
    
    # Detect anomalies
    anomalies = []
    
    sales_diff = abs(total_sales - register_totals["total_sales"])
    if sales_diff > 100:
        anomalies.append({
            "type": "SALES_MISMATCH",
            "description": f"Différence ventes: Système={total_sales:.2f}, Caisses={register_totals['total_sales']:.2f}",
            "amount": sales_diff,
            "severity": "HIGH" if sales_diff > 1000 else "MEDIUM"
        })
    
    if abs(register_totals["total_variance"]) > 500:
        anomalies.append({
            "type": "HIGH_VARIANCE",
            "description": f"Écart de caisse élevé: {register_totals['total_variance']:.2f} HTG",
            "amount": abs(register_totals["total_variance"]),
            "severity": "HIGH"
        })
    
    # Create report
    report_id = generate_id("report_")
    report = {
        "report_id": report_id,
        "company_id": company_id,
        "succursale_id": data.succursale_id,
        "date": target_date,
        "generated_by": current_user.get("user_id"),
        "generated_at": now,
        "register_count": len(registers),
        "system_totals": {
            "total_sales": total_sales,
            "ticket_count": ticket_count,
            "total_payouts": total_payouts,
            "payout_count": payout_count
        },
        "register_totals": register_totals,
        "anomalies": anomalies,
        "anomaly_count": len(anomalies),
        "status": "NEEDS_REVIEW" if anomalies else "OK",
        "net_profit": total_sales - total_payouts
    }
    
    await db.reconciliation_reports.insert_one(report)
    
    # Remove _id before returning
    report.pop("_id", None)
    
    return report


@financial_router.get("/reconciliation/reports")
async def get_reconciliation_reports(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(default=30, le=100),
    current_user: dict = Depends(require_admin)
):
    """Get reconciliation reports"""
    company_id = current_user.get("company_id")
    
    query = {"company_id": company_id}
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    if status:
        query["status"] = status
    
    reports = await db.reconciliation_reports.find(
        query,
        {"_id": 0}
    ).sort("date", -1).limit(limit).to_list(limit)
    
    return reports


# ============================================================================
# 3. AGENT CREDIT/ADVANCE MANAGEMENT
# ============================================================================

@financial_router.post("/agent/transaction")
async def create_agent_transaction(
    request: Request,
    data: AgentCreditRequest,
    current_user: dict = Depends(require_admin)
):
    """Create a financial transaction for an agent."""
    company_id = current_user.get("company_id")
    admin_id = current_user.get("user_id")
    now = get_current_timestamp()
    
    # Verify agent exists
    agent = await db.users.find_one({
        "user_id": data.agent_id,
        "company_id": company_id,
        "role": {"$in": [UserRole.AGENT_POS, "AGENT_POS", "VENDEUR"]}
    }, {"_id": 0, "name": 1, "user_id": 1})
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé")
    
    # Get or create agent balance
    balance = await db.agent_balances.find_one({"agent_id": data.agent_id})
    if not balance:
        balance = {
            "balance_id": generate_id("bal_"),
            "agent_id": data.agent_id,
            "company_id": company_id,
            "credit_limit": 50000.0,
            "current_balance": 0.0,
            "available_balance": 50000.0,
            "total_advances": 0.0,
            "outstanding_advances": 0.0,
            "total_sales": 0.0,
            "total_payouts": 0.0,
            "created_at": now
        }
        await db.agent_balances.insert_one(balance)
    
    available_balance = balance.get("available_balance", 0)
    outstanding_advances = balance.get("outstanding_advances", 0)
    
    valid_types = ["CREDIT", "DEBIT", "ADVANCE", "REPAYMENT", "DEPOSIT", "WITHDRAWAL"]
    if data.transaction_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Type invalide. Utilisez: {', '.join(valid_types)}")
    
    new_available = available_balance
    
    if data.transaction_type == "CREDIT":
        new_available = available_balance + data.amount
    elif data.transaction_type == "DEBIT":
        if data.amount > available_balance:
            raise HTTPException(status_code=400, detail="Solde disponible insuffisant")
        new_available = available_balance - data.amount
    elif data.transaction_type == "ADVANCE":
        new_available = available_balance + data.amount
        outstanding_advances += data.amount
    elif data.transaction_type == "REPAYMENT":
        if data.amount > outstanding_advances:
            raise HTTPException(status_code=400, detail="Montant supérieur aux avances en cours")
        outstanding_advances -= data.amount
    elif data.transaction_type == "DEPOSIT":
        new_available = available_balance + data.amount
    elif data.transaction_type == "WITHDRAWAL":
        if data.amount > available_balance:
            raise HTTPException(status_code=400, detail="Solde disponible insuffisant")
        new_available = available_balance - data.amount
    
    # Create transaction record
    txn_id = generate_id("ftxn_")
    transaction = {
        "transaction_id": txn_id,
        "agent_id": data.agent_id,
        "agent_name": agent.get("name"),
        "company_id": company_id,
        "transaction_type": data.transaction_type,
        "amount": data.amount,
        "balance_before": available_balance,
        "balance_after": new_available,
        "performed_by": admin_id,
        "performed_by_name": current_user.get("name"),
        "notes": data.notes,
        "created_at": now
    }
    
    await db.agent_financial_transactions.insert_one(transaction)
    
    # Update agent balance
    update_data = {
        "available_balance": new_available,
        "outstanding_advances": outstanding_advances,
        "updated_at": now
    }
    if data.transaction_type == "ADVANCE":
        update_data["total_advances"] = balance.get("total_advances", 0) + data.amount
    
    await db.agent_balances.update_one(
        {"agent_id": data.agent_id},
        {"$set": update_data}
    )
    
    await create_audit_log(
        db=db,
        action="AGENT_FINANCIAL_TRANSACTION",
        user_id=admin_id,
        request=request,
        details={
            "transaction_id": txn_id,
            "agent_id": data.agent_id,
            "type": data.transaction_type,
            "amount": data.amount
        },
        entity_type="agent_balance",
        entity_id=data.agent_id,
        severity="INFO",
        company_id=company_id
    )
    
    return {
        "message": f"Transaction {data.transaction_type} de {data.amount:.2f} HTG effectuée",
        "transaction_id": txn_id,
        "new_available_balance": new_available,
        "outstanding_advances": outstanding_advances
    }


@financial_router.get("/agent/{agent_id}/balance")
async def get_agent_balance(
    agent_id: str,
    current_user: dict = Depends(require_financial_access)
):
    """Get agent's current balance"""
    company_id = current_user.get("company_id")
    
    balance = await db.agent_balances.find_one(
        {"agent_id": agent_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not balance:
        return {
            "agent_id": agent_id,
            "credit_limit": 50000.0,
            "current_balance": 0.0,
            "available_balance": 50000.0,
            "outstanding_advances": 0.0,
            "total_sales": 0.0,
            "total_payouts": 0.0
        }
    
    agent = await db.users.find_one(
        {"user_id": agent_id},
        {"_id": 0, "name": 1, "email": 1}
    )
    
    if agent:
        balance["agent_name"] = agent.get("name")
        balance["agent_email"] = agent.get("email")
    
    return balance


@financial_router.get("/agent/{agent_id}/transactions")
async def get_agent_transactions(
    agent_id: str,
    limit: int = Query(default=50, le=200),
    current_user: dict = Depends(require_financial_access)
):
    """Get agent's financial transaction history"""
    company_id = current_user.get("company_id")
    
    transactions = await db.agent_financial_transactions.find(
        {"agent_id": agent_id, "company_id": company_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return transactions


@financial_router.get("/agents/balances")
async def get_all_agents_balances(
    current_user: dict = Depends(require_admin)
):
    """Get all agents' balances for the company"""
    company_id = current_user.get("company_id")
    
    agents = await db.users.find(
        {
            "company_id": company_id,
            "role": {"$in": [UserRole.AGENT_POS, "AGENT_POS", "VENDEUR"]}
        },
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "status": 1}
    ).to_list(500)
    
    agent_ids = [a["user_id"] for a in agents]
    balances = await db.agent_balances.find(
        {"agent_id": {"$in": agent_ids}},
        {"_id": 0}
    ).to_list(500)
    
    balance_map = {b["agent_id"]: b for b in balances}
    
    result = []
    for agent in agents:
        balance = balance_map.get(agent["user_id"], {})
        result.append({
            "agent_id": agent["user_id"],
            "name": agent.get("name", ""),
            "email": agent.get("email", ""),
            "status": agent.get("status", "ACTIVE"),
            "credit_limit": balance.get("credit_limit", 50000.0),
            "current_balance": balance.get("current_balance", 0.0),
            "available_balance": balance.get("available_balance", 50000.0),
            "outstanding_advances": balance.get("outstanding_advances", 0.0),
            "total_sales": balance.get("total_sales", 0.0),
            "total_payouts": balance.get("total_payouts", 0.0)
        })
    
    return result


@financial_router.put("/agent/{agent_id}/credit-limit")
async def update_agent_credit_limit(
    agent_id: str,
    request: Request,
    credit_limit: float = Query(..., gt=0),
    current_user: dict = Depends(require_admin)
):
    """Update agent's credit limit"""
    company_id = current_user.get("company_id")
    now = get_current_timestamp()
    
    await db.agent_balances.update_one(
        {"agent_id": agent_id, "company_id": company_id},
        {
            "$set": {
                "credit_limit": credit_limit,
                "updated_at": now
            },
            "$setOnInsert": {
                "balance_id": generate_id("bal_"),
                "agent_id": agent_id,
                "company_id": company_id,
                "current_balance": 0.0,
                "available_balance": credit_limit,
                "total_advances": 0.0,
                "outstanding_advances": 0.0,
                "total_sales": 0.0,
                "total_payouts": 0.0,
                "created_at": now
            }
        },
        upsert=True
    )
    
    return {"message": f"Limite de crédit mise à jour: {credit_limit:.2f} HTG"}


# ============================================================================
# 4. FINANCIAL REPORTS & ANALYTICS
# ============================================================================

@financial_router.get("/reports/daily-summary")
async def get_daily_summary(
    date: Optional[str] = None,
    current_user: dict = Depends(require_financial_access)
):
    """Get daily financial summary"""
    company_id = current_user.get("company_id")
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get sales
    sales_pipeline = [
        {"$match": {
            "company_id": company_id,
            "created_at": {"$regex": f"^{target_date}"}
        }},
        {"$group": {
            "_id": None,
            "total_sales": {"$sum": "$total_amount"},
            "ticket_count": {"$sum": 1},
            "avg_ticket": {"$avg": "$total_amount"}
        }}
    ]
    sales_result = await db.lottery_transactions.aggregate(sales_pipeline).to_list(1)
    
    # Get payouts
    payouts_pipeline = [
        {"$match": {
            "company_id": company_id,
            "paid_at": {"$regex": f"^{target_date}"}
        }},
        {"$group": {
            "_id": None,
            "total_payouts": {"$sum": "$amount_paid"},
            "payout_count": {"$sum": 1}
        }}
    ]
    payouts_result = await db.payouts.aggregate(payouts_pipeline).to_list(1)
    
    # Get winning tickets
    winners_pipeline = [
        {"$match": {
            "company_id": company_id,
            "status": "WINNER",
            "updated_at": {"$regex": f"^{target_date}"}
        }},
        {"$group": {
            "_id": None,
            "total_winnings": {"$sum": "$win_amount"},
            "winner_count": {"$sum": 1}
        }}
    ]
    winners_result = await db.lottery_transactions.aggregate(winners_pipeline).to_list(1)
    
    total_sales = sales_result[0]["total_sales"] if sales_result else 0
    total_payouts = payouts_result[0]["total_payouts"] if payouts_result else 0
    total_winnings = winners_result[0]["total_winnings"] if winners_result else 0
    
    gross_profit = total_sales - total_payouts
    
    return {
        "date": target_date,
        "company_id": company_id,
        "sales": {
            "total": total_sales,
            "ticket_count": sales_result[0]["ticket_count"] if sales_result else 0,
            "average_ticket": sales_result[0]["avg_ticket"] if sales_result else 0
        },
        "payouts": {
            "total": total_payouts,
            "count": payouts_result[0]["payout_count"] if payouts_result else 0
        },
        "winners": {
            "total_winnings": total_winnings,
            "count": winners_result[0]["winner_count"] if winners_result else 0,
            "unpaid": total_winnings - total_payouts
        },
        "profit": {
            "gross": gross_profit,
            "net": total_sales - total_winnings,
            "margin": (gross_profit / total_sales * 100) if total_sales > 0 else 0
        }
    }


@financial_router.get("/reports/agent-performance")
async def get_agent_performance(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """Get performance report for all agents"""
    company_id = current_user.get("company_id")
    
    if not end_date:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    
    pipeline = [
        {"$match": {
            "company_id": company_id,
            "created_at": {"$gte": start_date, "$lte": f"{end_date}T23:59:59"}
        }},
        {"$group": {
            "_id": "$agent_id",
            "agent_name": {"$first": "$agent_name"},
            "total_sales": {"$sum": "$total_amount"},
            "ticket_count": {"$sum": 1},
            "avg_ticket": {"$avg": "$total_amount"},
            "days_active": {"$addToSet": {"$substr": ["$created_at", 0, 10]}}
        }},
        {"$project": {
            "agent_id": "$_id",
            "agent_name": 1,
            "total_sales": 1,
            "ticket_count": 1,
            "avg_ticket": 1,
            "days_active": {"$size": "$days_active"}
        }},
        {"$sort": {"total_sales": -1}}
    ]
    
    agents = await db.lottery_transactions.aggregate(pipeline).to_list(100)
    
    agent_ids = [a["agent_id"] for a in agents]
    balances = await db.agent_balances.find(
        {"agent_id": {"$in": agent_ids}},
        {"_id": 0, "agent_id": 1, "current_balance": 1, "outstanding_advances": 1}
    ).to_list(100)
    balance_map = {b["agent_id"]: b for b in balances}
    
    for agent in agents:
        balance = balance_map.get(agent["agent_id"], {})
        agent["current_balance"] = balance.get("current_balance", 0)
        agent["outstanding_advances"] = balance.get("outstanding_advances", 0)
        agent["sales_per_day"] = agent["total_sales"] / agent["days_active"] if agent["days_active"] > 0 else 0
    
    return {
        "period": {"start": start_date, "end": end_date},
        "agents": agents,
        "totals": {
            "total_sales": sum(a["total_sales"] for a in agents),
            "total_tickets": sum(a["ticket_count"] for a in agents),
            "agent_count": len(agents)
        }
    }


@financial_router.get("/reports/profit-loss")
async def get_profit_loss_report(
    start_date: str,
    end_date: str,
    current_user: dict = Depends(require_admin)
):
    """Get profit & loss report for a period"""
    company_id = current_user.get("company_id")
    
    # Daily sales
    sales_pipeline = [
        {"$match": {
            "company_id": company_id,
            "created_at": {"$gte": start_date, "$lte": f"{end_date}T23:59:59"}
        }},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "sales": {"$sum": "$total_amount"},
            "tickets": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_sales = await db.lottery_transactions.aggregate(sales_pipeline).to_list(100)
    
    # Daily payouts
    payouts_pipeline = [
        {"$match": {
            "company_id": company_id,
            "paid_at": {"$gte": start_date, "$lte": f"{end_date}T23:59:59"}
        }},
        {"$group": {
            "_id": {"$substr": ["$paid_at", 0, 10]},
            "payouts": {"$sum": "$amount_paid"}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_payouts = await db.payouts.aggregate(payouts_pipeline).to_list(100)
    
    sales_map = {s["_id"]: s for s in daily_sales}
    payouts_map = {p["_id"]: p for p in daily_payouts}
    
    all_dates = sorted(set(list(sales_map.keys()) + list(payouts_map.keys())))
    
    daily_data = []
    running_profit = 0
    
    for date in all_dates:
        sales = sales_map.get(date, {}).get("sales", 0)
        payouts = payouts_map.get(date, {}).get("payouts", 0)
        profit = sales - payouts
        running_profit += profit
        
        daily_data.append({
            "date": date,
            "sales": sales,
            "payouts": payouts,
            "profit": profit,
            "running_profit": running_profit,
            "margin": (profit / sales * 100) if sales > 0 else 0
        })
    
    total_sales = sum(d["sales"] for d in daily_data)
    total_payouts = sum(d["payouts"] for d in daily_data)
    total_profit = total_sales - total_payouts
    
    return {
        "period": {"start": start_date, "end": end_date},
        "summary": {
            "total_sales": total_sales,
            "total_payouts": total_payouts,
            "gross_profit": total_profit,
            "margin": (total_profit / total_sales * 100) if total_sales > 0 else 0,
            "days": len(daily_data)
        },
        "daily": daily_data
    }


@financial_router.get("/dashboard/stats")
async def get_financial_dashboard_stats(
    current_user: dict = Depends(require_financial_access)
):
    """Get real-time financial dashboard statistics"""
    company_id = current_user.get("company_id")
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    
    # Today's stats
    today_sales = await db.lottery_transactions.aggregate([
        {"$match": {"company_id": company_id, "created_at": {"$regex": f"^{today}"}}},
        {"$group": {"_id": None, "sales": {"$sum": "$total_amount"}, "tickets": {"$sum": 1}}}
    ]).to_list(1)
    
    today_payouts = await db.payouts.aggregate([
        {"$match": {"company_id": company_id, "paid_at": {"$regex": f"^{today}"}}},
        {"$group": {"_id": None, "payouts": {"$sum": "$amount_paid"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    
    # Monthly stats
    month_sales = await db.lottery_transactions.aggregate([
        {"$match": {"company_id": company_id, "created_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "sales": {"$sum": "$total_amount"}, "tickets": {"$sum": 1}}}
    ]).to_list(1)
    
    month_payouts = await db.payouts.aggregate([
        {"$match": {"company_id": company_id, "paid_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "payouts": {"$sum": "$amount_paid"}}}
    ]).to_list(1)
    
    # Open registers
    open_registers = await db.cash_registers.count_documents({"company_id": company_id, "status": "OPEN"})
    
    # Pending payouts
    pending_payouts = await db.lottery_transactions.aggregate([
        {"$match": {"company_id": company_id, "status": "WINNER", "is_paid": {"$ne": True}}},
        {"$group": {"_id": None, "total": {"$sum": "$win_amount"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    
    # Outstanding advances
    advances = await db.agent_balances.aggregate([
        {"$match": {"company_id": company_id}},
        {"$group": {"_id": None, "total": {"$sum": "$outstanding_advances"}}}
    ]).to_list(1)
    
    return {
        "today": {
            "sales": today_sales[0]["sales"] if today_sales else 0,
            "tickets": today_sales[0]["tickets"] if today_sales else 0,
            "payouts": today_payouts[0]["payouts"] if today_payouts else 0,
            "payout_count": today_payouts[0]["count"] if today_payouts else 0,
            "profit": (today_sales[0]["sales"] if today_sales else 0) - (today_payouts[0]["payouts"] if today_payouts else 0)
        },
        "month": {
            "sales": month_sales[0]["sales"] if month_sales else 0,
            "tickets": month_sales[0]["tickets"] if month_sales else 0,
            "payouts": month_payouts[0]["payouts"] if month_payouts else 0,
            "profit": (month_sales[0]["sales"] if month_sales else 0) - (month_payouts[0]["payouts"] if month_payouts else 0)
        },
        "operations": {
            "open_registers": open_registers,
            "pending_payouts_amount": pending_payouts[0]["total"] if pending_payouts else 0,
            "pending_payouts_count": pending_payouts[0]["count"] if pending_payouts else 0,
            "outstanding_advances": advances[0]["total"] if advances else 0
        },
        "generated_at": now.isoformat()
    }
