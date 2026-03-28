"""
LOTTOLAB - Security API Routes
===============================
Endpoints for security management, audit logs, and fraud detection.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from models import UserRole
from auth import decode_token
from utils import get_current_timestamp
from security_system import (
    AuditAction, create_audit_log, get_client_info,
    LoginProtection, check_suspicious_activity
)

security_api_router = APIRouter(prefix="/api/security", tags=["Security"])
security = HTTPBearer()

db = None

def set_security_api_db(database):
    global db
    db = database


async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require admin role"""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    allowed_roles = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès admin requis")
    
    return user


# ============================================================================
# AUDIT LOGS
# ============================================================================

@security_api_router.get("/audit-logs")
async def get_audit_logs(
    request: Request,
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    severity: Optional[str] = None,
    entity_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    current_user: dict = Depends(require_admin)
):
    """
    Get security audit logs with filtering.
    Super Admin sees all, Company Admin sees only their company.
    """
    query = {}
    
    # Company Admin can only see their company's logs
    if current_user.get("role") == UserRole.COMPANY_ADMIN:
        query["company_id"] = current_user.get("company_id")
    
    # Apply filters
    if action:
        query["action"] = action
    if user_id:
        query["user_id"] = user_id
    if severity:
        query["severity"] = severity
    if entity_type:
        query["entity_type"] = entity_type
    
    # Date range
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date
        else:
            query["timestamp"] = {"$lte": end_date}
    
    # Get logs
    logs = await db.security_audit_logs.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)
    
    # Get total count
    total = await db.security_audit_logs.count_documents(query)
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@security_api_router.get("/audit-logs/actions")
async def get_audit_action_types(
    current_user: dict = Depends(require_admin)
):
    """Get all available audit action types"""
    actions = [
        {"code": AuditAction.LOGIN, "label": "Connexion"},
        {"code": AuditAction.LOGIN_FAILED, "label": "Connexion échouée"},
        {"code": AuditAction.LOGOUT, "label": "Déconnexion"},
        {"code": AuditAction.TICKET_CREATE, "label": "Création ticket"},
        {"code": AuditAction.TICKET_VOID, "label": "Annulation ticket"},
        {"code": AuditAction.TICKET_PRINT, "label": "Impression ticket"},
        {"code": AuditAction.RESULT_PUBLISH, "label": "Publication résultat"},
        {"code": AuditAction.PAYOUT_REQUEST, "label": "Demande paiement"},
        {"code": AuditAction.PAYOUT_APPROVE, "label": "Paiement approuvé"},
        {"code": AuditAction.USER_CREATE, "label": "Création utilisateur"},
        {"code": AuditAction.USER_MODIFY, "label": "Modification utilisateur"},
        {"code": AuditAction.FRAUD_ALERT, "label": "Alerte fraude"},
        {"code": AuditAction.DUPLICATE_ATTEMPT, "label": "Tentative doublon"},
        {"code": AuditAction.LIMIT_EXCEEDED, "label": "Limite dépassée"},
    ]
    return actions


# ============================================================================
# LOGIN ATTEMPTS & BLOCKS
# ============================================================================

@security_api_router.get("/login-attempts")
async def get_login_attempts(
    request: Request,
    email: Optional[str] = None,
    ip_address: Optional[str] = None,
    success: Optional[bool] = None,
    start_date: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    current_user: dict = Depends(require_admin)
):
    """Get login attempt history"""
    # Only Super Admin can see login attempts
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès Super Admin requis")
    
    query = {}
    
    if email:
        query["email"] = email.lower()
    if ip_address:
        query["ip_address"] = ip_address
    if success is not None:
        query["success"] = success
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    
    attempts = await db.login_attempts.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return attempts


@security_api_router.get("/login-blocks")
async def get_active_blocks(
    current_user: dict = Depends(require_admin)
):
    """Get currently active login blocks"""
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès Super Admin requis")
    
    now = datetime.now(timezone.utc).isoformat()
    
    blocks = await db.login_blocks.find(
        {"blocked_until": {"$gt": now}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return blocks


class UnblockRequest(BaseModel):
    email: Optional[str] = None
    ip_address: Optional[str] = None


@security_api_router.post("/login-blocks/remove")
async def remove_login_block(
    request: Request,
    data: UnblockRequest,
    current_user: dict = Depends(require_admin)
):
    """Remove a login block (Super Admin only)"""
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès Super Admin requis")
    
    if not data.email and not data.ip_address:
        raise HTTPException(status_code=400, detail="Email ou IP requis")
    
    query = {}
    if data.email:
        query["email"] = data.email.lower()
    if data.ip_address:
        query["ip_address"] = data.ip_address
    
    result = await db.login_blocks.delete_many(query)
    
    # Log the action
    await create_audit_log(
        db=db,
        action="UNBLOCK_LOGIN",
        user_id=current_user.get("user_id"),
        request=request,
        details={"email": data.email, "ip_address": data.ip_address},
        severity="INFO"
    )
    
    return {"message": f"Supprimé {result.deleted_count} blocage(s)"}


# ============================================================================
# FRAUD ALERTS
# ============================================================================

@security_api_router.get("/fraud-alerts")
async def get_fraud_alerts(
    request: Request,
    status: Optional[str] = Query(default="OPEN", regex="^(OPEN|RESOLVED|DISMISSED)$"),
    severity: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    current_user: dict = Depends(require_admin)
):
    """Get fraud alerts"""
    query = {}
    
    if current_user.get("role") == UserRole.COMPANY_ADMIN:
        query["company_id"] = current_user.get("company_id")
    
    if status:
        query["status"] = status
    if severity:
        query["severity"] = severity
    
    alerts = await db.fraud_alerts.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return alerts


class FraudAlertCreate(BaseModel):
    alert_type: str
    description: str
    entity_type: str  # ticket, user, payout
    entity_id: str
    severity: str = "WARNING"  # WARNING, CRITICAL


@security_api_router.post("/fraud-alerts")
async def create_fraud_alert(
    request: Request,
    data: FraudAlertCreate,
    current_user: dict = Depends(require_admin)
):
    """Create a manual fraud alert"""
    from utils import generate_id
    
    alert = {
        "alert_id": generate_id("fraud_"),
        "alert_type": data.alert_type,
        "description": data.description,
        "entity_type": data.entity_type,
        "entity_id": data.entity_id,
        "severity": data.severity,
        "status": "OPEN",
        "created_by": current_user.get("user_id"),
        "company_id": current_user.get("company_id"),
        "created_at": get_current_timestamp(),
        "resolved_at": None,
        "resolved_by": None,
        "resolution_notes": None
    }
    
    await db.fraud_alerts.insert_one(alert)
    
    # Create audit log
    await create_audit_log(
        db=db,
        action=AuditAction.FRAUD_ALERT,
        user_id=current_user.get("user_id"),
        request=request,
        details={"alert_type": data.alert_type, "entity_id": data.entity_id},
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        severity="WARNING",
        company_id=current_user.get("company_id")
    )
    
    return {"message": "Alerte créée", "alert_id": alert["alert_id"]}


class FraudAlertResolve(BaseModel):
    status: str  # RESOLVED, DISMISSED
    resolution_notes: str


@security_api_router.put("/fraud-alerts/{alert_id}/resolve")
async def resolve_fraud_alert(
    alert_id: str,
    request: Request,
    data: FraudAlertResolve,
    current_user: dict = Depends(require_admin)
):
    """Resolve or dismiss a fraud alert"""
    result = await db.fraud_alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {
            "status": data.status,
            "resolved_at": get_current_timestamp(),
            "resolved_by": current_user.get("user_id"),
            "resolution_notes": data.resolution_notes
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alerte non trouvée")
    
    return {"message": f"Alerte {data.status.lower()}"}


# ============================================================================
# IP BLACKLIST
# ============================================================================

@security_api_router.get("/ip-blacklist")
async def get_ip_blacklist(
    current_user: dict = Depends(require_admin)
):
    """Get IP blacklist (Super Admin only)"""
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès Super Admin requis")
    
    blacklist = await db.ip_blacklist.find(
        {"active": True},
        {"_id": 0}
    ).to_list(500)
    
    return blacklist


class IPBlacklistEntry(BaseModel):
    ip_address: str
    reason: str


@security_api_router.post("/ip-blacklist")
async def add_to_blacklist(
    request: Request,
    data: IPBlacklistEntry,
    current_user: dict = Depends(require_admin)
):
    """Add IP to blacklist (Super Admin only)"""
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès Super Admin requis")
    
    from utils import generate_id
    
    entry = {
        "entry_id": generate_id("bl_"),
        "ip_address": data.ip_address,
        "reason": data.reason,
        "active": True,
        "created_by": current_user.get("user_id"),
        "created_at": get_current_timestamp()
    }
    
    await db.ip_blacklist.insert_one(entry)
    
    # Log the action
    await create_audit_log(
        db=db,
        action="IP_BLACKLIST_ADD",
        user_id=current_user.get("user_id"),
        request=request,
        details={"ip_address": data.ip_address, "reason": data.reason},
        severity="WARNING"
    )
    
    return {"message": "IP ajoutée à la liste noire"}


@security_api_router.delete("/ip-blacklist/{ip_address}")
async def remove_from_blacklist(
    ip_address: str,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Remove IP from blacklist (Super Admin only)"""
    if current_user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès Super Admin requis")
    
    result = await db.ip_blacklist.update_one(
        {"ip_address": ip_address},
        {"$set": {"active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="IP non trouvée")
    
    return {"message": "IP retirée de la liste noire"}


# ============================================================================
# SECURITY STATS
# ============================================================================

@security_api_router.get("/stats")
async def get_security_stats(
    current_user: dict = Depends(require_admin)
):
    """Get security statistics dashboard"""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    today_start = f"{today}T00:00:00"
    week_ago = (now - timedelta(days=7)).isoformat()
    
    company_filter = {}
    if current_user.get("role") == UserRole.COMPANY_ADMIN:
        company_filter["company_id"] = current_user.get("company_id")
    
    # Today's stats
    today_logins = await db.login_attempts.count_documents({
        "timestamp": {"$gte": today_start},
        "success": True
    })
    
    today_failed = await db.login_attempts.count_documents({
        "timestamp": {"$gte": today_start},
        "success": False
    })
    
    active_blocks = await db.login_blocks.count_documents({
        "blocked_until": {"$gt": now.isoformat()}
    })
    
    open_fraud_alerts = await db.fraud_alerts.count_documents({
        "status": "OPEN",
        **company_filter
    })
    
    # Critical events this week
    critical_events = await db.security_audit_logs.count_documents({
        "timestamp": {"$gte": week_ago},
        "severity": {"$in": ["CRITICAL", "FRAUD"]},
        **company_filter
    })
    
    # Duplicate attempts
    duplicate_attempts = await db.security_audit_logs.count_documents({
        "action": AuditAction.DUPLICATE_ATTEMPT,
        "timestamp": {"$gte": week_ago},
        **company_filter
    })
    
    # Blacklisted IPs
    blacklisted_ips = await db.ip_blacklist.count_documents({"active": True})
    
    return {
        "today": {
            "successful_logins": today_logins,
            "failed_logins": today_failed,
            "active_blocks": active_blocks
        },
        "alerts": {
            "open_fraud_alerts": open_fraud_alerts,
            "critical_events_week": critical_events,
            "duplicate_attempts_week": duplicate_attempts
        },
        "blacklist": {
            "total_ips": blacklisted_ips
        },
        "generated_at": now.isoformat()
    }
