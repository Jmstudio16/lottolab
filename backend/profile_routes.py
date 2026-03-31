"""
LOTTOLAB - Profile Photo Upload Routes
Allows all users to upload their profile photo.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
import os
import uuid
import shutil
from pathlib import Path
from datetime import datetime, timezone
import logging

from auth import decode_token

logger = logging.getLogger(__name__)

profile_router = APIRouter(prefix="/api/user", tags=["Profile"])
security = HTTPBearer()

# Configuration
UPLOAD_DIR = Path("/app/backend/uploads/profile-photos")
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB

# Ensure upload directory exists
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

db = None

def set_profile_db(database):
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


@profile_router.post("/upload-profile-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a profile photo for the current user.
    - Accepts: jpg, jpeg, png, webp
    - Max size: 2MB
    - Automatically replaces old photo
    """
    user_id = current_user.get("user_id")
    
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Type de fichier non autorisé. Utilisez: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Read file and check size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"Fichier trop volumineux. Maximum: {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Generate unique filename
    unique_name = f"{user_id}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = UPLOAD_DIR / unique_name
    
    # Delete old profile photo if exists
    old_photo = current_user.get("profile_image_url")
    if old_photo:
        old_filename = old_photo.split("/")[-1]
        old_path = UPLOAD_DIR / old_filename
        if old_path.exists():
            try:
                old_path.unlink()
                logger.info(f"[PROFILE] Deleted old photo: {old_filename}")
            except Exception as e:
                logger.warning(f"[PROFILE] Could not delete old photo: {e}")
    
    # Save new file
    try:
        with open(file_path, "wb") as f:
            f.write(contents)
        logger.info(f"[PROFILE] Saved new photo: {unique_name}")
    except Exception as e:
        logger.error(f"[PROFILE] Error saving file: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la sauvegarde du fichier")
    
    # Generate public URL
    public_url = f"/api/user/profile-image/{unique_name}"
    
    # Update user in database
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "profile_image_url": public_url,
                "profile_updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    logger.info(f"[PROFILE] Updated profile photo for user {user_id}")
    
    return {
        "message": "Photo de profil mise à jour avec succès",
        "profile_image_url": public_url,
        "filename": unique_name
    }


@profile_router.get("/profile-image/{filename}")
async def get_profile_image(filename: str):
    """Serve profile image file"""
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image non trouvée")
    
    # Determine content type
    ext = Path(filename).suffix.lower()
    content_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp"
    }
    content_type = content_types.get(ext, "application/octet-stream")
    
    return FileResponse(file_path, media_type=content_type)


@profile_router.delete("/profile-image")
async def delete_profile_image(
    current_user: dict = Depends(get_current_user)
):
    """Delete current user's profile photo"""
    user_id = current_user.get("user_id")
    
    old_photo = current_user.get("profile_image_url")
    if old_photo:
        old_filename = old_photo.split("/")[-1]
        old_path = UPLOAD_DIR / old_filename
        if old_path.exists():
            try:
                old_path.unlink()
                logger.info(f"[PROFILE] Deleted photo: {old_filename}")
            except Exception as e:
                logger.warning(f"[PROFILE] Could not delete photo: {e}")
    
    # Update user - remove photo URL
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "profile_image_url": None,
                "profile_updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Photo de profil supprimée"}


@profile_router.get("/profile")
async def get_user_profile(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's full profile"""
    return {
        "user_id": current_user.get("user_id"),
        "email": current_user.get("email"),
        "name": current_user.get("name"),
        "role": current_user.get("role"),
        "company_id": current_user.get("company_id"),
        "profile_image_url": current_user.get("profile_image_url"),
        "phone": current_user.get("phone"),
        "status": current_user.get("status"),
        "created_at": current_user.get("created_at"),
        "notification_settings": current_user.get("notification_settings", {
            "sound_enabled": True
        })
    }


@profile_router.put("/notification-settings")
async def update_notification_settings(
    settings: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update user notification settings (sound enabled, etc.)"""
    user_id = current_user.get("user_id")
    
    # Merge with existing settings
    current_settings = current_user.get("notification_settings", {})
    updated_settings = {**current_settings, **settings}
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"notification_settings": updated_settings}}
    )
    
    return {
        "message": "Paramètres mis à jour",
        "notification_settings": updated_settings
    }
