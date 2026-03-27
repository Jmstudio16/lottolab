"""
LOTTOLAB - Object Storage Routes for Company Logos and User Avatars
Uses Emergent Object Storage integration for secure file hosting
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from typing import Optional
import os
import uuid
import requests
import logging

from auth import decode_token
from utils import generate_id, get_current_timestamp
from models import UserRole

storage_router = APIRouter(prefix="/api", tags=["Storage"])
security = HTTPBearer()
logger = logging.getLogger(__name__)

db = None

def set_storage_db(database):
    global db
    db = database

# Object Storage Configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "lottolab"

# Module-level storage key (reused globally)
storage_key = None

def init_storage():
    """Initialize storage and return reusable storage_key"""
    global storage_key
    if storage_key:
        return storage_key
    
    if not EMERGENT_KEY:
        logger.warning("[STORAGE] EMERGENT_LLM_KEY not set - storage disabled")
        return None
    
    try:
        resp = requests.post(
            f"{STORAGE_URL}/init",
            json={"emergent_key": EMERGENT_KEY},
            timeout=30
        )
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logger.info("[STORAGE] Initialized successfully")
        return storage_key
    except Exception as e:
        logger.error(f"[STORAGE] Init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload file to storage. Returns {"path": "...", "size": N, "etag": "..."}"""
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not configured")
    
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    """Download file from storage. Returns (content_bytes, content_type)"""
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not configured")
    
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# Mime type mapping
MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "svg": "image/svg+xml"
}

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "svg"}
MAX_FILE_SIZE = 0  # No limit - accept any size for company logos (0 = unlimited)

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


# ============================================================================
# COMPANY LOGO UPLOAD
# ============================================================================

@storage_router.post("/company/logo/upload")
async def upload_company_logo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload company logo - Company Admin only - NO SIZE LIMIT"""
    if current_user.get("role") not in [UserRole.COMPANY_ADMIN, "COMPANY_ADMIN", UserRole.SUPER_ADMIN, "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID requis")
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="Fichier requis")
    
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Format non supporté. Utilisez: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Read file content - NO SIZE LIMIT
    content = await file.read()
    
    # Generate storage path
    file_id = str(uuid.uuid4())
    storage_path = f"{APP_NAME}/company-logos/{company_id}/{file_id}.{ext}"
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    
    try:
        result = put_object(storage_path, content, content_type)
        stored_path = result.get("path", storage_path)
        
        # Store in database
        now = get_current_timestamp()
        file_record = {
            "file_id": file_id,
            "storage_path": stored_path,
            "original_filename": file.filename,
            "content_type": content_type,
            "size": result.get("size", len(content)),
            "company_id": company_id,
            "file_type": "company_logo",
            "uploaded_by": current_user.get("user_id"),
            "is_deleted": False,
            "created_at": now
        }
        await db.files.insert_one(file_record)
        
        # Update company with new logo URL
        logo_url = f"/api/files/{stored_path}"
        await db.companies.update_one(
            {"company_id": company_id},
            {"$set": {
                "logo_url": logo_url,
                "company_logo_url": logo_url,
                "logo_storage_path": stored_path,
                "updated_at": now
            }}
        )
        
        logger.info(f"[STORAGE] Company logo uploaded: {company_id} -> {stored_path}")
        
        return {
            "message": "Logo téléchargé avec succès",
            "logo_url": logo_url,
            "file_id": file_id
        }
        
    except requests.exceptions.RequestException as e:
        logger.error(f"[STORAGE] Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du téléchargement")


@storage_router.delete("/company/logo")
async def delete_company_logo(current_user: dict = Depends(get_current_user)):
    """Delete company logo - Company Admin only"""
    if current_user.get("role") not in [UserRole.COMPANY_ADMIN, "COMPANY_ADMIN"]:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID requis")
    
    # Soft delete the file
    await db.files.update_many(
        {"company_id": company_id, "file_type": "company_logo"},
        {"$set": {"is_deleted": True, "deleted_at": get_current_timestamp()}}
    )
    
    # Remove logo from company
    await db.companies.update_one(
        {"company_id": company_id},
        {"$set": {
            "logo_url": None,
            "company_logo_url": None,
            "logo_storage_path": None,
            "updated_at": get_current_timestamp()
        }}
    )
    
    return {"message": "Logo supprimé avec succès"}


# ============================================================================
# USER PROFILE PHOTO UPLOAD (Vendeur / Supervisor)
# ============================================================================

@storage_router.post("/vendeur/profile/photo")
async def upload_vendeur_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload vendeur/supervisor profile photo - NO SIZE LIMIT"""
    user_id = current_user.get("user_id")
    company_id = current_user.get("company_id")
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="Fichier requis")
    
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Format non supporté. Utilisez: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Read file content - NO SIZE LIMIT
    content = await file.read()
    
    # Generate storage path
    file_id = str(uuid.uuid4())
    storage_path = f"{APP_NAME}/user-photos/{company_id}/{user_id}/{file_id}.{ext}"
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    
    try:
        result = put_object(storage_path, content, content_type)
        stored_path = result.get("path", storage_path)
        
        # Store in database
        now = get_current_timestamp()
        file_record = {
            "file_id": file_id,
            "storage_path": stored_path,
            "original_filename": file.filename,
            "content_type": content_type,
            "size": result.get("size", len(content)),
            "company_id": company_id,
            "user_id": user_id,
            "file_type": "user_photo",
            "uploaded_by": user_id,
            "is_deleted": False,
            "created_at": now
        }
        await db.files.insert_one(file_record)
        
        # Update user with new photo URL
        photo_url = f"/api/files/{stored_path}"
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "photo_url": photo_url,
                "profile_image_url": photo_url,
                "photo_storage_path": stored_path,
                "updated_at": now
            }}
        )
        
        logger.info(f"[STORAGE] User photo uploaded: {user_id} -> {stored_path}")
        
        return {
            "message": "Photo mise à jour avec succès",
            "photo_url": photo_url,
            "file_id": file_id
        }
        
    except requests.exceptions.RequestException as e:
        logger.error(f"[STORAGE] Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du téléchargement")


@storage_router.delete("/vendeur/profile/photo")
async def delete_vendeur_photo(current_user: dict = Depends(get_current_user)):
    """Delete vendeur/supervisor profile photo"""
    user_id = current_user.get("user_id")
    
    # Soft delete the file
    await db.files.update_many(
        {"user_id": user_id, "file_type": "user_photo"},
        {"$set": {"is_deleted": True, "deleted_at": get_current_timestamp()}}
    )
    
    # Remove photo from user
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "photo_url": None,
            "profile_image_url": None,
            "photo_storage_path": None,
            "updated_at": get_current_timestamp()
        }}
    )
    
    return {"message": "Photo supprimée avec succès"}


# ============================================================================
# FILE SERVING ENDPOINT
# ============================================================================

@storage_router.get("/files/{path:path}")
async def serve_file(
    path: str,
    request: Request
):
    """
    Serve files from Object Storage.
    Supports both authenticated and public access for company logos.
    Works with files stored via any upload route.
    """
    # First check if file exists in DB
    file_record = await db.files.find_one(
        {"storage_path": path, "is_deleted": False},
        {"_id": 0}
    )
    
    if not file_record:
        # Try to find by partial path match
        file_record = await db.files.find_one(
            {"storage_path": {"$regex": path}, "is_deleted": False},
            {"_id": 0}
        )
    
    # Try to serve directly from Object Storage even without DB record
    # This handles files uploaded through settings_routes.py
    try:
        storage_path = file_record["storage_path"] if file_record else path
        content, content_type = get_object(storage_path)
        
        # Use stored content type if available
        final_content_type = file_record.get("content_type", content_type) if file_record else content_type
        
        # Guess content type from extension if not set
        if not final_content_type or final_content_type == "application/octet-stream":
            ext = path.split(".")[-1].lower() if "." in path else ""
            ext_types = {
                "png": "image/png",
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "gif": "image/gif",
                "webp": "image/webp",
                "svg": "image/svg+xml"
            }
            final_content_type = ext_types.get(ext, "application/octet-stream")
        
        original_filename = file_record.get("original_filename", path.split("/")[-1]) if file_record else path.split("/")[-1]
        
        return Response(
            content=content,
            media_type=final_content_type,
            headers={
                "Cache-Control": "public, max-age=86400",  # Cache for 1 day
                "Content-Disposition": f"inline; filename=\"{original_filename}\""
            }
        )
        
    except requests.exceptions.RequestException as e:
        logger.error(f"[STORAGE] Serve failed for {path}: {e}")
        raise HTTPException(status_code=404, detail="Fichier non trouvé")


# ============================================================================
# STORAGE HEALTH CHECK
# ============================================================================

@storage_router.get("/storage/health")
async def storage_health():
    """Check if object storage is configured and working"""
    key = init_storage()
    return {
        "storage_configured": key is not None,
        "emergent_key_set": bool(EMERGENT_KEY),
        "storage_url": STORAGE_URL,
        "app_name": APP_NAME
    }
