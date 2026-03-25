"""
LOTTOLAB - Prime Configuration Routes
====================================
Gestion des primes (multiplicateurs de gains) par compagnie.
Endpoints pour Company Admin pour configurer les primes.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel

from models import UserRole
from auth import decode_token
from utils import generate_id, get_current_timestamp

prime_config_router = APIRouter(prefix="/api/company", tags=["Prime Configuration"])
security = HTTPBearer()

db = None

def set_prime_config_db(database):
    global db
    db = database


# ============================================================================
# AUTH
# ============================================================================

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


def require_company_admin(user: dict) -> str:
    """Require Company Admin role and return company_id"""
    if user.get("role") not in [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    
    company_id = user.get("company_id")
    if not company_id and user.get("role") != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Aucune compagnie associée")
    
    return company_id


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class PrimeConfigUpdate(BaseModel):
    prime_borlette: Optional[str] = None      # "60|20|10"
    prime_loto3: Optional[str] = None         # "500"
    prime_loto4: Optional[str] = None         # "5000"
    prime_loto5: Optional[str] = None         # "50000"
    prime_mariage: Optional[str] = None       # "750"
    prime_mariage_gratuit: Optional[str] = None  # "750"
    prime_l401: Optional[str] = None
    prime_l402: Optional[str] = None
    prime_l403: Optional[str] = None
    prime_l501: Optional[str] = None
    prime_l502: Optional[str] = None
    prime_l503: Optional[str] = None


class PrimeConfigResponse(BaseModel):
    company_id: str
    prime_borlette: str = "60|20|10"
    prime_loto3: str = "500"
    prime_loto4: str = "5000"
    prime_loto5: str = "50000"
    prime_mariage: str = "750"
    prime_mariage_gratuit: str = "750"
    prime_l401: str = "5000"
    prime_l402: str = "5000"
    prime_l403: str = "5000"
    prime_l501: str = "50000"
    prime_l502: str = "50000"
    prime_l503: str = "50000"
    updated_at: Optional[str] = None


# ============================================================================
# GET PRIME CONFIGURATION
# ============================================================================

@prime_config_router.get("/primes", response_model=PrimeConfigResponse)
async def get_prime_config(current_user: dict = Depends(get_current_user)):
    """
    Get prime configuration for the company.
    Returns current multipliers for all bet types.
    """
    company_id = require_company_admin(current_user)
    
    # Get or create config
    config = await db.company_configurations.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    # Default values
    defaults = {
        "company_id": company_id,
        "prime_borlette": "60|20|10",
        "prime_loto3": "500",
        "prime_loto4": "5000",
        "prime_loto5": "50000",
        "prime_mariage": "750",
        "prime_mariage_gratuit": "750",
        "prime_l401": "5000",
        "prime_l402": "5000",
        "prime_l403": "5000",
        "prime_l501": "50000",
        "prime_l502": "50000",
        "prime_l503": "50000",
        "updated_at": None
    }
    
    if config:
        for key in defaults:
            if key in config and config[key] is not None:
                defaults[key] = config[key]
    
    return PrimeConfigResponse(**defaults)


@prime_config_router.put("/primes", response_model=PrimeConfigResponse)
async def update_prime_config(
    data: PrimeConfigUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Update prime configuration for the company.
    Only provided fields will be updated.
    """
    company_id = require_company_admin(current_user)
    
    # Build update data
    update_data = {"updated_at": get_current_timestamp()}
    
    for field, value in data.model_dump().items():
        if value is not None:
            update_data[field] = value
    
    # Validate prime formats
    for key, value in update_data.items():
        if key.startswith("prime_") and value:
            # Validate format (numbers separated by |)
            parts = str(value).split("|")
            for part in parts:
                try:
                    float(part.strip())
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Format invalide pour {key}. Utilisez des nombres séparés par |. Ex: 60|20|10"
                    )
    
    # Upsert configuration
    await db.company_configurations.update_one(
        {"company_id": company_id},
        {"$set": update_data},
        upsert=True
    )
    
    # Increment config version for real-time sync
    await db.company_config_versions.update_one(
        {"company_id": company_id},
        {
            "$inc": {"version": 1},
            "$set": {
                "last_updated_at": get_current_timestamp(),
                "last_updated_by": current_user.get("user_id"),
                "change_type": "PRIME_CONFIG"
            }
        },
        upsert=True
    )
    
    # Log activity
    await db.activity_logs.insert_one({
        "log_id": generate_id("log_"),
        "action_type": "PRIME_CONFIG_UPDATED",
        "entity_type": "prime_config",
        "entity_id": company_id,
        "performed_by": current_user.get("user_id"),
        "company_id": company_id,
        "metadata": {"updated_fields": list(update_data.keys())},
        "ip_address": request.client.host if request.client else None,
        "created_at": get_current_timestamp()
    })
    
    # Return updated config
    return await get_prime_config(current_user)


# ============================================================================
# GET PRIMES FOR VENDEUR (Display only)
# ============================================================================

@prime_config_router.get("/primes/display")
async def get_primes_for_display(
    current_user: dict = Depends(get_current_user),
    company_id: Optional[str] = None
):
    """
    Get primes for display on vendeur sale page.
    Read-only, formatted for UI display.
    Super Admin can pass company_id as query param.
    """
    # Super Admin can specify company_id
    if current_user.get("role") == UserRole.SUPER_ADMIN and company_id:
        target_company_id = company_id
    else:
        target_company_id = current_user.get("company_id")
    
    if not target_company_id:
        raise HTTPException(status_code=403, detail="Compagnie non trouvée")
    
    config = await db.company_configurations.find_one(
        {"company_id": target_company_id},
        {"_id": 0}
    )
    
    # Format for display
    primes = [
        {
            "bet_type": "BORLETTE",
            "bet_code": "20",
            "name": "Borlette",
            "formula": config.get("prime_borlette", "60|20|10") if config else "60|20|10",
            "description": "1er rang x60, 2ème x20, 3ème x10"
        },
        {
            "bet_type": "LOTO3",
            "bet_code": "30",
            "name": "Loto 3",
            "formula": config.get("prime_loto3", "500") if config else "500",
            "description": "3 chiffres exacts"
        },
        {
            "bet_type": "LOTO4",
            "bet_code": "40",
            "name": "Loto 4",
            "formula": config.get("prime_loto4", "5000") if config else "5000",
            "description": "4 chiffres exacts"
        },
        {
            "bet_type": "LOTO5",
            "bet_code": "50",
            "name": "Loto 5",
            "formula": config.get("prime_loto5", "50000") if config else "50000",
            "description": "5 chiffres exacts"
        },
        {
            "bet_type": "MARIAGE",
            "bet_code": "MR",
            "name": "Mariage",
            "formula": config.get("prime_mariage", "750") if config else "750",
            "description": "2 numéros combinés"
        },
        {
            "bet_type": "MARIAGE_GRATUIT",
            "bet_code": "MG",
            "name": "Mariage Gratuit",
            "formula": config.get("prime_mariage_gratuit", "750") if config else "750",
            "description": "Mariage offert"
        }
    ]
    
    return {"primes": primes, "company_id": target_company_id}
