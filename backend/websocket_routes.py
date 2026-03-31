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

JWT_SECRET = os.getenv("JWT_SECRET_KEY", os.getenv("JWT_SECRET", "lottolab-secure-production-key-jm-studio-2026-change-in-production"))
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
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )
                
                try:
                    message = json.loads(data)
                    msg_type = message.get("type", "")
                    
                    if msg_type == "PING":
                        await websocket.send_json({
                            "type": "PONG",
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                    elif msg_type == "AUTH":
                        # Re-auth (optional, already authenticated via token)
                        await websocket.send_json({
                            "type": "AUTH_OK",
                            "user_id": user_id,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                    
                except json.JSONDecodeError:
                    if data.strip().lower() == "ping":
                        await websocket.send_text("pong")
                
            except asyncio.TimeoutError:
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


@ws_router.websocket("/ws/notifications")
async def notifications_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    Dedicated WebSocket endpoint for notifications.
    Same as /ws but with explicit notification focus.
    """
    # Reuse main endpoint logic
    await websocket_endpoint(websocket, token)


@ws_router.get("/ws/stats")
async def get_websocket_stats():
    """Get current WebSocket connection statistics."""
    return ws_manager.get_connection_stats()


@ws_router.post("/ws/broadcast-test")
async def broadcast_test_message(
    message: str = "Test broadcast",
    event_type: str = "TEST"
):
    """Test endpoint to broadcast a message."""
    event = {
        "type": event_type,
        "data": {"message": message},
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority": "low"
    }
    
    count = await ws_manager.broadcast_global(event)
    return {"sent_to": count, "message": message}
