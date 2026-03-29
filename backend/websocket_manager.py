"""
LOTTOLAB WebSocket Manager v2.0
===============================
Real-time synchronization system for LOTTOLAB SaaS.
Enhanced version with company-based grouping and role filtering.

Events:
- RESULT_PUBLISHED: Super Admin publishes lottery results
- TICKET_SOLD: New ticket created by vendeur
- TICKET_WINNER: Ticket identified as winner after result publication
- TICKET_PAID: Winning ticket paid out
- TICKET_DELETED: Ticket voided/deleted
- LOTTERY_TOGGLED: Lottery activated/deactivated by Super Admin
- SCHEDULE_UPDATED: Global schedule modified
- FLAG_UPDATED: Lottery flag (HAITI/USA) changed
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List, Set, Optional, Any
from datetime import datetime, timezone
import json
import asyncio
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time updates.
    Connections are organized by:
    - company_id: For company-specific events
    - role: For role-based filtering (SUPER_ADMIN, COMPANY_ADMIN, BRANCH_SUPERVISOR, AGENT_POS)
    - user_id: For user-specific events
    """
    
    def __init__(self):
        # Main connection storage: {user_id: WebSocket}
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Index by company: {company_id: Set[user_id]}
        self.company_connections: Dict[str, Set[str]] = {}
        
        # Index by role: {role: Set[user_id]}
        self.role_connections: Dict[str, Set[str]] = {}
        
        # User metadata: {user_id: {company_id, role, name, ...}}
        self.user_metadata: Dict[str, Dict[str, Any]] = {}
        
        # Super admin connections (global broadcast)
        self.super_admin_connections: Set[str] = set()
        
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
        
        # Legacy support - keep old structure for backward compatibility
        self.player_connections: Dict[str, List[WebSocket]] = {}
        self.admin_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(
        self, 
        websocket: WebSocket, 
        user_id: str, 
        company_id: Optional[str] = None, 
        role: str = "AGENT_POS",
        user_name: str = "Unknown"
    ):
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        
        async with self._lock:
            # Store connection
            self.active_connections[user_id] = websocket
            
            # Store metadata
            self.user_metadata[user_id] = {
                "company_id": company_id,
                "role": role,
                "name": user_name,
                "connected_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Index by company
            if company_id:
                if company_id not in self.company_connections:
                    self.company_connections[company_id] = set()
                self.company_connections[company_id].add(user_id)
            
            # Index by role
            if role not in self.role_connections:
                self.role_connections[role] = set()
            self.role_connections[role].add(user_id)
            
            # Track super admins separately
            if role == "SUPER_ADMIN":
                self.super_admin_connections.add(user_id)
        
        logger.info(f"[WS] Connected: {user_id} ({role}) - Company: {company_id}")
        
        # Send welcome message
        await self.send_personal_message(user_id, {
            "type": "CONNECTION_ESTABLISHED",
            "message": "Connexion temps réel établie",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return True
    
    # Legacy methods for backward compatibility
    async def connect_player(self, websocket: WebSocket, player_id: str):
        """Legacy: Connect a player's WebSocket"""
        return await self.connect(websocket, player_id, None, "PLAYER", "Player")
    
    async def connect_admin(self, websocket: WebSocket, user_id: str):
        """Legacy: Connect an admin's WebSocket"""
        return await self.connect(websocket, user_id, None, "ADMIN", "Admin")
    
    async def disconnect(self, user_id: str):
        """Remove a WebSocket connection."""
        async with self._lock:
            if user_id in self.active_connections:
                # Get metadata before removal
                metadata = self.user_metadata.get(user_id, {})
                company_id = metadata.get("company_id")
                role = metadata.get("role")
                
                # Remove from main storage
                del self.active_connections[user_id]
                
                # Remove from company index
                if company_id and company_id in self.company_connections:
                    self.company_connections[company_id].discard(user_id)
                    if not self.company_connections[company_id]:
                        del self.company_connections[company_id]
                
                # Remove from role index
                if role and role in self.role_connections:
                    self.role_connections[role].discard(user_id)
                    if not self.role_connections[role]:
                        del self.role_connections[role]
                
                # Remove from super admin set
                self.super_admin_connections.discard(user_id)
                
                # Remove metadata
                if user_id in self.user_metadata:
                    del self.user_metadata[user_id]
                
                logger.info(f"[WS] Disconnected: {user_id}")
    
    # Legacy disconnect methods
    def disconnect_player(self, websocket: WebSocket, player_id: str):
        asyncio.create_task(self.disconnect(player_id))
    
    def disconnect_admin(self, websocket: WebSocket, user_id: str):
        asyncio.create_task(self.disconnect(user_id))
    
    async def send_personal_message(self, user_id: str, message: dict):
        """Send a message to a specific user."""
        if user_id in self.active_connections:
            try:
                websocket = self.active_connections[user_id]
                await websocket.send_json(message)
                return True
            except Exception as e:
                logger.error(f"[WS] Error sending to {user_id}: {e}")
                await self.disconnect(user_id)
        return False
    
    async def broadcast_to_company(self, company_id: str, message: dict, exclude_user: str = None):
        """Broadcast a message to all users of a specific company."""
        if company_id not in self.company_connections:
            return 0
        
        sent_count = 0
        user_ids = list(self.company_connections.get(company_id, set()))
        for user_id in user_ids:
            if exclude_user and user_id == exclude_user:
                continue
            if await self.send_personal_message(user_id, message):
                sent_count += 1
        
        logger.info(f"[WS] Broadcast to company {company_id}: {sent_count} recipients")
        return sent_count
    
    async def broadcast_to_role(self, role: str, message: dict, company_id: str = None):
        """Broadcast a message to all users with a specific role."""
        sent_count = 0
        user_ids = list(self.role_connections.get(role, set()))
        
        for user_id in user_ids:
            # Filter by company if specified
            if company_id:
                metadata = self.user_metadata.get(user_id, {})
                if metadata.get("company_id") != company_id:
                    continue
            if await self.send_personal_message(user_id, message):
                sent_count += 1
        
        return sent_count
    
    async def broadcast_to_super_admins(self, message: dict):
        """Broadcast a message to all super admins."""
        sent_count = 0
        for user_id in list(self.super_admin_connections):
            if await self.send_personal_message(user_id, message):
                sent_count += 1
        return sent_count
    
    async def broadcast_global(self, message: dict):
        """Broadcast a message to ALL connected users."""
        sent_count = 0
        for user_id in list(self.active_connections.keys()):
            if await self.send_personal_message(user_id, message):
                sent_count += 1
        
        logger.info(f"[WS] Global broadcast: {sent_count} recipients")
        return sent_count
    
    # Legacy broadcast method
    async def broadcast(self, message: dict):
        """Legacy: Broadcast to all connections."""
        return await self.broadcast_global(message)
    
    async def send_to_player(self, player_id: str, message: dict):
        """Legacy: Send to a specific player."""
        return await self.send_personal_message(player_id, message)
    
    async def send_to_admin(self, user_id: str, message: dict):
        """Legacy: Send to a specific admin."""
        return await self.send_personal_message(user_id, message)
    
    def get_connection_stats(self) -> dict:
        """Get current connection statistics."""
        return {
            "total_connections": len(self.active_connections),
            "companies_connected": len(self.company_connections),
            "super_admins_online": len(self.super_admin_connections),
            "by_role": {role: len(users) for role, users in self.role_connections.items()},
            "by_company": {cid: len(users) for cid, users in self.company_connections.items()}
        }


# Global connection manager instance
ws_manager = ConnectionManager()


# ============ EVENT TYPES ============

class WSEventType:
    """WebSocket event types for real-time updates."""
    
    # Results
    RESULT_PUBLISHED = "RESULT_PUBLISHED"
    RESULT_UPDATED = "RESULT_UPDATED"
    
    # Tickets
    TICKET_SOLD = "TICKET_SOLD"
    TICKET_WINNER = "TICKET_WINNER"
    TICKET_PAID = "TICKET_PAID"
    TICKET_DELETED = "TICKET_DELETED"
    
    # Lotteries
    LOTTERY_TOGGLED = "LOTTERY_TOGGLED"
    LOTTERY_UPDATED = "LOTTERY_UPDATED"
    
    # Schedules
    SCHEDULE_UPDATED = "SCHEDULE_UPDATED"
    SCHEDULE_CREATED = "SCHEDULE_CREATED"
    
    # Flags
    FLAG_UPDATED = "FLAG_UPDATED"
    
    # System
    SYNC_REQUIRED = "SYNC_REQUIRED"
    CONNECTION_ESTABLISHED = "CONNECTION_ESTABLISHED"
    HEARTBEAT = "HEARTBEAT"
    
    # Legacy (for online betting)
    NEW_RESULT = "new_result"
    TICKET_UPDATE = "ticket_update"
    BALANCE_UPDATE = "balance_update"
    DEPOSIT_CONFIRMED = "deposit_confirmed"
    WITHDRAWAL_STATUS = "withdrawal_status"


# ============ EVENT HELPERS ============

async def emit_result_published(
    lottery_id: str,
    lottery_name: str,
    draw_name: str,
    winning_numbers: str,
    result_id: str
):
    """Emit event when Super Admin publishes a result."""
    event = {
        "type": WSEventType.RESULT_PUBLISHED,
        "data": {
            "lottery_id": lottery_id,
            "lottery_name": lottery_name,
            "draw_name": draw_name,
            "winning_numbers": winning_numbers,
            "result_id": result_id
        },
        "message": f"Nouveau résultat: {lottery_name} {draw_name} - {winning_numbers}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority": "high"
    }
    
    # Broadcast to ALL users (everyone needs to see results)
    count = await ws_manager.broadcast_global(event)
    logger.info(f"[WS] RESULT_PUBLISHED: {lottery_name} - {winning_numbers} -> {count} recipients")
    return count


async def emit_ticket_sold(
    company_id: str,
    ticket_code: str,
    ticket_id: str,
    agent_id: str,
    agent_name: str,
    total_amount: float,
    lottery_name: str
):
    """Emit event when a vendeur sells a ticket."""
    event = {
        "type": WSEventType.TICKET_SOLD,
        "data": {
            "ticket_code": ticket_code,
            "ticket_id": ticket_id,
            "agent_id": agent_id,
            "agent_name": agent_name,
            "total_amount": total_amount,
            "lottery_name": lottery_name
        },
        "message": f"Nouveau ticket: {ticket_code} - {total_amount} HTG",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority": "normal"
    }
    
    # Broadcast to company (supervisors and admins see new sales)
    count = await ws_manager.broadcast_to_company(company_id, event, exclude_user=agent_id)
    logger.info(f"[WS] TICKET_SOLD: {ticket_code} -> {count} recipients")
    return count


async def emit_ticket_winner(
    company_id: str,
    ticket_code: str,
    ticket_id: str,
    agent_id: str,
    agent_name: str,
    win_amount: float,
    lottery_name: str
):
    """Emit event when a ticket is identified as winner."""
    event = {
        "type": WSEventType.TICKET_WINNER,
        "data": {
            "ticket_code": ticket_code,
            "ticket_id": ticket_id,
            "agent_id": agent_id,
            "agent_name": agent_name,
            "win_amount": win_amount,
            "lottery_name": lottery_name
        },
        "message": f"GAGNANT! Ticket {ticket_code} - {win_amount:,.0f} HTG",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority": "high"
    }
    
    # Broadcast to company
    count = await ws_manager.broadcast_to_company(company_id, event)
    
    # Also ensure the agent gets it
    await ws_manager.send_personal_message(agent_id, event)
    
    logger.info(f"[WS] TICKET_WINNER: {ticket_code} - {win_amount} HTG -> {count} recipients")
    return count


async def emit_ticket_paid(
    company_id: str,
    ticket_code: str,
    ticket_id: str,
    paid_amount: float,
    paid_by: str
):
    """Emit event when a winning ticket is paid."""
    event = {
        "type": WSEventType.TICKET_PAID,
        "data": {
            "ticket_code": ticket_code,
            "ticket_id": ticket_id,
            "paid_amount": paid_amount,
            "paid_by": paid_by
        },
        "message": f"Ticket payé: {ticket_code} - {paid_amount:,.0f} HTG",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority": "normal"
    }
    
    count = await ws_manager.broadcast_to_company(company_id, event)
    logger.info(f"[WS] TICKET_PAID: {ticket_code} -> {count} recipients")
    return count


async def emit_ticket_deleted(
    company_id: str,
    ticket_code: str,
    ticket_id: str,
    deleted_by: str,
    reason: str = ""
):
    """Emit event when a ticket is deleted/voided."""
    event = {
        "type": WSEventType.TICKET_DELETED,
        "data": {
            "ticket_code": ticket_code,
            "ticket_id": ticket_id,
            "deleted_by": deleted_by,
            "reason": reason
        },
        "message": f"Ticket supprimé: {ticket_code}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority": "normal"
    }
    
    count = await ws_manager.broadcast_to_company(company_id, event)
    logger.info(f"[WS] TICKET_DELETED: {ticket_code} -> {count} recipients")
    return count


async def emit_lottery_toggled(
    lottery_id: str,
    lottery_name: str,
    is_active: bool
):
    """Emit event when Super Admin activates/deactivates a lottery."""
    event = {
        "type": WSEventType.LOTTERY_TOGGLED,
        "data": {
            "lottery_id": lottery_id,
            "lottery_name": lottery_name,
            "is_active": is_active
        },
        "message": f"Loterie {'activée' if is_active else 'désactivée'}: {lottery_name}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority": "high"
    }
    
    count = await ws_manager.broadcast_global(event)
    logger.info(f"[WS] LOTTERY_TOGGLED: {lottery_name} -> {is_active} -> {count} recipients")
    return count


async def emit_schedule_updated(
    schedule_id: str,
    lottery_name: str,
    draw_name: str,
    changes: dict = None
):
    """Emit event when a schedule is updated."""
    event = {
        "type": WSEventType.SCHEDULE_UPDATED,
        "data": {
            "schedule_id": schedule_id,
            "lottery_name": lottery_name,
            "draw_name": draw_name,
            "changes": changes or {}
        },
        "message": f"Horaire modifié: {lottery_name} {draw_name}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority": "normal"
    }
    
    count = await ws_manager.broadcast_global(event)
    logger.info(f"[WS] SCHEDULE_UPDATED: {schedule_id} -> {count} recipients")
    return count


async def emit_flag_updated(
    lottery_id: str,
    lottery_name: str,
    new_flag: str
):
    """Emit event when a lottery flag is changed."""
    event = {
        "type": WSEventType.FLAG_UPDATED,
        "data": {
            "lottery_id": lottery_id,
            "lottery_name": lottery_name,
            "flag_type": new_flag
        },
        "message": f"Drapeau modifié: {lottery_name} -> {new_flag}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority": "low"
    }
    
    count = await ws_manager.broadcast_global(event)
    logger.info(f"[WS] FLAG_UPDATED: {lottery_name} -> {new_flag} -> {count} recipients")
    return count


async def emit_sync_required(company_id: str = None, reason: str = ""):
    """Emit event requesting clients to resync their data."""
    event = {
        "type": WSEventType.SYNC_REQUIRED,
        "data": {"reason": reason},
        "message": "Synchronisation requise",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority": "high"
    }
    
    if company_id:
        count = await ws_manager.broadcast_to_company(company_id, event)
    else:
        count = await ws_manager.broadcast_global(event)
    
    logger.info(f"[WS] SYNC_REQUIRED -> {count} recipients")
    return count
