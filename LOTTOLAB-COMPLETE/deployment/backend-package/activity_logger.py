from motor.motor_asyncio import AsyncIOMotorDatabase
from utils import generate_id, get_current_timestamp
from typing import Optional, Dict, Any

async def log_activity(
    db: AsyncIOMotorDatabase,
    action_type: str,
    entity_type: str,
    entity_id: str,
    performed_by: str,
    company_id: Optional[str] = None,
    metadata: Dict[str, Any] = {},
    ip_address: Optional[str] = None
):
    """Log an activity to the activity_logs collection"""
    
    # Get user info
    user = await db.users.find_one({"user_id": performed_by}, {"_id": 0, "name": 1})
    performed_by_name = user.get("name") if user else "Unknown"
    
    # Get company info if company_id provided
    company_name = None
    if company_id:
        company = await db.companies.find_one({"company_id": company_id}, {"_id": 0, "name": 1})
        company_name = company.get("name") if company else None
    
    log_entry = {
        "log_id": generate_id("log_"),
        "action_type": action_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "performed_by": performed_by,
        "performed_by_name": performed_by_name,
        "company_id": company_id,
        "company_name": company_name,
        "metadata": metadata,
        "ip_address": ip_address,
        "created_at": get_current_timestamp()
    }
    
    await db.activity_logs.insert_one(log_entry)
