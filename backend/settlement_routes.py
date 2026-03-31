"""
LOTTOLAB - Settlement Engine API Routes
========================================
Routes API pour le moteur de règlement automatique.

Endpoints:
- POST /api/settlement/publish - Publie résultat + déclenche settlement
- POST /api/settlement/run/{result_id} - Exécute settlement manuellement
- GET /api/settlement/status/{settlement_id} - Statut d'un settlement
- GET /api/settlement/report/{settlement_id} - Rapport détaillé
- GET /api/settlement/company-summary - Résumé pour Company Admin
- GET /api/settlement/list - Liste des settlements (Super Admin)

Configuration:
- GET /api/prize-config/company - Config primes de la compagnie
- PUT /api/prize-config/company - Modifier config primes
"""

from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import logging

from models import UserRole
from auth import decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

# Import Settlement Engine
from settlement_engine import (
    publish_draw_result,
    settle_draw,
    get_settlement_report,
    get_company_settlement_summary,
    get_prize_config,
    set_settlement_engine_db,
    DrawStatus,
    SettlementStatus,
    PayoutModel,
    ensure_indexes
)

# Import WebSocket for real-time updates
from websocket_manager import (
    emit_result_published,
    emit_ticket_winner,
    emit_sync_required
)

logger = logging.getLogger(__name__)

settlement_router = APIRouter(prefix="/api/settlement", tags=["Settlement Engine"])
prize_config_router = APIRouter(prefix="/api/prize-config", tags=["Prize Configuration"])
security = HTTPBearer()

db = None


def set_settlement_routes_db(database):
    """Initialize database for settlement routes"""
    global db
    db = database
    set_settlement_engine_db(database)


# ============ PYDANTIC MODELS ============

class PublishResultRequest(BaseModel):
    lottery_id: str
    lottery_name: str
    draw_date: str  # YYYY-MM-DD
    draw_name: str  # Matin, Midi, Soir, Nuit
    first: str      # 1er lot (3 chiffres)
    second: Optional[str] = None  # 2ème lot (2 chiffres)
    third: Optional[str] = None   # 3ème lot (2 chiffres)
    auto_settle: bool = True  # Déclencher settlement automatiquement


class ManualSettlementRequest(BaseModel):
    lottery_id: str
    draw_date: str
    draw_name: str
    company_filter: Optional[str] = None


class PrizeConfigUpdate(BaseModel):
    bet_type: str
    payout_formula: str  # "60|20|10" ou "500"
    description: Optional[str] = None


# ============ AUTH HELPERS ============

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return user


def require_super_admin(user: dict):
    if user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès réservé au Super Admin")
    return user


def require_company_admin(user: dict):
    if user.get("role") not in [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return user


# ============================================================================
# SETTLEMENT ROUTES
# ============================================================================

@settlement_router.post("/publish")
async def publish_result_and_settle(
    request_data: PublishResultRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Publie un résultat officiel et déclenche le settlement automatique.
    
    Ce endpoint:
    1. Vérifie les permissions (Super Admin requis)
    2. Valide qu'il n'y a pas de doublon
    3. Publie le résultat dans global_results et published_results
    4. Déclenche le settlement automatique (si auto_settle=true)
    5. Met à jour tous les tickets gagnants/perdants
    6. Crédite les wallets des vendeurs gagnants
    7. Génère les logs d'audit complets
    
    **Important**: Cette opération est IDEMPOTENTE - si vous publiez le même 
    résultat deux fois, la deuxième tentative sera rejetée.
    """
    require_super_admin(current_user)
    
    # Build winning numbers dict
    winning_numbers = {
        "first": request_data.first,
        "second": request_data.second or "",
        "third": request_data.third or ""
    }
    
    # Generate draw_id
    draw_id = generate_id("draw")
    
    logger.info(f"[SETTLEMENT] Publishing result: {request_data.lottery_name} {request_data.draw_date} {request_data.draw_name}")
    logger.info(f"[SETTLEMENT] Winning numbers: {winning_numbers}")
    
    # Call the settlement engine
    result = await publish_draw_result(
        draw_id=draw_id,
        lottery_id=request_data.lottery_id,
        lottery_name=request_data.lottery_name,
        draw_date=request_data.draw_date,
        draw_name=request_data.draw_name,
        winning_numbers=winning_numbers,
        actor_id=current_user.get("user_id"),
        actor_role=current_user.get("role"),
        company_id=None,  # Global result
        auto_settle=request_data.auto_settle
    )
    
    if not result.get("success"):
        if result.get("error") == "DUPLICATE_RESULT":
            raise HTTPException(
                status_code=400,
                detail=f"Ce résultat a déjà été publié. ID existant: {result.get('existing_result_id')}"
            )
        raise HTTPException(status_code=500, detail=result.get("message", "Erreur lors de la publication"))
    
    # Log activity
    await log_activity(
        db=db,
        action_type="SETTLEMENT_RESULT_PUBLISHED",
        entity_type="settlement",
        entity_id=result.get("result_id"),
        performed_by=current_user.get("user_id"),
        company_id=None,
        metadata={
            "lottery_name": request_data.lottery_name,
            "draw_date": request_data.draw_date,
            "draw_name": request_data.draw_name,
            "winning_numbers": winning_numbers,
            "settlement": result.get("settlement")
        },
        ip_address=request.client.host if request.client else None
    )
    
    # Emit WebSocket event for real-time UI update
    background_tasks.add_task(
        emit_result_published,
        request_data.lottery_id,
        request_data.lottery_name,
        request_data.draw_name,
        f"{winning_numbers['first']}-{winning_numbers.get('second','')}-{winning_numbers.get('third','')}",
        result.get("result_id")
    )
    
    # Prepare response
    settlement_info = result.get("settlement") or {}
    
    return {
        "success": True,
        "message": "Résultat publié et règlement effectué avec succès" if request_data.auto_settle else "Résultat publié avec succès",
        "result_id": result.get("result_id"),
        "draw_id": result.get("draw_id"),
        "lottery_name": request_data.lottery_name,
        "draw_date": request_data.draw_date,
        "draw_name": request_data.draw_name,
        "winning_numbers": winning_numbers,
        "settlement": {
            "settlement_id": settlement_info.get("settlement_id"),
            "status": settlement_info.get("status"),
            "tickets_scanned": settlement_info.get("tickets_scanned", 0),
            "winning_tickets": settlement_info.get("winning_tickets", 0),
            "total_sales": settlement_info.get("total_sales", 0),
            "total_payout": settlement_info.get("total_payout", 0),
            "winners_by_rank": settlement_info.get("winners_by_rank", {})
        } if settlement_info else None
    }


@settlement_router.post("/run/{result_id}")
async def run_settlement_manually(
    result_id: str,
    company_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Exécute le settlement manuellement pour un résultat déjà publié.
    
    Utile si:
    - Le settlement automatique a échoué
    - De nouveaux tickets ont été ajoutés après publication
    - On veut re-calculer les gagnants
    
    **Note**: Si le settlement a déjà été effectué, cette opération sera refusée
    pour éviter les doubles paiements.
    """
    require_super_admin(current_user)
    
    # Get the result
    result = await db.global_results.find_one(
        {"result_id": result_id},
        {"_id": 0}
    )
    
    if not result:
        # Try published_results
        result = await db.published_results.find_one(
            {"result_id": result_id},
            {"_id": 0}
        )
    
    if not result:
        raise HTTPException(status_code=404, detail="Résultat non trouvé")
    
    # Parse winning numbers
    winning_numbers = result.get("winning_numbers", {})
    if isinstance(winning_numbers, str):
        parts = winning_numbers.replace(" ", "").split("-")
        winning_numbers = {
            "first": parts[0] if len(parts) > 0 else "",
            "second": parts[1] if len(parts) > 1 else "",
            "third": parts[2] if len(parts) > 2 else ""
        }
    
    # Run settlement
    settlement_result = await settle_draw(
        result_id=result_id,
        lottery_id=result.get("lottery_id"),
        draw_date=result.get("draw_date"),
        draw_name=result.get("draw_name") or result.get("draw_time"),
        winning_numbers=winning_numbers,
        processed_by=current_user.get("user_id"),
        company_filter=company_filter
    )
    
    if not settlement_result.get("success"):
        if settlement_result.get("error") == "ALREADY_SETTLED":
            raise HTTPException(
                status_code=400,
                detail=f"Ce tirage a déjà été réglé. ID: {settlement_result.get('existing_settlement_id')}"
            )
        raise HTTPException(
            status_code=500,
            detail=settlement_result.get("message", "Erreur lors du règlement")
        )
    
    return {
        "success": True,
        "message": "Règlement effectué avec succès",
        "settlement": settlement_result
    }


@settlement_router.get("/status/{settlement_id}")
async def get_settlement_status(
    settlement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Récupère le statut d'un settlement.
    
    Retourne:
    - Statut (PENDING, PROCESSING, COMPLETED, FAILED)
    - Nombre de tickets scannés
    - Nombre de gagnants
    - Montant total des gains
    - Erreurs éventuelles
    """
    settlement = await db.settlements.find_one(
        {"settlement_id": settlement_id},
        {"_id": 0}
    )
    
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement non trouvé")
    
    # Check access rights
    company_id = current_user.get("company_id")
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        if settlement.get("company_filter") and settlement.get("company_filter") != company_id:
            raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    return {
        "settlement_id": settlement.get("settlement_id"),
        "result_id": settlement.get("result_id"),
        "lottery_id": settlement.get("lottery_id"),
        "draw_date": settlement.get("draw_date"),
        "draw_name": settlement.get("draw_name"),
        "status": settlement.get("status"),
        "started_at": settlement.get("started_at"),
        "completed_at": settlement.get("completed_at"),
        "total_tickets_scanned": settlement.get("total_tickets_scanned", 0),
        "total_winning_tickets": settlement.get("total_winning_tickets", 0),
        "total_sales_amount": settlement.get("total_sales_amount", 0),
        "total_payout_amount": settlement.get("total_payout_amount", 0),
        "winners_by_rank": settlement.get("winners_by_rank", {}),
        "errors": settlement.get("errors", [])
    }


@settlement_router.get("/report/{settlement_id}")
async def get_settlement_report_endpoint(
    settlement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Génère un rapport détaillé d'un settlement.
    
    Inclut:
    - Statistiques complètes
    - Liste des gagnants par rang
    - Détails des items de règlement
    - Tickets gagnants avec montants
    """
    company_id = current_user.get("company_id")
    filter_company = None if current_user.get("role") == UserRole.SUPER_ADMIN else company_id
    
    report = await get_settlement_report(settlement_id, filter_company)
    
    if report.get("error"):
        raise HTTPException(status_code=404, detail=report["error"])
    
    return report


@settlement_router.get("/list")
async def list_settlements(
    lottery_id: Optional[str] = None,
    draw_date: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Liste les settlements avec filtres.
    
    Super Admin: Voit tous les settlements
    Company Admin: Voit uniquement les settlements concernant sa compagnie
    """
    query = {}
    
    if lottery_id:
        query["lottery_id"] = lottery_id
    if draw_date:
        query["draw_date"] = draw_date
    if status:
        query["status"] = status
    
    settlements = await db.settlements.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "settlements": settlements,
        "count": len(settlements)
    }


@settlement_router.get("/company-summary")
async def get_company_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Récupère le résumé des settlements pour la compagnie de l'utilisateur.
    
    Inclut:
    - Total des ventes
    - Total des gains versés
    - Revenu net
    - Ratio de paiement
    - Nombre de tickets gagnants
    """
    require_company_admin(current_user)
    
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Compagnie non trouvée")
    
    summary = await get_company_settlement_summary(
        company_id=company_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return summary


@settlement_router.get("/company-history")
async def get_company_settlement_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Récupère l'historique des settlements pour la compagnie de l'utilisateur.
    Pour Company Admin et Supervisors.
    """
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Compagnie non trouvée")
    
    # Get settlements that affected this company's tickets
    settlements = await db.settlements.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Filter settlements that have items for this company
    company_settlements = []
    total_paid = 0
    total_winners = 0
    
    for settlement in settlements:
        # Get settlement items for this company
        items = await db.settlement_items.find({
            "settlement_id": settlement.get("settlement_id"),
            "company_id": company_id
        }, {"_id": 0}).to_list(100)
        
        if items:
            company_payout = sum(item.get("payout_amount", 0) for item in items)
            company_winners = len(items)
            
            company_settlements.append({
                "settlement_id": settlement.get("settlement_id"),
                "lottery_name": settlement.get("lottery_name"),
                "draw_name": settlement.get("draw_name"),
                "winning_numbers": settlement.get("winning_numbers"),
                "status": settlement.get("status"),
                "created_at": settlement.get("created_at"),
                "tickets_processed": settlement.get("total_tickets_checked", 0),
                "winners_count": company_winners,
                "total_paid": company_payout
            })
            
            total_paid += company_payout
            total_winners += company_winners
    
    return {
        "settlements": company_settlements,
        "total_settlements": len(company_settlements),
        "total_paid": total_paid,
        "total_winners": total_winners
    }


@settlement_router.get("/winning-tickets")
async def get_winning_tickets_list(
    lottery_id: Optional[str] = None,
    draw_date: Optional[str] = None,
    payment_status: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Liste les tickets gagnants avec filtres.
    
    Company Admin: Voit les gagnants de sa compagnie
    Super Admin: Voit tous les gagnants
    """
    company_id = current_user.get("company_id")
    
    query = {"is_winner": True}
    
    if current_user.get("role") != UserRole.SUPER_ADMIN and company_id:
        query["company_id"] = company_id
    
    if lottery_id:
        query["lottery_id"] = lottery_id
    if draw_date:
        query["draw_date"] = draw_date
    if payment_status:
        query["payment_status"] = payment_status
    
    tickets = await db.lottery_transactions.find(
        query,
        {"_id": 0}
    ).sort("settled_at", -1).limit(limit).to_list(limit)
    
    # Enrich with settlement info
    for ticket in tickets:
        ticket["display_win_amount"] = f"{ticket.get('win_amount', 0):,.0f} HTG"
    
    return {
        "winning_tickets": tickets,
        "count": len(tickets),
        "total_winnings": sum(t.get("win_amount", 0) for t in tickets)
    }


# ============================================================================
# PRIZE CONFIGURATION ROUTES
# ============================================================================

@prize_config_router.get("/company")
async def get_company_prize_configs(
    current_user: dict = Depends(get_current_user)
):
    """
    Récupère les configurations de primes pour la compagnie.
    
    Retourne les primes configurées avec les valeurs par défaut.
    """
    require_company_admin(current_user)
    
    company_id = current_user.get("company_id")
    
    # Get all configured primes
    configs = await db.prize_configs.find(
        {"company_id": company_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Get company configuration
    company_config = await db.company_configurations.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    # Build response with defaults
    default_types = ["BORLETTE", "LOTO3", "LOTO4", "LOTO5", "MARIAGE", "MARIAGE_GRATUIT"]
    default_formulas = {
        "BORLETTE": "60|20|10",
        "LOTO3": "500",
        "LOTO4": "5000",
        "LOTO5": "50000",
        "MARIAGE": "750",
        "MARIAGE_GRATUIT": "750"
    }
    
    configs_map = {c.get("bet_type"): c for c in configs}
    
    result = []
    for bet_type in default_types:
        if bet_type in configs_map:
            result.append(configs_map[bet_type])
        else:
            # Check company_configurations
            prime_key = f"prime_{bet_type.lower()}"
            formula = None
            if company_config:
                formula = company_config.get(prime_key)
            
            result.append({
                "bet_type": bet_type,
                "payout_formula": formula or default_formulas.get(bet_type, "60|20|10"),
                "is_default": True,
                "description": f"Configuration par défaut pour {bet_type}"
            })
    
    return {
        "company_id": company_id,
        "prize_configs": result
    }


@prize_config_router.put("/company")
async def update_company_prize_config(
    config: PrizeConfigUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Met à jour une configuration de prime pour la compagnie.
    
    Exemple: Changer Borlette de 60|20|10 à 70|25|15
    """
    require_company_admin(current_user)
    
    company_id = current_user.get("company_id")
    bet_type = config.bet_type.upper()
    now = get_current_timestamp()
    
    # Validate formula
    parts = config.payout_formula.split("|")
    try:
        multipliers = [float(p.strip()) for p in parts]
        if not multipliers:
            raise ValueError("Formula vide")
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Format de formule invalide. Utilisez le format '60|20|10' ou '500'. Erreur: {str(e)}"
        )
    
    # Update or insert
    existing = await db.prize_configs.find_one({
        "company_id": company_id,
        "bet_type": bet_type
    })
    
    if existing:
        await db.prize_configs.update_one(
            {"company_id": company_id, "bet_type": bet_type},
            {"$set": {
                "payout_formula": config.payout_formula,
                "description": config.description or existing.get("description"),
                "is_active": True,
                "updated_at": now,
                "updated_by": current_user.get("user_id")
            }}
        )
    else:
        prize_id = generate_id("prime_")
        await db.prize_configs.insert_one({
            "prize_config_id": prize_id,
            "company_id": company_id,
            "bet_type": bet_type,
            "payout_formula": config.payout_formula,
            "description": config.description or f"Prime {bet_type}",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            "created_by": current_user.get("user_id")
        })
    
    # Also update company_configurations for compatibility
    await db.company_configurations.update_one(
        {"company_id": company_id},
        {"$set": {
            f"prime_{bet_type.lower()}": config.payout_formula,
            "updated_at": now
        }},
        upsert=True
    )
    
    return {
        "success": True,
        "message": f"Configuration de {bet_type} mise à jour avec succès",
        "bet_type": bet_type,
        "payout_formula": config.payout_formula,
        "multipliers": multipliers
    }


@prize_config_router.get("/defaults")
async def get_default_prize_configs(
    current_user: dict = Depends(get_current_user)
):
    """
    Récupère les configurations de primes par défaut du système.
    """
    defaults = {
        "BORLETTE": {
            "formula": "60|20|10",
            "description": "1er lot: x60, 2ème lot: x20, 3ème lot: x10",
            "example": "Mise 100 HTG → 1er lot: 6000 HTG, 2ème: 2000 HTG, 3ème: 1000 HTG"
        },
        "LOTO3": {
            "formula": "500",
            "description": "Match exact 3 chiffres: x500",
            "example": "Mise 100 HTG → Gain: 50000 HTG"
        },
        "LOTO4": {
            "formula": "5000",
            "description": "Match exact 4 chiffres: x5000",
            "example": "Mise 100 HTG → Gain: 500000 HTG"
        },
        "LOTO5": {
            "formula": "50000",
            "description": "Match exact 5 chiffres: x50000",
            "example": "Mise 100 HTG → Gain: 5000000 HTG"
        },
        "MARIAGE": {
            "formula": "750",
            "description": "2 numéros combinés: x750",
            "example": "Mise 100 HTG → Gain: 75000 HTG"
        },
        "MARIAGE_GRATUIT": {
            "formula": "750",
            "description": "Mariage offert: x750",
            "example": "Bonus: 75000 HTG"
        }
    }
    
    return {
        "default_configs": defaults,
        "payout_models": {
            "FIXED_MULTIPLIER": "gain = mise × multiplicateur",
            "POOL_PERCENTAGE": "gain = pourcentage du pool total (non implémenté)"
        }
    }


# ============================================================================
# AUDIT & LOGS
# ============================================================================

@settlement_router.get("/audit-logs")
async def get_settlement_audit_logs(
    settlement_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Récupère les logs d'audit des settlements.
    """
    require_super_admin(current_user)
    
    query = {}
    if settlement_id:
        query["entity_id"] = settlement_id
    if entity_type:
        query["entity_type"] = entity_type
    
    logs = await db.audit_logs.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Clean ObjectIds from nested fields
    from bson import ObjectId
    def clean_objectids(obj):
        if isinstance(obj, dict):
            return {k: clean_objectids(v) for k, v in obj.items() if k != "_id"}
        elif isinstance(obj, list):
            return [clean_objectids(item) for item in obj]
        elif isinstance(obj, ObjectId):
            return str(obj)
        return obj
    
    cleaned_logs = [clean_objectids(log) for log in logs]
    
    return {
        "audit_logs": cleaned_logs,
        "count": len(cleaned_logs)
    }


# ============================================================================
# WALLET TRANSACTIONS
# ============================================================================

@settlement_router.get("/wallet-transactions")
async def get_wallet_transactions(
    user_id: Optional[str] = None,
    reference_type: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Récupère les transactions de wallet liées aux settlements.
    """
    company_id = current_user.get("company_id")
    
    query = {}
    if current_user.get("role") != UserRole.SUPER_ADMIN and company_id:
        query["company_id"] = company_id
    
    if user_id:
        query["user_id"] = user_id
    if reference_type:
        query["reference_type"] = reference_type
    
    transactions = await db.wallet_transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "transactions": transactions,
        "count": len(transactions),
        "total_credited": sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "CREDIT")
    }
