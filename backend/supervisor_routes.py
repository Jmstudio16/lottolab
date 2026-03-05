"""
Supervisor Routes - Manages supervisor access to their agents
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from models import UserRole
from utils import get_current_timestamp
from auth import decode_token
import os

# Database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'lottolab')]

supervisor_router = APIRouter(prefix="/api/supervisor", tags=["Supervisor"])
security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current user from JWT token"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"user_id": payload.get("user_id")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


def require_supervisor(current_user: dict):
    """Verify user is a supervisor"""
    if current_user.get("role") not in [UserRole.BRANCH_SUPERVISOR, "BRANCH_SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Access denied - Supervisor only")
    return current_user


@supervisor_router.get("/agents")
async def get_supervisor_agents(current_user: dict = Depends(get_current_user)):
    """Get agents managed by this supervisor"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    # Get agents in the same succursale or created by this supervisor
    query = {
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "status": {"$ne": "DELETED"},
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    }
    
    agents = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(100)
    
    # Get sales for today
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for agent in agents:
        tickets_today = await db.tickets.count_documents({
            "agent_id": agent.get("user_id"),
            "created_at": {"$regex": f"^{today}"}
        })
        agent["tickets_today"] = tickets_today
        agent["sales_today"] = 0
    
    return agents


@supervisor_router.get("/dashboard-stats")
async def get_supervisor_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard stats for supervisor"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    # Count agents
    query = {
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "status": {"$ne": "DELETED"},
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    }
    
    total_agents = await db.users.count_documents(query)
    active_agents = await db.users.count_documents({**query, "status": "ACTIVE"})
    
    # Today's tickets
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tickets_today = await db.tickets.count_documents({
        "company_id": company_id,
        "succursale_id": succursale_id,
        "created_at": {"$regex": f"^{today}"}
    })
    
    return {
        "total_agents": total_agents,
        "active_agents": active_agents,
        "suspended_agents": total_agents - active_agents,
        "tickets_today": tickets_today
    }


@supervisor_router.put("/agents/{agent_id}/suspend")
async def supervisor_suspend_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Suspend an agent"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    agent = await db.users.find_one({
        "user_id": agent_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    })
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé ou non autorisé")
    
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": {"status": "SUSPENDED", "updated_at": get_current_timestamp()}}
    )
    
    return {"message": "Agent suspendu avec succès"}


@supervisor_router.put("/agents/{agent_id}/activate")
async def supervisor_activate_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Activate an agent"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    agent = await db.users.find_one({
        "user_id": agent_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    })
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé ou non autorisé")
    
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": {"status": "ACTIVE", "updated_at": get_current_timestamp()}}
    )
    
    return {"message": "Agent réactivé avec succès"}


@supervisor_router.delete("/agents/{agent_id}")
async def supervisor_delete_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an agent (soft delete)"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    agent = await db.users.find_one({
        "user_id": agent_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    })
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé ou non autorisé")
    
    # Check if agent has active tickets
    active_tickets = await db.tickets.count_documents({
        "agent_id": agent_id,
        "status": {"$in": ["PENDING", "ACTIVE"]}
    })
    
    if active_tickets > 0:
        raise HTTPException(status_code=400, detail=f"Impossible: {active_tickets} tickets actifs")
    
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": {"status": "DELETED", "deleted_at": get_current_timestamp()}}
    )
    
    return {"message": "Agent supprimé avec succès"}


@supervisor_router.put("/agents/{agent_id}")
async def supervisor_update_agent(agent_id: str, update_data: dict, current_user: dict = Depends(get_current_user)):
    """Update agent info"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    succursale_id = current_user.get("succursale_id")
    
    agent = await db.users.find_one({
        "user_id": agent_id,
        "company_id": company_id,
        "role": UserRole.AGENT_POS,
        "$or": [
            {"succursale_id": succursale_id},
            {"created_by": current_user.get("user_id")}
        ]
    })
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent non trouvé ou non autorisé")
    
    allowed_fields = {"name", "telephone", "commission_percent"}
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    update_fields["updated_at"] = get_current_timestamp()
    
    await db.users.update_one(
        {"user_id": agent_id},
        {"$set": update_fields}
    )
    
    return {"message": "Agent mis à jour avec succès"}


@supervisor_router.get("/agents/{agent_id}/tickets")
async def supervisor_get_agent_tickets(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Get tickets for a specific agent"""
    current_user = require_supervisor(current_user)
    
    company_id = current_user.get("company_id")
    
    tickets = await db.tickets.find(
        {"agent_id": agent_id, "company_id": company_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return tickets
