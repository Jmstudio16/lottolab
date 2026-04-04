"""
LOTTOLAB - Bet Type Limits Management
=====================================
Comprehensive betting limits per game type for Company Admins.
Controls: Min bet, Max bet, Max per number, and Enable/Disable per game type.

Game Types Supported:
- BORLETTE
- LOTO3
- MARIAGE  
- L4O1 (Loto 4 Option 1)
- L4O2 (Loto 4 Option 2)
- L4O3 (Loto 4 Option 3)
- L5O1 (Loto 5 Extra 1)
- L5O2 (Loto 5 Extra 2)
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict
from pydantic import BaseModel, Field
from datetime import datetime, timezone

from models import UserRole
from auth import decode_token
from utils import generate_id, get_current_timestamp

bet_type_limits_router = APIRouter(prefix="/api/company", tags=["Bet Type Limits"])
security = HTTPBearer()

db = None

def set_bet_type_limits_db(database):
    global db
    db = database


# ============================================================================
# DEFAULT LIMITS
# ============================================================================

DEFAULT_LIMITS = {
    "BORLETTE": {
        "min_bet": 1,
        "max_bet": 1000,
        "max_per_number": 10000,
        "enabled": True
    },
    "LOTO3": {
        "min_bet": 1,
        "max_bet": 1000,
        "max_per_number": 6000,
        "enabled": True
    },
    "MARIAGE": {
        "min_bet": 1,
        "max_bet": 1000,
        "max_per_number": 4000,
        "enabled": True
    },
    "L4O1": {
        "min_bet": 1,
        "max_bet": 1000,
        "max_per_number": 1000,
        "enabled": True
    },
    "L4O2": {
        "min_bet": 1,
        "max_bet": 1000,
        "max_per_number": 1000,
        "enabled": True
    },
    "L4O3": {
        "min_bet": 1,
        "max_bet": 1000,
        "max_per_number": 1000,
        "enabled": True
    },
    "L5O1": {
        "min_bet": 1,
        "max_bet": 1000,
        "max_per_number": 1000,
        "enabled": True
    },
    "L5O2": {
        "min_bet": 1,
        "max_bet": 1000,
        "max_per_number": 1000,
        "enabled": True
    }
}

# Mapping frontend bet types to our keys
BET_TYPE_MAPPING = {
    "BORLETTE": "BORLETTE",
    "LOTO3": "LOTO3",
    "MARIAGE": "MARIAGE",
    "LOTO4_OPT1": "L4O1",
    "LOTO4_OPT2": "L4O2",
    "LOTO4_OPT3": "L4O3",
    "LOTO5_EXTRA1": "L5O1",
    "LOTO5_EXTRA2": "L5O2",
    "L4O1": "L4O1",
    "L4O2": "L4O2",
    "L4O3": "L4O3",
    "L5O1": "L5O1",
    "L5O2": "L5O2",
    # Handle legacy formats
    "MARIAGE_GRATIS": "MARIAGE"  # Same limits apply
}


# ============================================================================
# MODELS
# ============================================================================

class BetTypeLimitConfig(BaseModel):
    """Configuration for a single bet type"""
    game_type: str
    min_bet: float = Field(ge=0)
    max_bet: float = Field(ge=0)
    max_per_number: float = Field(ge=0)
    enabled: bool = True


class BetTypeLimitsUpdate(BaseModel):
    """Update all bet type limits"""
    limits: Dict[str, Dict]  # {game_type: {min_bet, max_bet, max_per_number, enabled}}


# ============================================================================
# AUTHENTICATION
# ============================================================================

async def get_company_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get authenticated Company Admin"""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    # Only Company Admin can modify limits
    allowed_roles = [UserRole.COMPANY_ADMIN, "COMPANY_ADMIN"]
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Accès Company Admin requis")
    
    if not user.get("company_id"):
        raise HTTPException(status_code=403, detail="Pas de compagnie associée")
    
    return user


async def get_company_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get any authenticated company user (for read access)"""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return user


# ============================================================================
# ENDPOINTS
# ============================================================================

@bet_type_limits_router.get("/bet-type-limits")
async def get_bet_type_limits(current_user: dict = Depends(get_company_user)):
    """
    Get all bet type limits for the company.
    Returns default limits if none configured.
    """
    company_id = current_user.get("company_id")
    
    if not company_id:
        # For vendors, get limits from their company
        raise HTTPException(status_code=400, detail="Company ID requis")
    
    # Get existing limits from DB
    limits_doc = await db.bet_type_limits.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    # Merge with defaults
    result_limits = {}
    for game_type, defaults in DEFAULT_LIMITS.items():
        if limits_doc and game_type in limits_doc.get("limits", {}):
            result_limits[game_type] = limits_doc["limits"][game_type]
        else:
            result_limits[game_type] = defaults.copy()
    
    return {
        "company_id": company_id,
        "limits": result_limits,
        "updated_at": limits_doc.get("updated_at") if limits_doc else None
    }


@bet_type_limits_router.put("/bet-type-limits")
async def update_bet_type_limits(
    data: BetTypeLimitsUpdate,
    current_user: dict = Depends(get_company_admin)
):
    """
    Update bet type limits for the company.
    Only Company Admin can update.
    """
    company_id = current_user.get("company_id")
    now = get_current_timestamp()
    
    # Validate limits
    validated_limits = {}
    for game_type, limit_config in data.limits.items():
        # Normalize game type
        normalized_type = BET_TYPE_MAPPING.get(game_type, game_type)
        
        if normalized_type not in DEFAULT_LIMITS:
            continue  # Skip unknown types
        
        min_bet = float(limit_config.get("min_bet", 0) or limit_config.get("min_amount", 0))
        max_bet = float(limit_config.get("max_bet", 0) or limit_config.get("max_amount", 0))
        max_per_number = float(limit_config.get("max_per_number", 0))
        enabled = limit_config.get("enabled", True)
        
        # Validation
        if min_bet < 0:
            raise HTTPException(status_code=400, detail=f"{game_type}: min_bet ne peut pas être négatif")
        if max_bet < min_bet:
            raise HTTPException(status_code=400, detail=f"{game_type}: max_bet doit être >= min_bet")
        
        validated_limits[normalized_type] = {
            "min_bet": min_bet,
            "max_bet": max_bet,
            "max_per_number": max_per_number if max_per_number > 0 else max_bet * 2,
            "enabled": enabled
        }
    
    # Update or create in DB
    await db.bet_type_limits.update_one(
        {"company_id": company_id},
        {
            "$set": {
                "company_id": company_id,
                "limits": validated_limits,
                "updated_at": now,
                "updated_by": current_user.get("user_id")
            }
        },
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Limites mises à jour avec succès",
        "limits": validated_limits
    }


# ============================================================================
# VALIDATION FUNCTION - Called by ticket creation
# ============================================================================

async def validate_bet_type_limits(
    company_id: str,
    plays: List[Dict]
) -> Dict:
    """
    Validate plays against company bet type limits.
    Called by the sell endpoint before creating ticket.
    
    Returns:
    {
        "allowed": bool,
        "errors": [{"play_index": 0, "error": "..."}],
        "disabled_types": ["LOTO3", ...]
    }
    """
    if not company_id:
        return {"allowed": True, "errors": [], "disabled_types": []}
    
    if db is None:
        return {"allowed": True, "errors": [], "disabled_types": []}
    
    # Get company limits
    limits_doc = await db.bet_type_limits.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    limits = limits_doc.get("limits", {}) if limits_doc else {}
    
    errors = []
    disabled_types = []
    
    for idx, play in enumerate(plays):
        bet_type = play.get("bet_type", "")
        amount = float(play.get("amount", 0))
        
        # Normalize bet type
        normalized_type = BET_TYPE_MAPPING.get(bet_type, bet_type)
        
        # Get limits for this type (use defaults if not configured)
        type_limits = limits.get(normalized_type, DEFAULT_LIMITS.get(normalized_type, {}))
        
        if not type_limits:
            continue  # Unknown type, let pass
        
        # Check if type is enabled
        if not type_limits.get("enabled", True):
            if normalized_type not in disabled_types:
                disabled_types.append(normalized_type)
            errors.append({
                "play_index": idx,
                "bet_type": bet_type,
                "error": f"Type de jeu '{bet_type}' désactivé par la compagnie"
            })
            continue
        
        # Check min bet
        min_bet = float(type_limits.get("min_bet", 0))
        if amount < min_bet:
            errors.append({
                "play_index": idx,
                "bet_type": bet_type,
                "amount": amount,
                "min_bet": min_bet,
                "error": f"Mise minimum pour {bet_type}: {min_bet:.0f} HTG (vous avez mis {amount:.0f} HTG)"
            })
        
        # Check max bet
        max_bet = float(type_limits.get("max_bet", 999999))
        if amount > max_bet:
            errors.append({
                "play_index": idx,
                "bet_type": bet_type,
                "amount": amount,
                "max_bet": max_bet,
                "error": f"Mise maximum pour {bet_type}: {max_bet:.0f} HTG (vous avez mis {amount:.0f} HTG)"
            })
    
    return {
        "allowed": len(errors) == 0,
        "errors": errors,
        "disabled_types": disabled_types
    }


# ============================================================================
# VENDOR ENDPOINT - Get limits for current company
# ============================================================================

@bet_type_limits_router.get("/vendor/bet-type-limits")
async def get_vendor_bet_type_limits(current_user: dict = Depends(get_company_user)):
    """
    Get bet type limits for vendor to use in cart validation.
    Returns a simplified format optimized for frontend validation.
    """
    company_id = current_user.get("company_id")
    
    if not company_id:
        # Return defaults
        return {"limits": DEFAULT_LIMITS, "company_id": None}
    
    # Get company limits
    limits_doc = await db.bet_type_limits.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    # Merge with defaults
    result_limits = {}
    for game_type, defaults in DEFAULT_LIMITS.items():
        if limits_doc and game_type in limits_doc.get("limits", {}):
            result_limits[game_type] = limits_doc["limits"][game_type]
        else:
            result_limits[game_type] = defaults.copy()
    
    return {
        "company_id": company_id,
        "limits": result_limits
    }
