from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone

from models import *
from auth import decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

company_router = APIRouter(prefix="/api/company")
security = HTTPBearer()

db = None

def set_company_db(database):
    global db
    db = database

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

# ============ POS DEVICES ============
@company_router.get("/pos-devices", response_model=List[POSDevice])
async def get_pos_devices(current_user: dict = Depends(get_current_user)):
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    devices = await db.pos_devices.find({"company_id": company_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [POSDevice(**d) for d in devices]

@company_router.post("/pos-devices", response_model=POSDevice)
async def create_pos_device(
    device_data: POSDeviceCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = current_user.get("company_id")
    if not company_id or current_user["role"] not in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check IMEI unique
    existing = await db.pos_devices.find_one({"imei": device_data.imei})
    if existing:
        raise HTTPException(status_code=400, detail="IMEI already exists")
    
    device_id = generate_id("dev_")
    now = get_current_timestamp()
    
    device = POSDevice(
        device_id=device_id,
        company_id=company_id,
        imei=device_data.imei,
        device_name=device_data.device_name,
        branch=device_data.branch,
        location=device_data.location,
        assigned_agent_id=device_data.assigned_agent_id,
        status="ACTIVE",
        notes=device_data.notes,
        created_at=now,
        updated_at=now
    )
    
    await db.pos_devices.insert_one(device.model_dump())
    
    await log_activity(
        db=db,
        action_type="POS_DEVICE_CREATED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"imei": device_data.imei, "device_name": device_data.device_name},
        ip_address=request.client.host if request.client else None
    )
    
    return device

@company_router.put("/pos-devices/{device_id}", response_model=POSDevice)
async def update_pos_device(
    device_id: str,
    updates: POSDeviceUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = get_current_timestamp()
    
    await db.pos_devices.update_one(
        {"device_id": device_id, "company_id": company_id},
        {"$set": update_data}
    )
    
    device = await db.pos_devices.find_one({"device_id": device_id}, {"_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    await log_activity(
        db=db,
        action_type="POS_DEVICE_UPDATED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    return POSDevice(**device)

@company_router.delete("/pos-devices/{device_id}")
async def delete_pos_device(
    device_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.pos_devices.delete_one({"device_id": device_id, "company_id": company_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    
    await log_activity(
        db=db,
        action_type="POS_DEVICE_DELETED",
        entity_type="pos_device",
        entity_id=device_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Device deleted successfully"}
