"""
LOTTOLAB Staff Permissions & Role-Based Access Control (RBAC)
Manages company staff (Manager, Auditor, Viewer) permissions
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase

from models import UserRole
from auth import get_password_hash
from utils import generate_id, get_current_timestamp
from activity_logger import log_activity

staff_router = APIRouter(prefix="/company/staff", tags=["Company Staff Management"])

db: AsyncIOMotorDatabase = None


def set_staff_db(database: AsyncIOMotorDatabase):
    global db
    db = database


# ============================================================================
# ROLE PERMISSIONS DEFINITION
# ============================================================================

# Define what each role can do
ROLE_PERMISSIONS = {
    UserRole.COMPANY_ADMIN: {
        "can_manage_staff": True,
        "can_manage_agents": True,
        "can_manage_succursales": True,
        "can_view_financial": True,
        "can_modify_financial": True,
        "can_view_all_tickets": True,
        "can_void_tickets": True,
        "can_manage_lotteries": True,
        "can_view_reports": True,
        "can_export_data": True,
        "can_manage_settings": True,
        "level": 100
    },
    UserRole.COMPANY_MANAGER: {
        "can_manage_staff": False,
        "can_manage_agents": True,
        "can_manage_succursales": True,
        "can_view_financial": True,
        "can_modify_financial": False,
        "can_view_all_tickets": True,
        "can_void_tickets": True,
        "can_manage_lotteries": True,
        "can_view_reports": True,
        "can_export_data": True,
        "can_manage_settings": False,
        "level": 80
    },
    UserRole.BRANCH_SUPERVISOR: {
        "can_manage_staff": False,
        "can_manage_agents": True,  # Only for their branch
        "can_manage_succursales": False,
        "can_view_financial": True,  # Only for their branch
        "can_modify_financial": False,
        "can_view_all_tickets": False,  # Only for their branch
        "can_void_tickets": True,  # Only for their branch
        "can_manage_lotteries": False,
        "can_view_reports": True,  # Only for their branch
        "can_export_data": False,
        "can_manage_settings": False,
        "level": 60
    },
    UserRole.AUDITOR_READONLY: {
        "can_manage_staff": False,
        "can_manage_agents": False,
        "can_manage_succursales": False,
        "can_view_financial": True,
        "can_modify_financial": False,
        "can_view_all_tickets": True,
        "can_void_tickets": False,
        "can_manage_lotteries": False,
        "can_view_reports": True,
        "can_export_data": True,
        "can_manage_settings": False,
        "level": 40
    },
    UserRole.BRANCH_USER: {
        "can_manage_staff": False,
        "can_manage_agents": False,
        "can_manage_succursales": False,
        "can_view_financial": False,
        "can_modify_financial": False,
        "can_view_all_tickets": False,
        "can_void_tickets": False,
        "can_manage_lotteries": False,
        "can_view_reports": False,
        "can_export_data": False,
        "can_manage_settings": False,
        "level": 20
    },
    UserRole.AGENT_POS: {
        "can_manage_staff": False,
        "can_manage_agents": False,
        "can_manage_succursales": False,
        "can_view_financial": False,
        "can_modify_financial": False,
        "can_view_all_tickets": False,
        "can_void_tickets": False,
        "can_manage_lotteries": False,
        "can_view_reports": False,
        "can_export_data": False,
        "can_manage_settings": False,
        "level": 10
    }
}


def check_permission(user_role: str, permission: str) -> bool:
    """Check if a role has a specific permission"""
    role_perms = ROLE_PERMISSIONS.get(user_role, {})
    return role_perms.get(permission, False)


def get_role_level(role: str) -> int:
    """Get the hierarchical level of a role"""
    return ROLE_PERMISSIONS.get(role, {}).get("level", 0)


# ============================================================================
# MIDDLEWARE HELPERS
# ============================================================================

async def require_company_admin(current_user: dict):
    """Require COMPANY_ADMIN role"""
    if current_user.get("role") != UserRole.COMPANY_ADMIN:
        raise HTTPException(status_code=403, detail="Accès réservé à l'administrateur de l'entreprise")
    return current_user


async def require_staff_management(current_user: dict):
    """Require permission to manage staff"""
    if not check_permission(current_user.get("role"), "can_manage_staff"):
        raise HTTPException(status_code=403, detail="Vous n'avez pas la permission de gérer le personnel")
    return current_user


# ============================================================================
# STAFF MODELS
# ============================================================================

class StaffCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # COMPANY_MANAGER, AUDITOR_READONLY, BRANCH_USER
    succursale_id: Optional[str] = None  # Required for BRANCH_USER


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None


# ============================================================================
# STAFF MANAGEMENT ENDPOINTS
# ============================================================================

from server import get_current_user


@staff_router.get("/")
async def get_company_staff(current_user: dict = Depends(get_current_user)):
    """Get all staff members for the company (Admin only)"""
    await require_company_admin(current_user)
    
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Aucune entreprise associée")
    
    staff_roles = [UserRole.COMPANY_MANAGER, UserRole.AUDITOR_READONLY, UserRole.BRANCH_USER]
    
    staff = await db.users.find(
        {
            "company_id": company_id,
            "role": {"$in": [r.value for r in staff_roles]},
            "status": {"$ne": "DELETED"}
        },
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    return staff


@staff_router.post("/")
async def create_staff_member(
    staff_data: StaffCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Create a new staff member (Admin only)"""
    await require_company_admin(current_user)
    
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Aucune entreprise associée")
    
    # Validate role
    allowed_roles = ["COMPANY_MANAGER", "AUDITOR_READONLY", "BRANCH_USER"]
    if staff_data.role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Rôle invalide. Choisissez parmi: {allowed_roles}")
    
    # Check if email is already used
    existing = await db.users.find_one({"email": staff_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # Validate succursale for BRANCH_USER
    if staff_data.role == "BRANCH_USER" and not staff_data.succursale_id:
        raise HTTPException(status_code=400, detail="Une succursale est requise pour ce rôle")
    
    now = get_current_timestamp()
    user_id = generate_id("staff")
    
    new_staff = {
        "user_id": user_id,
        "email": staff_data.email,
        "password_hash": get_password_hash(staff_data.password),
        "name": staff_data.name,
        "role": staff_data.role,
        "company_id": company_id,
        "succursale_id": staff_data.succursale_id,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["user_id"]
    }
    
    await db.users.insert_one(new_staff)
    
    # Log activity
    await log_activity(
        db=db,
        action_type="STAFF_CREATED",
        entity_type="user",
        entity_id=user_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "staff_name": staff_data.name,
            "staff_email": staff_data.email,
            "role": staff_data.role
        },
        ip_address=request.client.host if request.client else None
    )
    
    new_staff.pop("password_hash", None)
    new_staff.pop("_id", None)
    
    return new_staff


@staff_router.put("/{user_id}/suspend")
async def suspend_staff_member(
    user_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Suspend a staff member - blocks their login and API access"""
    await require_company_admin(current_user)
    
    company_id = current_user.get("company_id")
    
    # Find the staff member
    staff = await db.users.find_one({
        "user_id": user_id,
        "company_id": company_id,
        "role": {"$in": ["COMPANY_MANAGER", "AUDITOR_READONLY", "BRANCH_USER"]}
    })
    
    if not staff:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    if staff.get("status") == "SUSPENDED":
        raise HTTPException(status_code=400, detail="Cet utilisateur est déjà suspendu")
    
    now = get_current_timestamp()
    
    # Suspend the staff member
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "status": "SUSPENDED",
            "suspended_at": now,
            "suspended_by": current_user["user_id"],
            "suspended_reason": "ADMIN_SUSPENSION",
            "updated_at": now
        }}
    )
    
    # Log activity
    await log_activity(
        db=db,
        action_type="STAFF_SUSPENDED",
        entity_type="user",
        entity_id=user_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "staff_name": staff.get("name"),
            "staff_email": staff.get("email"),
            "role": staff.get("role")
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": f"Utilisateur {staff.get('name')} suspendu",
        "user_id": user_id,
        "status": "SUSPENDED"
    }


@staff_router.put("/{user_id}/activate")
async def activate_staff_member(
    user_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Activate a suspended staff member"""
    await require_company_admin(current_user)
    
    company_id = current_user.get("company_id")
    
    # Find the staff member
    staff = await db.users.find_one({
        "user_id": user_id,
        "company_id": company_id,
        "role": {"$in": ["COMPANY_MANAGER", "AUDITOR_READONLY", "BRANCH_USER"]}
    })
    
    if not staff:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    if staff.get("status") == "ACTIVE":
        raise HTTPException(status_code=400, detail="Cet utilisateur est déjà actif")
    
    now = get_current_timestamp()
    
    # Activate the staff member
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "status": "ACTIVE",
                "activated_at": now,
                "activated_by": current_user["user_id"],
                "updated_at": now
            },
            "$unset": {
                "suspended_at": "",
                "suspended_by": "",
                "suspended_reason": ""
            }
        }
    )
    
    # Log activity
    await log_activity(
        db=db,
        action_type="STAFF_ACTIVATED",
        entity_type="user",
        entity_id=user_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "staff_name": staff.get("name"),
            "staff_email": staff.get("email"),
            "role": staff.get("role")
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": f"Utilisateur {staff.get('name')} activé",
        "user_id": user_id,
        "status": "ACTIVE"
    }


@staff_router.delete("/{user_id}")
async def delete_staff_member(
    user_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Soft delete a staff member - blocks access permanently"""
    await require_company_admin(current_user)
    
    company_id = current_user.get("company_id")
    
    # Find the staff member
    staff = await db.users.find_one({
        "user_id": user_id,
        "company_id": company_id,
        "role": {"$in": ["COMPANY_MANAGER", "AUDITOR_READONLY", "BRANCH_USER"]}
    })
    
    if not staff:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    now = get_current_timestamp()
    
    # Soft delete the staff member
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "status": "DELETED",
            "deleted_at": now,
            "deleted_by": current_user["user_id"],
            "updated_at": now
        }}
    )
    
    # Log activity
    await log_activity(
        db=db,
        action_type="STAFF_DELETED",
        entity_type="user",
        entity_id=user_id,
        performed_by=current_user["user_id"],
        company_id=company_id,
        metadata={
            "staff_name": staff.get("name"),
            "staff_email": staff.get("email"),
            "role": staff.get("role")
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": f"Utilisateur {staff.get('name')} supprimé",
        "user_id": user_id,
        "status": "DELETED"
    }


@staff_router.get("/permissions")
async def get_my_permissions(current_user: dict = Depends(get_current_user)):
    """Get current user's permissions based on their role"""
    role = current_user.get("role")
    permissions = ROLE_PERMISSIONS.get(role, {})
    
    return {
        "user_id": current_user.get("user_id"),
        "role": role,
        "permissions": permissions
    }


@staff_router.get("/roles")
async def get_available_roles(current_user: dict = Depends(get_current_user)):
    """Get all available staff roles with their permissions"""
    await require_company_admin(current_user)
    
    staff_roles = ["COMPANY_MANAGER", "AUDITOR_READONLY", "BRANCH_USER"]
    
    roles_info = []
    for role in staff_roles:
        perms = ROLE_PERMISSIONS.get(role, {})
        roles_info.append({
            "role": role,
            "name": get_role_display_name(role),
            "level": perms.get("level", 0),
            "permissions": perms
        })
    
    return roles_info


def get_role_display_name(role: str) -> str:
    """Get French display name for a role"""
    names = {
        "SUPER_ADMIN": "Super Administrateur",
        "COMPANY_ADMIN": "Administrateur Entreprise",
        "COMPANY_MANAGER": "Gestionnaire",
        "BRANCH_SUPERVISOR": "Superviseur de Succursale",
        "BRANCH_USER": "Utilisateur de Succursale",
        "AGENT_POS": "Agent POS",
        "AUDITOR_READONLY": "Auditeur (Lecture seule)"
    }
    return names.get(role, role)
