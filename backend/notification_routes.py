"""
LOTTOLAB - Notification System
Full notification management with read/unread states, mark all read, and persistence.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from models import UserRole
from auth import decode_token
from utils import generate_id, get_current_timestamp

notification_router = APIRouter(prefix="/api", tags=["Notifications"])
security = HTTPBearer()

db = None

def set_notification_db(database):
    global db
    db = database


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


# ============================================================================
# NOTIFICATION MODELS
# ============================================================================

class CreateNotificationRequest(BaseModel):
    type: str = "INFO"  # INFO, WINNER, RESULT, SALE, TICKET, PAYMENT, USER, ALERT
    title: str
    message: str
    target_role: Optional[str] = None  # If set, only users with this role see it
    target_company_id: Optional[str] = None  # If set, only users in this company see it
    target_user_id: Optional[str] = None  # If set, only this specific user sees it
    metadata: Optional[dict] = None


# ============================================================================
# GET NOTIFICATIONS - Universal for all roles
# ============================================================================

@notification_router.get("/notifications")
async def get_notifications(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Get notifications for the current user.
    Filters by role, company, and user-specific notifications.
    """
    user_id = current_user.get("user_id")
    company_id = current_user.get("company_id")
    role = current_user.get("role")
    
    # Build query for notifications visible to this user
    query = {
        "$or": [
            # User-specific notifications
            {"target_user_id": user_id},
            # Company-wide notifications (for non-super-admin)
            {"target_company_id": company_id, "target_user_id": None} if company_id else {"_id": None},
            # Role-specific notifications
            {"target_role": role, "target_user_id": None, "target_company_id": None},
            # Global notifications (no target filters)
            {"target_role": None, "target_user_id": None, "target_company_id": None}
        ]
    }
    
    # Get notifications sorted by newest first
    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Check read status for each notification
    user_read_notifs = await db.notification_reads.find(
        {"user_id": user_id},
        {"notification_id": 1}
    ).to_list(1000)
    
    read_ids = {r["notification_id"] for r in user_read_notifs}
    
    # Add read status to each notification
    for notif in notifications:
        notif["read"] = notif.get("notification_id") in read_ids
        notif["id"] = notif.get("notification_id")  # Frontend compatibility
    
    return notifications


# ============================================================================
# ROLE-SPECIFIC ENDPOINTS (All redirect to main GET)
# ============================================================================

@notification_router.get("/saas/notifications")
async def get_super_admin_notifications(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Super Admin notifications - same logic, filtered by role"""
    return await get_notifications(limit, current_user)


@notification_router.get("/company/notifications")
async def get_company_notifications(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Company Admin/Manager notifications"""
    return await get_notifications(limit, current_user)


@notification_router.get("/supervisor/notifications")
async def get_supervisor_notifications(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Supervisor notifications"""
    return await get_notifications(limit, current_user)


@notification_router.get("/vendeur/notifications")
async def get_vendeur_notifications(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Vendeur/Agent notifications"""
    return await get_notifications(limit, current_user)


# ============================================================================
# MARK AS READ
# ============================================================================

@notification_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a single notification as read for the current user"""
    user_id = current_user.get("user_id")
    now = get_current_timestamp()
    
    # Check if already read
    existing = await db.notification_reads.find_one({
        "user_id": user_id,
        "notification_id": notification_id
    })
    
    if not existing:
        await db.notification_reads.insert_one({
            "read_id": generate_id("nr_"),
            "user_id": user_id,
            "notification_id": notification_id,
            "read_at": now
        })
    
    return {"message": "Notification marquée comme lue", "notification_id": notification_id}


@notification_router.put("/notifications/mark-all-read")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user)
):
    """Mark all notifications as read for the current user"""
    user_id = current_user.get("user_id")
    company_id = current_user.get("company_id")
    role = current_user.get("role")
    now = get_current_timestamp()
    
    # Get all visible notifications for this user
    query = {
        "$or": [
            {"target_user_id": user_id},
            {"target_company_id": company_id, "target_user_id": None} if company_id else {"_id": None},
            {"target_role": role, "target_user_id": None, "target_company_id": None},
            {"target_role": None, "target_user_id": None, "target_company_id": None}
        ]
    }
    
    notifications = await db.notifications.find(query, {"notification_id": 1}).to_list(1000)
    
    # Get already read ones
    existing_reads = await db.notification_reads.find(
        {"user_id": user_id},
        {"notification_id": 1}
    ).to_list(1000)
    already_read_ids = {r["notification_id"] for r in existing_reads}
    
    # Mark unread ones as read
    new_reads = []
    for notif in notifications:
        nid = notif.get("notification_id")
        if nid and nid not in already_read_ids:
            new_reads.append({
                "read_id": generate_id("nr_"),
                "user_id": user_id,
                "notification_id": nid,
                "read_at": now
            })
    
    if new_reads:
        await db.notification_reads.insert_many(new_reads)
    
    return {"message": "Toutes les notifications marquées comme lues", "count": len(new_reads)}


# ============================================================================
# CREATE NOTIFICATION (Admin use)
# ============================================================================

@notification_router.post("/notifications")
async def create_notification(
    data: CreateNotificationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new notification (Admin only)"""
    # Only admins can create notifications
    allowed_roles = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    now = get_current_timestamp()
    notification_id = generate_id("notif_")
    
    notification = {
        "notification_id": notification_id,
        "type": data.type,
        "title": data.title,
        "message": data.message,
        "target_role": data.target_role,
        "target_company_id": data.target_company_id or current_user.get("company_id"),
        "target_user_id": data.target_user_id,
        "metadata": data.metadata or {},
        "created_by": current_user.get("user_id"),
        "created_at": now
    }
    
    await db.notifications.insert_one(notification)
    
    return {"message": "Notification créée", "notification_id": notification_id}


# ============================================================================
# DELETE NOTIFICATION
# ============================================================================

@notification_router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a notification (Admin only)"""
    allowed_roles = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    result = await db.notifications.delete_one({"notification_id": notification_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification non trouvée")
    
    # Also delete read records
    await db.notification_reads.delete_many({"notification_id": notification_id})
    
    return {"message": "Notification supprimée"}


# ============================================================================
# UTILITY: Create system notification (for internal use)
# ============================================================================

async def create_system_notification(
    notification_type: str,
    title: str,
    message: str,
    target_role: str = None,
    target_company_id: str = None,
    target_user_id: str = None,
    metadata: dict = None
):
    """
    Create a system notification (called from other modules).
    Use this for automatic notifications like:
    - New result published
    - Winning ticket detected
    - Subscription expiring
    """
    now = get_current_timestamp()
    notification_id = generate_id("notif_")
    
    notification = {
        "notification_id": notification_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "target_role": target_role,
        "target_company_id": target_company_id,
        "target_user_id": target_user_id,
        "metadata": metadata or {},
        "created_by": "SYSTEM",
        "created_at": now
    }
    
    await db.notifications.insert_one(notification)
    return notification_id
