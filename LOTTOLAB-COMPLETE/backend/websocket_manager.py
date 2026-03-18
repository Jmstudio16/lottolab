"""
WebSocket Manager for LOTO PAM Real-Time Notifications
Handles connections for players, admin, and broadcasts
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List, Optional
import json
from datetime import datetime, timezone
import asyncio

class ConnectionManager:
    """Manages WebSocket connections for real-time notifications"""
    
    def __init__(self):
        # Player connections: {player_id: [websocket1, websocket2, ...]}
        self.player_connections: Dict[str, List[WebSocket]] = {}
        
        # Admin connections: {user_id: [websocket1, websocket2, ...]}
        self.admin_connections: Dict[str, List[WebSocket]] = {}
        
        # All active connections for broadcast
        self.active_connections: List[WebSocket] = []
    
    async def connect_player(self, websocket: WebSocket, player_id: str):
        """Connect a player's WebSocket"""
        await websocket.accept()
        if player_id not in self.player_connections:
            self.player_connections[player_id] = []
        self.player_connections[player_id].append(websocket)
        self.active_connections.append(websocket)
        print(f"[WS] Player {player_id} connected. Total: {len(self.active_connections)}")
    
    async def connect_admin(self, websocket: WebSocket, user_id: str):
        """Connect an admin's WebSocket"""
        await websocket.accept()
        if user_id not in self.admin_connections:
            self.admin_connections[user_id] = []
        self.admin_connections[user_id].append(websocket)
        self.active_connections.append(websocket)
        print(f"[WS] Admin {user_id} connected. Total: {len(self.active_connections)}")
    
    def disconnect_player(self, websocket: WebSocket, player_id: str):
        """Disconnect a player's WebSocket"""
        if player_id in self.player_connections:
            if websocket in self.player_connections[player_id]:
                self.player_connections[player_id].remove(websocket)
            if not self.player_connections[player_id]:
                del self.player_connections[player_id]
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"[WS] Player {player_id} disconnected. Total: {len(self.active_connections)}")
    
    def disconnect_admin(self, websocket: WebSocket, user_id: str):
        """Disconnect an admin's WebSocket"""
        if user_id in self.admin_connections:
            if websocket in self.admin_connections[user_id]:
                self.admin_connections[user_id].remove(websocket)
            if not self.admin_connections[user_id]:
                del self.admin_connections[user_id]
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"[WS] Admin {user_id} disconnected. Total: {len(self.active_connections)}")
    
    async def send_to_player(self, player_id: str, message: dict):
        """Send message to a specific player"""
        if player_id in self.player_connections:
            dead_connections = []
            for ws in self.player_connections[player_id]:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    print(f"[WS] Error sending to player {player_id}: {e}")
                    dead_connections.append(ws)
            
            # Clean up dead connections
            for ws in dead_connections:
                self.disconnect_player(ws, player_id)
    
    async def send_to_admins(self, message: dict):
        """Send message to all connected admins"""
        for user_id, connections in list(self.admin_connections.items()):
            dead_connections = []
            for ws in connections:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    print(f"[WS] Error sending to admin {user_id}: {e}")
                    dead_connections.append(ws)
            
            # Clean up dead connections
            for ws in dead_connections:
                self.disconnect_admin(ws, user_id)
    
    async def broadcast_to_players(self, message: dict):
        """Broadcast message to all connected players"""
        for player_id in list(self.player_connections.keys()):
            await self.send_to_player(player_id, message)
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connections"""
        dead_connections = []
        for ws in self.active_connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead_connections.append(ws)
        
        # Clean up dead connections
        for ws in dead_connections:
            if ws in self.active_connections:
                self.active_connections.remove(ws)


# Global instance
ws_manager = ConnectionManager()


# Notification Types
class NotificationType:
    # Player notifications
    RESULT_PUBLISHED = "result_published"
    TICKET_WON = "ticket_won"
    TICKET_LOST = "ticket_lost"
    WALLET_CREDITED = "wallet_credited"
    WALLET_DEBITED = "wallet_debited"
    DEPOSIT_APPROVED = "deposit_approved"
    DEPOSIT_REJECTED = "deposit_rejected"
    WITHDRAWAL_PROCESSED = "withdrawal_processed"
    WITHDRAWAL_REJECTED = "withdrawal_rejected"
    KYC_APPROVED = "kyc_approved"
    KYC_REJECTED = "kyc_rejected"
    ACCOUNT_ALERT = "account_alert"
    
    # Admin notifications
    NEW_DEPOSIT = "new_deposit"
    NEW_WITHDRAWAL = "new_withdrawal"
    NEW_KYC = "new_kyc"
    FRAUD_ALERT = "fraud_alert"
    HIGH_WIN = "high_win"


async def notify_player(player_id: str, notification_type: str, data: dict = None):
    """Send notification to a player"""
    message = {
        "type": notification_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data or {}
    }
    await ws_manager.send_to_player(player_id, message)


async def notify_admins(notification_type: str, data: dict = None):
    """Send notification to all admins"""
    message = {
        "type": notification_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data or {}
    }
    await ws_manager.send_to_admins(message)


async def broadcast_result(result_data: dict):
    """Broadcast a new result to all players"""
    message = {
        "type": NotificationType.RESULT_PUBLISHED,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": result_data
    }
    await ws_manager.broadcast_to_players(message)
