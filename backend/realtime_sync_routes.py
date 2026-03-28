"""
LOTTOLAB - Real-Time Global Sync System
Provides polling endpoint for real-time synchronization across all clients.
Updates: Results, Notifications, Tickets, Config changes
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import asyncio

from models import UserRole
from auth import decode_token
from utils import get_current_timestamp

realtime_sync_router = APIRouter(prefix="/api", tags=["Real-Time Sync"])
security = HTTPBearer()

db = None

def set_realtime_sync_db(database):
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
# GLOBAL SYNC ENDPOINT - Poll every 5-10 seconds
# ============================================================================

@realtime_sync_router.get("/sync/global")
async def get_global_sync(
    last_sync: Optional[str] = None,  # ISO timestamp of last sync
    current_user: dict = Depends(get_current_user)
):
    """
    Global synchronization endpoint.
    Returns all updates since last_sync timestamp.
    
    Poll this endpoint every 5-10 seconds for real-time updates.
    
    Returns:
    - new_results: New lottery results since last sync
    - new_notifications: New notifications (with unread count)
    - config_version: Current config version (if changed, reload full config)
    - server_time: Current server time for sync
    """
    user_id = current_user.get("user_id")
    company_id = current_user.get("company_id")
    role = current_user.get("role")
    
    # Parse last_sync or default to 1 hour ago
    if last_sync:
        try:
            sync_time = last_sync
        except:
            sync_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    else:
        sync_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    
    # ---- 1. NEW RESULTS ----
    new_results = []
    
    if company_id:
        # Get enabled lotteries for this company
        company_lotteries = await db.company_lotteries.find(
            {"company_id": company_id, "$or": [{"is_enabled": True}, {"enabled": True}]},
            {"lottery_id": 1}
        ).to_list(300)
        lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
        
        if lottery_ids:
            new_results = await db.global_results.find(
                {
                    "lottery_id": {"$in": lottery_ids},
                    "created_at": {"$gt": sync_time}
                },
                {"_id": 0}
            ).sort("created_at", -1).limit(20).to_list(20)
    elif role == UserRole.SUPER_ADMIN:
        # Super admin sees all results
        new_results = await db.global_results.find(
            {"created_at": {"$gt": sync_time}},
            {"_id": 0}
        ).sort("created_at", -1).limit(50).to_list(50)
    
    # ---- 2. NOTIFICATIONS ----
    # Build query for user-visible notifications
    notif_query = {
        "created_at": {"$gt": sync_time},
        "$or": [
            {"target_user_id": user_id},
            {"target_company_id": company_id, "target_user_id": None} if company_id else {"_id": None},
            {"target_role": role, "target_user_id": None, "target_company_id": None},
            {"target_role": None, "target_user_id": None, "target_company_id": None}
        ]
    }
    
    new_notifications = await db.notifications.find(
        notif_query,
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Get unread count
    all_notif_query = {
        "$or": [
            {"target_user_id": user_id},
            {"target_company_id": company_id, "target_user_id": None} if company_id else {"_id": None},
            {"target_role": role, "target_user_id": None, "target_company_id": None},
            {"target_role": None, "target_user_id": None, "target_company_id": None}
        ]
    }
    
    # Count all notifications
    all_notifications = await db.notifications.find(all_notif_query, {"notification_id": 1}).to_list(500)
    all_notif_ids = [n["notification_id"] for n in all_notifications]
    
    # Get read ones
    read_notifs = await db.notification_reads.find(
        {"user_id": user_id, "notification_id": {"$in": all_notif_ids}},
        {"notification_id": 1}
    ).to_list(500)
    read_ids = {r["notification_id"] for r in read_notifs}
    
    unread_count = sum(1 for nid in all_notif_ids if nid not in read_ids)
    
    # Add read status to new notifications
    for notif in new_notifications:
        notif["read"] = notif.get("notification_id") in read_ids
        notif["id"] = notif.get("notification_id")
    
    # ---- 3. CONFIG VERSION ----
    config_version = 1
    if company_id:
        version_doc = await db.company_config_versions.find_one(
            {"company_id": company_id},
            {"_id": 0, "version": 1}
        )
        if version_doc:
            config_version = version_doc.get("version", 1)
    
    # ---- 4. RECENT TICKETS (for agents/supervisors) ----
    recent_tickets = []
    if role in [UserRole.AGENT_POS, UserRole.BRANCH_SUPERVISOR, "VENDEUR"]:
        ticket_query = {
            "created_at": {"$gt": sync_time}
        }
        if role == UserRole.AGENT_POS:
            ticket_query["agent_id"] = user_id
        elif role == UserRole.BRANCH_SUPERVISOR:
            ticket_query["company_id"] = company_id
            # Could also filter by succursale_id
        
        recent_tickets = await db.lottery_transactions.find(
            ticket_query,
            {"_id": 0, "ticket_id": 1, "ticket_code": 1, "total_amount": 1, "status": 1, "created_at": 1}
        ).sort("created_at", -1).limit(10).to_list(10)
    
    # ---- 5. WINNING TICKETS (for company admin and supervisors) ----
    new_winners = []
    if role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER, UserRole.BRANCH_SUPERVISOR]:
        new_winners = await db.lottery_transactions.find(
            {
                "company_id": company_id,
                "status": "WINNER",
                "updated_at": {"$gt": sync_time}
            },
            {"_id": 0, "ticket_id": 1, "ticket_code": 1, "win_amount": 1, "lottery_name": 1, "updated_at": 1}
        ).sort("updated_at", -1).limit(10).to_list(10)
    
    return {
        "new_results": new_results,
        "results_count": len(new_results),
        "new_notifications": new_notifications,
        "notifications_count": len(new_notifications),
        "unread_notifications": unread_count,
        "config_version": config_version,
        "recent_tickets": recent_tickets,
        "new_winners": new_winners,
        "server_time": get_current_timestamp(),
        "sync_from": sync_time
    }


# ============================================================================
# LIGHTWEIGHT PING - Check for updates without full data
# ============================================================================

@realtime_sync_router.get("/sync/ping")
async def sync_ping(
    last_config_version: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Lightweight ping endpoint.
    Returns only counts and version numbers for quick checks.
    Use this for frequent polling (every 2-3 seconds).
    """
    user_id = current_user.get("user_id")
    company_id = current_user.get("company_id")
    role = current_user.get("role")
    
    # Get config version
    config_version = 1
    if company_id:
        version_doc = await db.company_config_versions.find_one(
            {"company_id": company_id},
            {"_id": 0, "version": 1}
        )
        if version_doc:
            config_version = version_doc.get("version", 1)
    
    # Check if config changed
    config_changed = last_config_version is not None and config_version > last_config_version
    
    # Count unread notifications
    notif_query = {
        "$or": [
            {"target_user_id": user_id},
            {"target_company_id": company_id, "target_user_id": None} if company_id else {"_id": None},
            {"target_role": role, "target_user_id": None, "target_company_id": None},
            {"target_role": None, "target_user_id": None, "target_company_id": None}
        ]
    }
    
    all_notifications = await db.notifications.find(notif_query, {"notification_id": 1}).to_list(500)
    all_notif_ids = [n["notification_id"] for n in all_notifications]
    
    read_notifs = await db.notification_reads.find(
        {"user_id": user_id, "notification_id": {"$in": all_notif_ids}},
        {"notification_id": 1}
    ).to_list(500)
    read_ids = {r["notification_id"] for r in read_notifs}
    
    unread_count = sum(1 for nid in all_notif_ids if nid not in read_ids)
    
    # Count today's results
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_results_count = 0
    if company_id:
        company_lotteries = await db.company_lotteries.find(
            {"company_id": company_id, "$or": [{"is_enabled": True}, {"enabled": True}]},
            {"lottery_id": 1}
        ).to_list(300)
        lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
        
        if lottery_ids:
            today_results_count = await db.global_results.count_documents({
                "lottery_id": {"$in": lottery_ids},
                "draw_date": today
            })
    
    return {
        "config_version": config_version,
        "config_changed": config_changed,
        "unread_notifications": unread_count,
        "today_results": today_results_count,
        "server_time": get_current_timestamp()
    }


# ============================================================================
# LATEST RESULTS - Get most recent results
# ============================================================================

@realtime_sync_router.get("/sync/latest-results")
async def get_latest_results(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the most recent lottery results for the user's company.
    """
    company_id = current_user.get("company_id")
    role = current_user.get("role")
    
    if role == UserRole.SUPER_ADMIN:
        # Super admin sees all results
        results = await db.global_results.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
    elif company_id:
        # Get enabled lotteries
        company_lotteries = await db.company_lotteries.find(
            {"company_id": company_id, "$or": [{"is_enabled": True}, {"enabled": True}]},
            {"lottery_id": 1}
        ).to_list(300)
        lottery_ids = [cl["lottery_id"] for cl in company_lotteries]
        
        if lottery_ids:
            results = await db.global_results.find(
                {"lottery_id": {"$in": lottery_ids}},
                {"_id": 0}
            ).sort("created_at", -1).limit(limit).to_list(limit)
        else:
            results = []
    else:
        results = []
    
    return {"results": results, "count": len(results)}
