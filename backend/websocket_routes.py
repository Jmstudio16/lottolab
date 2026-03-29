"""
LOTTOLAB WebSocket Routes
========================
WebSocket endpoints for real-time communication.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException
from typing import Optional
import jwt
import os
import json
import asyncio
from datetime import datetime, timezone

from websocket_manager import ws_manager

ws_router = APIRouter(tags=["WebSocket"])

JWT_SECRET = os.getenv("JWT_SECRET", "lottolab-super-secret-key-2024-production")
JWT_ALGORITHM = "HS256"


def decode_token(token: str) -> dict:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


@ws_router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    Main WebSocket endpoint for real-time updates.
    
    Connect with: ws://host/api/ws?token=YOUR_JWT_TOKEN
    
    Events received:
    - CONNECTION_ESTABLISHED: Connection successful
    - RESULT_PUBLISHED: New lottery result
    - TICKET_SOLD: New ticket created
    - TICKET_WINNER: Ticket won
    - TICKET_PAID: Ticket paid out
    - TICKET_DELETED: Ticket voided
    - LOTTERY_TOGGLED: Lottery status changed
    - SCHEDULE_UPDATED: Schedule modified
    - SYNC_REQUIRED: Client should refresh data
    """
    
    # Validate token
    if not token:
        await websocket.close(code=4001, reason="Token requis")
        return
    
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4002, reason="Token invalide ou expiré")
        return
    
    user_id = payload.get("user_id")
    company_id = payload.get("company_id")
    role = payload.get("role", "AGENT_POS")
    user_name = payload.get("name", "Unknown")
    
    if not user_id:
        await websocket.close(code=4003, reason="User ID manquant dans le token")
        return
    
    # Connect
    await ws_manager.connect(
        websocket=websocket,
        user_id=user_id,
        company_id=company_id,
        role=role,
        user_name=user_name
    )
    
    try:
        # Keep connection alive and listen for messages
        while True:
            try:
                # Wait for messages from client (with timeout for heartbeat)
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )
                
                # Handle client messages
                try:
                    message = json.loads(data)
                    msg_type = message.get("type", "")
                    
                    if msg_type == "PING":
                        # Respond to ping
                        await websocket.send_json({
                            "type": "PONG",
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                    
                    elif msg_type == "SUBSCRIBE":
                        # Client wants to subscribe to specific events
                        # (Future enhancement)
                        pass
                    
                except json.JSONDecodeError:
                    # Plain text message - could be a simple ping
                    if data.strip().lower() == "ping":
                        await websocket.send_text("pong")
                
            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                try:
                    await websocket.send_json({
                        "type": "HEARTBEAT",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                except:
                    break
                    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] Error for {user_id}: {e}")
    finally:
        await ws_manager.disconnect(user_id)


@ws_router.get("/ws/stats")
async def get_websocket_stats():
    """Get current WebSocket connection statistics."""
    return ws_manager.get_connection_stats()


@ws_router.post("/ws/broadcast-test")
async def broadcast_test_message(
    message: str = "Test broadcast",
    event_type: str = "TEST"
):
    """
    Test endpoint to broadcast a message to all connected clients.
    For debugging only - should be restricted in production.
    """
    event = {
        "type": event_type,
        "data": {"message": message},
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority": "low"
    }
    
    count = await ws_manager.broadcast_global(event)
    return {"sent_to": count, "message": message}
