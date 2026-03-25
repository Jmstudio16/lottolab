"""
System Settings and Logo Management Routes
- Global system settings (Super Admin)
- Company settings with logo upload (Company Admin)
"""

from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr
import os
import shutil
import uuid

from models import UserRole
from auth import decode_token
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

settings_router = APIRouter(prefix="/api", tags=["Settings"])
security = HTTPBearer()

db = None
UPLOAD_DIR = "/app/backend/uploads/company-logos"

def set_settings_db(database):
    global db
    db = database


# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class SystemSettingsUpdate(BaseModel):
    system_name: Optional[str] = None
    system_logo_url: Optional[str] = None


class CompanySettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[EmailStr] = None
    company_address: Optional[str] = None


# ============================================================================
# AUTH HELPERS
# ============================================================================

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


async def require_super_admin(user: dict):
    if user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Accès réservé aux Super Admins")
    return user


async def require_company_admin(user: dict):
    allowed_roles = [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MANAGER]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs d'entreprise")
    if not user.get("company_id"):
        raise HTTPException(status_code=403, detail="Aucune entreprise associée")
    return user


# ============================================================================
# SYSTEM SETTINGS (SUPER ADMIN ONLY)
# ============================================================================

@settings_router.get("/system/settings")
async def get_system_settings():
    """Get global system settings - public endpoint for logo display"""
    settings = await db.system_settings.find_one({}, {"_id": 0})
    
    if not settings:
        # Create default settings
        settings = {
            "id": "system_settings",
            "system_name": "LOTTOLAB",
            "system_logo_url": "/assets/logos/lottolab-logo.png",
            "created_at": get_current_timestamp(),
            "updated_at": get_current_timestamp()
        }
        await db.system_settings.insert_one(settings)
    else:
        # Ensure system_logo_url exists (migration from old field name)
        if not settings.get("system_logo_url"):
            settings["system_logo_url"] = settings.get("platform_logo", "/assets/logos/lottolab-logo.png")
        if not settings.get("system_name"):
            settings["system_name"] = settings.get("platform_name", "LOTTOLAB")
    
    return settings


@settings_router.put("/system/settings")
async def update_system_settings(
    updates: SystemSettingsUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Update system settings - Super Admin only"""
    await require_super_admin(current_user)
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
    
    update_data["updated_at"] = get_current_timestamp()
    
    await db.system_settings.update_one(
        {},
        {"$set": update_data},
        upsert=True
    )
    
    await log_activity(
        db=db,
        action_type="SYSTEM_SETTINGS_UPDATED",
        entity_type="system_settings",
        entity_id="system_settings",
        performed_by=current_user["user_id"],
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    settings = await db.system_settings.find_one({}, {"_id": 0})
    return settings


@settings_router.post("/system/logo/upload")
async def upload_system_logo(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload system logo - Super Admin only"""
    await require_super_admin(current_user)
    
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Type de fichier non supporté. Utilisez PNG, JPG, WEBP ou SVG")
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"system-logo.{ext}"
    filepath = f"/app/frontend/public/assets/logos/{filename}"
    
    # Save file
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update system settings
    logo_url = f"/assets/logos/{filename}"
    await db.system_settings.update_one(
        {},
        {"$set": {"system_logo_url": logo_url, "updated_at": get_current_timestamp()}},
        upsert=True
    )
    
    await log_activity(
        db=db,
        action_type="SYSTEM_LOGO_UPLOADED",
        entity_type="system_settings",
        entity_id="system_settings",
        performed_by=current_user["user_id"],
        metadata={"filename": filename},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Logo système téléchargé", "logo_url": logo_url}


# ============================================================================
# COMPANY SETTINGS (COMPANY ADMIN)
# ============================================================================

@settings_router.get("/company/profile")
async def get_company_settings(current_user: dict = Depends(get_current_user)):
    """Get company settings"""
    await require_company_admin(current_user)
    company_id = current_user["company_id"]
    
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    # Get system settings for fallback logo
    system_settings = await db.system_settings.find_one({}, {"_id": 0})
    system_logo = system_settings.get("system_logo_url", "/assets/logos/lottolab-logo.png") if system_settings else "/assets/logos/lottolab-logo.png"
    
    return {
        "company_id": company_id,
        "company_name": company.get("name", ""),
        "company_logo_url": company.get("company_logo_url"),
        "company_phone": company.get("phone"),
        "company_email": company.get("email"),
        "company_address": company.get("address"),
        "display_logo_url": company.get("company_logo_url") or system_logo,
        "system_logo_url": system_logo,
        "currency": company.get("currency", "HTG"),
        "timezone": company.get("timezone", "America/Port-au-Prince"),
        "status": company.get("status", "ACTIVE")
    }


@settings_router.put("/company/profile")
async def update_company_settings(
    updates: CompanySettingsUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Update company settings"""
    await require_company_admin(current_user)
    
    if current_user.get("role") != UserRole.COMPANY_ADMIN:
        raise HTTPException(status_code=403, detail="Seuls les administrateurs peuvent modifier les paramètres")
    
    company_id = current_user["company_id"]
    
    update_data = {}
    if updates.company_name:
        update_data["name"] = updates.company_name
    if updates.company_phone:
        update_data["phone"] = updates.company_phone
    if updates.company_email:
        update_data["email"] = updates.company_email
    if updates.company_address:
        update_data["address"] = updates.company_address
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
    
    update_data["updated_at"] = get_current_timestamp()
    
    result = await db.companies.update_one(
        {"company_id": company_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    await log_activity(
        db=db,
        action_type="COMPANY_SETTINGS_UPDATED",
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"updates": update_data},
        ip_address=request.client.host if request.client else None
    )
    
    # Get updated company
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    
    return {
        "message": "Paramètres mis à jour",
        "company_name": company.get("name"),
        "company_phone": company.get("phone"),
        "company_email": company.get("email"),
        "company_address": company.get("address")
    }


@settings_router.post("/company/logo/upload")
async def upload_company_logo(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload company logo"""
    await require_company_admin(current_user)
    
    if current_user.get("role") != UserRole.COMPANY_ADMIN:
        raise HTTPException(status_code=403, detail="Seuls les administrateurs peuvent modifier le logo")
    
    company_id = current_user["company_id"]
    
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Type de fichier non supporté. Utilisez PNG, JPG, WEBP, GIF ou SVG")
    
    # Validate file size (max 10MB for high resolution logos)
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 10MB)")
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{company_id}-logo-{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update company
    logo_url = f"/api/uploads/company-logos/{filename}"
    await db.companies.update_one(
        {"company_id": company_id},
        {"$set": {"company_logo_url": logo_url, "updated_at": get_current_timestamp()}}
    )
    
    # Increment config version for real-time sync
    await db.company_config_versions.update_one(
        {"company_id": company_id},
        {
            "$inc": {"version": 1},
            "$set": {
                "last_updated_at": get_current_timestamp(),
                "last_updated_by": current_user["user_id"],
                "change_type": "COMPANY_LOGO_UPDATED"
            }
        },
        upsert=True
    )
    
    await log_activity(
        db=db,
        action_type="COMPANY_LOGO_UPLOADED",
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={"filename": filename},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Logo téléchargé", "logo_url": logo_url}


@settings_router.delete("/company/logo")
async def delete_company_logo(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Delete company logo (revert to system logo)"""
    await require_company_admin(current_user)
    
    if current_user.get("role") != UserRole.COMPANY_ADMIN:
        raise HTTPException(status_code=403, detail="Seuls les administrateurs peuvent supprimer le logo")
    
    company_id = current_user["company_id"]
    
    # Get current logo
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if company and company.get("company_logo_url"):
        # Try to delete file
        filename = company["company_logo_url"].split("/")[-1]
        filepath = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
    
    # Remove logo from company
    await db.companies.update_one(
        {"company_id": company_id},
        {"$unset": {"company_logo_url": ""}, "$set": {"updated_at": get_current_timestamp()}}
    )
    
    # Increment config version
    await db.company_config_versions.update_one(
        {"company_id": company_id},
        {
            "$inc": {"version": 1},
            "$set": {
                "last_updated_at": get_current_timestamp(),
                "change_type": "COMPANY_LOGO_DELETED"
            }
        },
        upsert=True
    )
    
    await log_activity(
        db=db,
        action_type="COMPANY_LOGO_DELETED",
        entity_type="company",
        entity_id=company_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Logo supprimé, logo système utilisé par défaut"}


# ============================================================================
# SERVE UPLOADED FILES
# ============================================================================

@settings_router.get("/uploads/company-logos/{filename}")
async def serve_company_logo(filename: str):
    """Serve uploaded company logo files"""
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Logo non trouvé")
    
    return FileResponse(filepath)


# ============================================================================
# LOGO HELPER ENDPOINT (FOR FRONTEND)
# ============================================================================

@settings_router.get("/logo/display")
async def get_display_logo(current_user: dict = Depends(get_current_user)):
    """Get the correct logo to display based on user's company"""
    
    # Get system logo
    system_settings = await db.system_settings.find_one({}, {"_id": 0})
    system_logo = system_settings.get("system_logo_url", "/assets/logos/lottolab-logo.png") if system_settings else "/assets/logos/lottolab-logo.png"
    system_name = system_settings.get("system_name", "LOTTOLAB") if system_settings else "LOTTOLAB"
    
    company_id = current_user.get("company_id")
    company_logo = None
    company_name = None
    
    if company_id:
        company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
        if company:
            company_logo = company.get("company_logo_url")
            company_name = company.get("name")
    
    # Priority: company logo > system logo
    display_logo = company_logo if company_logo else system_logo
    display_name = company_name if company_name else system_name
    
    return {
        "display_logo_url": display_logo,
        "display_name": display_name,
        "system_logo_url": system_logo,
        "system_name": system_name,
        "company_logo_url": company_logo,
        "company_name": company_name,
        "has_company_logo": company_logo is not None
    }
