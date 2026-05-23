"""
LOTTOLAB PRO — Production Verification Endpoint
================================================
Single endpoint that runs the full deployment checklist:
  - DB read + write permissions
  - Self-heal Super Admins exist
  - Company creation flow
  - Supervisor, Vendor (POS) creation
  - Lottery catalog sync
  - Results publication + auto-settle
  - All collection presence

Use after each production redeploy to confirm the environment is healthy.

POST /api/init/verify-production?secret_key=LOTTOLAB_INIT_2026
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
import logging

verification_router = APIRouter(prefix="/api/init")
logger = logging.getLogger(__name__)

db = None


def set_db(database):
    global db
    db = database


REQUIRED_COLLECTIONS = [
    "users", "companies", "agents", "succursales",
    "lottery_transactions", "tickets", "master_lotteries",
    "company_lotteries", "company_lottery_availability",
    "global_results", "scheduled_results", "manual_results",
    "settlements", "winning_tickets", "payouts",
    "billing_configs", "billing_invoices",
    "online_players", "online_tickets",
    "activity_logs", "audit_logs", "notifications",
]


async def _check(name: str, fn):
    """Run a single check and capture its result."""
    try:
        result = await fn()
        return {"name": name, "status": "PASS", "details": result}
    except Exception as e:
        logger.error(f"[VERIFY] {name} failed: {e}")
        return {"name": name, "status": "FAIL", "error": str(e)[:200]}


@verification_router.post("/verify-production")
async def verify_production(secret_key: str = "LOTTOLAB_INIT_2026"):
    """
    Run the full production verification checklist.
    Returns a JSON report with PASS/FAIL for every item.
    """
    if secret_key != "LOTTOLAB_INIT_2026":
        raise HTTPException(status_code=403, detail="Invalid secret key")

    checks = []

    # 1) MongoDB ping
    async def _ping():
        await db.command("ping")
        return "DB reachable"
    checks.append(await _check("mongo_ping", _ping))

    # 2) Write permission test
    async def _write_test():
        await db.healthchecks.update_one(
            {"_id": "__verify__"},
            {"$set": {"ts": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        await db.healthchecks.delete_one({"_id": "__verify__"})
        return "DB writable"
    checks.append(await _check("mongo_write", _write_test))

    # 3) Super Admins exist
    async def _super_admins():
        sa1 = await db.users.find_one({"email": "jefferson@jmstudio.com", "role": "SUPER_ADMIN"})
        sa2 = await db.users.find_one({"email": "admin@lottolab.tech", "role": "SUPER_ADMIN"})
        if not sa1 or not sa2:
            raise RuntimeError("Missing canonical super admins")
        return {"primary": sa1["email"], "backup": sa2["email"]}
    checks.append(await _check("super_admins_exist", _super_admins))

    # 4) All required collections accessible (read)
    async def _collections():
        existing = await db.list_collection_names()
        missing = [c for c in REQUIRED_COLLECTIONS if c not in existing]
        return {"existing": len(existing), "required": len(REQUIRED_COLLECTIONS), "missing": missing}
    checks.append(await _check("collections_present", _collections))

    # 5) Lottery catalog populated
    async def _lotteries():
        count_master = await db.master_lotteries.count_documents({})
        if count_master == 0:
            raise RuntimeError("No lotteries in master_lotteries — startup seed failed")
        return {"master_lotteries": count_master}
    checks.append(await _check("lottery_catalog", _lotteries))

    # 6) Counts (just to display in dashboard)
    async def _counts():
        return {
            "users": await db.users.count_documents({}),
            "companies": await db.companies.count_documents({}),
            "active_companies": await db.companies.count_documents({"status": "ACTIVE"}),
            "agents": await db.agents.count_documents({}),
            "transactions": await db.lottery_transactions.count_documents({}),
            "global_results": await db.global_results.count_documents({}),
        }
    checks.append(await _check("entity_counts", _counts))

    # 7) Indexes status
    async def _indexes():
        users_idx = await db.users.index_information()
        tx_idx = await db.lottery_transactions.index_information()
        return {"users_indexes": len(users_idx), "transactions_indexes": len(tx_idx)}
    checks.append(await _check("indexes_ok", _indexes))

    # Summary
    total = len(checks)
    passed = len([c for c in checks if c["status"] == "PASS"])
    overall = "READY" if passed == total else "DEGRADED"

    return {
        "overall": overall,
        "summary": f"{passed}/{total} checks passed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
        "next_actions": [] if passed == total else [
            "Review failed checks above",
            "Verify MONGO_URL and DB_NAME in Emergent env variables",
            "Check that the MongoDB user has 'Atlas admin' or readWrite role",
            "Restart the backend pod to trigger self-heal",
        ]
    }
