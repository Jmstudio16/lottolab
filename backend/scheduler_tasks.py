"""
LOTTOLAB SaaS Scheduler Tasks
Automated subscription expiration and status management
"""

import asyncio
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import OperationFailure, ServerSelectionTimeoutError, ConnectionFailure

from utils import get_current_timestamp
from activity_logger import log_activity

logger = logging.getLogger(__name__)

db: AsyncIOMotorDatabase = None

def set_scheduler_db(database: AsyncIOMotorDatabase):
    """Set database reference for scheduler"""
    global db
    db = database


async def check_expired_subscriptions():
    """
    Daily job to check and expire company subscriptions.
    Runs at 00:00 server time.
    
    If today > subscription_end_date:
    - Set company status to EXPIRED
    - Block login for company admin
    - Block login for all succursales
    - Block login for all agents
    - Block ticket sales
    """
    if db is None:
        logger.error("[CRON] Database not initialized for scheduler")
        return
    
    try:
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        
        logger.info(f"[CRON] Starting subscription expiration check at {now_iso}")
        
        # Find all companies that should be expired
        # Status is ACTIVE or TRIAL, and license_end or subscription_end_date is in the past
        expired_query = {
            "status": {"$in": ["ACTIVE", "TRIAL"]},
            "$or": [
                {"license_end": {"$lt": now_iso, "$ne": None}},
                {"subscription_end_date": {"$lt": now_iso, "$ne": None}}
            ]
        }
        
        companies_to_expire = await db.companies.find(
            expired_query,
            {"_id": 0, "company_id": 1, "name": 1, "license_end": 1, "subscription_end_date": 1}
        ).to_list(1000)
        
        expired_count = 0
        
        for company in companies_to_expire:
            company_id = company["company_id"]
            company_name = company.get("name", "Unknown")
            
            try:
                # 1. Update company status to EXPIRED
                await db.companies.update_one(
                    {"company_id": company_id},
                    {"$set": {
                        "status": "EXPIRED",
                        "expired_at": now_iso,
                        "expired_by_cron": True,
                        "updated_at": now_iso
                    }}
                )
                
                # 2. Suspend all users of this company (blocks their login)
                await db.users.update_many(
                    {"company_id": company_id, "status": "ACTIVE"},
                    {"$set": {
                        "status": "SUSPENDED",
                        "suspended_reason": "SUBSCRIPTION_EXPIRED",
                        "suspended_at": now_iso,
                        "updated_at": now_iso
                    }}
                )
                
                # 3. Mark all succursales as suspended
                await db.succursales.update_many(
                    {"company_id": company_id, "status": {"$ne": "DELETED"}},
                    {"$set": {
                        "status": "SUSPENDED",
                        "suspended_reason": "SUBSCRIPTION_EXPIRED",
                        "updated_at": now_iso
                    }}
                )
                
                # 4. Log activity
                await log_activity(
                    db=db,
                    action_type="SUBSCRIPTION_AUTO_EXPIRED",
                    entity_type="company",
                    entity_id=company_id,
                    performed_by="SYSTEM_CRON",
                    company_id=company_id,
                    metadata={
                        "company_name": company_name,
                        "license_end": company.get("license_end"),
                        "subscription_end_date": company.get("subscription_end_date"),
                        "expired_at": now_iso
                    }
                )
                
                # 5. Create notification for Super Admin
                await db.admin_notifications.insert_one({
                    "notification_id": f"notif_{company_id}_{now.strftime('%Y%m%d')}",
                    "type": "SUBSCRIPTION_EXPIRED",
                    "target_role": "SUPER_ADMIN",
                    "title": f"Abonnement expiré: {company_name}",
                    "message": f"L'abonnement de l'entreprise {company_name} a expiré automatiquement.",
                    "company_id": company_id,
                    "read": False,
                    "created_at": now_iso
                })
                
                expired_count += 1
                logger.info(f"[CRON] Expired company: {company_name} (ID: {company_id})")
                
            except OperationFailure as e:
                logger.error(f"[CRON] MongoDB authorization error for company {company_id}: {e.details}")
                continue
            except Exception as e:
                logger.error(f"[CRON] Error expiring company {company_id}: {e}")
                continue
        
        # Log summary
        logger.info(f"[CRON] Subscription check complete. Expired {expired_count} companies.")
        
        # Store cron run log - wrapped in try/except for auth errors
        try:
            await db.cron_logs.insert_one({
                "job_name": "check_expired_subscriptions",
                "run_at": now_iso,
                "companies_checked": len(companies_to_expire),
                "companies_expired": expired_count,
                "status": "SUCCESS"
            })
        except OperationFailure as e:
            logger.warning(f"[CRON] Could not write to cron_logs (auth error): {e.details}")
        
    except OperationFailure as e:
        # MongoDB authorization error - handle gracefully
        logger.error(f"[CRON] MongoDB authorization error in subscription check: code={e.code}, details={e.details}")
        try:
            await db.cron_logs.insert_one({
                "job_name": "check_expired_subscriptions",
                "run_at": datetime.now(timezone.utc).isoformat(),
                "status": "AUTH_ERROR",
                "error": str(e)
            })
        except:
            pass  # Can't write log if auth failed
            
    except (ServerSelectionTimeoutError, ConnectionFailure) as e:
        logger.error(f"[CRON] MongoDB connection error: {e}")
        
    except Exception as e:
        logger.error(f"[CRON] Critical error in subscription check: {e}")
        try:
            await db.cron_logs.insert_one({
                "job_name": "check_expired_subscriptions",
                "run_at": datetime.now(timezone.utc).isoformat(),
                "status": "ERROR",
                "error": str(e)
            })
        except:
            pass


async def check_expiring_soon():
    """
    Check companies expiring within 7 days and send notifications.
    """
    if db is None:
        logger.warning("[CRON] Database not initialized for expiring check")
        return
    
    try:
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        
        # Find companies expiring in next 7 days
        from datetime import timedelta
        seven_days_later = (now + timedelta(days=7)).isoformat()
        
        expiring_soon_query = {
            "status": "ACTIVE",
            "$or": [
                {
                    "license_end": {"$gte": now_iso, "$lte": seven_days_later}
                },
                {
                    "subscription_end_date": {"$gte": now_iso, "$lte": seven_days_later}
                }
            ]
        }
        
        expiring_companies = await db.companies.find(
            expiring_soon_query,
            {"_id": 0, "company_id": 1, "name": 1, "license_end": 1, "subscription_end_date": 1, "contact_email": 1}
        ).to_list(500)
        
        for company in expiring_companies:
            company_id = company["company_id"]
            company_name = company.get("name", "Unknown")
            end_date = company.get("license_end") or company.get("subscription_end_date")
            
            try:
                # Check if notification already sent today
                existing = await db.admin_notifications.find_one({
                    "company_id": company_id,
                    "type": "SUBSCRIPTION_EXPIRING_SOON",
                    "created_at": {"$gte": now.replace(hour=0, minute=0, second=0).isoformat()}
                })
                
                if not existing:
                    # Calculate days remaining
                    try:
                        end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                        days_remaining = (end - now).days
                    except:
                        days_remaining = 7
                    
                    await db.admin_notifications.insert_one({
                        "notification_id": f"notif_expiring_{company_id}_{now.strftime('%Y%m%d')}",
                        "type": "SUBSCRIPTION_EXPIRING_SOON",
                        "target_role": "SUPER_ADMIN",
                        "title": f"Abonnement expire bientôt: {company_name}",
                        "message": f"L'abonnement de {company_name} expire dans {days_remaining} jours.",
                        "company_id": company_id,
                        "days_remaining": days_remaining,
                        "read": False,
                        "created_at": now_iso
                    })
                    
                    logger.info(f"[CRON] Notification sent for expiring company: {company_name} ({days_remaining} days)")
                    
            except OperationFailure as e:
                logger.warning(f"[CRON] MongoDB auth error for company {company_id}: {e.details}")
                continue
            except Exception as e:
                logger.error(f"[CRON] Error processing company {company_id}: {e}")
                continue
        
    except OperationFailure as e:
        logger.error(f"[CRON] MongoDB authorization error in expiring check: code={e.code}")
    except (ServerSelectionTimeoutError, ConnectionFailure) as e:
        logger.error(f"[CRON] MongoDB connection error in expiring check: {e}")
    except Exception as e:
        logger.error(f"[CRON] Error checking expiring subscriptions: {e}")


def run_sync(coro):
    """Helper to run async function in sync context"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def job_check_expired():
    """Sync wrapper for scheduler"""
    run_sync(check_expired_subscriptions())


def job_check_expiring_soon():
    """Sync wrapper for scheduler"""
    run_sync(check_expiring_soon())
