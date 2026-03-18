"""
LOTTOLAB Production Cleanup Script
Removes all test/demo accounts and data
Run ONCE before production deployment
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    print("❌ MONGO_URL not set")
    exit(1)

client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'lottolab_production')]


async def cleanup_production():
    print("=" * 60)
    print("  LOTTOLAB PRODUCTION CLEANUP")
    print("  ⚠️  This will remove ALL test/demo data")
    print("=" * 60)
    
    confirm = input("\nType 'CONFIRM' to proceed: ").strip()
    if confirm != "CONFIRM":
        print("Aborted.")
        return
    
    print("\n🧹 Starting cleanup...\n")
    
    # 1. Remove test users (emails containing 'test', '@test.com', 'demo')
    test_patterns = [
        {"email": {"$regex": "@test\\.com$", "$options": "i"}},
        {"email": {"$regex": "^test", "$options": "i"}},
        {"email": {"$regex": "demo", "$options": "i"}},
        {"email": {"$regex": "uitest", "$options": "i"}},
        {"email": {"$regex": "^dup[0-9]", "$options": "i"}},
    ]
    
    test_users_removed = 0
    for pattern in test_patterns:
        result = await db.users.delete_many(pattern)
        test_users_removed += result.deleted_count
    
    print(f"✅ Removed {test_users_removed} test users")
    
    # 2. Remove test companies (slugs containing 'test')
    test_companies = await db.companies.find(
        {"slug": {"$regex": "test", "$options": "i"}},
        {"_id": 0, "company_id": 1, "name": 1}
    ).to_list(100)
    
    for company in test_companies:
        cid = company["company_id"]
        # Remove all related data for this company
        await db.users.delete_many({"company_id": cid})
        await db.agents.delete_many({"company_id": cid})
        await db.pos_devices.delete_many({"company_id": cid})
        await db.branches.delete_many({"company_id": cid})
        await db.company_lotteries.delete_many({"company_id": cid})
        await db.company_configurations.delete_many({"company_id": cid})
        await db.company_config_versions.delete_many({"company_id": cid})
        await db.device_sessions.delete_many({"company_id": cid})
        await db.lottery_transactions.delete_many({"company_id": cid})
        await db.agent_balances.delete_many({"company_id": cid})
        await db.activity_logs.delete_many({"company_id": cid})
        await db.companies.delete_one({"company_id": cid})
        print(f"  - Removed company: {company['name']}")
    
    print(f"✅ Removed {len(test_companies)} test companies and all related data")
    
    # 3. Clean up orphaned data
    valid_companies = await db.companies.distinct("company_id")
    
    # Clean orphaned agents
    orphan_agents = await db.agents.delete_many(
        {"company_id": {"$nin": valid_companies}}
    )
    print(f"✅ Removed {orphan_agents.deleted_count} orphaned agents")
    
    # Clean orphaned device sessions
    orphan_sessions = await db.device_sessions.delete_many(
        {"company_id": {"$nin": valid_companies}}
    )
    print(f"✅ Removed {orphan_sessions.deleted_count} orphaned device sessions")
    
    # Clean orphaned pos_devices
    orphan_devices = await db.pos_devices.delete_many(
        {"company_id": {"$nin": valid_companies}}
    )
    print(f"✅ Removed {orphan_devices.deleted_count} orphaned POS devices")
    
    # 4. Remove old test transactions (optional - keep real ones)
    # Only remove if ticket_code contains 'TEST'
    test_transactions = await db.lottery_transactions.delete_many(
        {"ticket_code": {"$regex": "TEST", "$options": "i"}}
    )
    print(f"✅ Removed {test_transactions.deleted_count} test transactions")
    
    # 5. Add production indexes
    print("\n📊 Creating production indexes...")
    
    # Users indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("company_id")
    await db.users.create_index("role")
    
    # Companies indexes
    await db.companies.create_index("company_id", unique=True)
    await db.companies.create_index("slug", unique=True)
    await db.companies.create_index("status")
    
    # Transactions indexes
    await db.lottery_transactions.create_index("ticket_code", unique=True)
    await db.lottery_transactions.create_index("company_id")
    await db.lottery_transactions.create_index("agent_id")
    await db.lottery_transactions.create_index([("created_at", -1)])
    await db.lottery_transactions.create_index("status")
    
    # Agent balances indexes
    await db.agent_balances.create_index("agent_id", unique=True)
    await db.agent_balances.create_index("company_id")
    
    # Device sessions indexes
    await db.device_sessions.create_index("session_id", unique=True)
    await db.device_sessions.create_index("agent_id")
    await db.device_sessions.create_index([("last_seen_at", -1)])
    
    # Activity logs indexes (for audit trail)
    await db.activity_logs.create_index([("created_at", -1)])
    await db.activity_logs.create_index("company_id")
    await db.activity_logs.create_index("performed_by")
    await db.activity_logs.create_index("action_type")
    
    # Global lotteries indexes
    await db.global_lotteries.create_index("lottery_id", unique=True)
    await db.global_lotteries.create_index("state_code")
    await db.global_lotteries.create_index("is_active")
    
    # Global schedules indexes
    await db.global_schedules.create_index("schedule_id", unique=True)
    await db.global_schedules.create_index("lottery_id")
    
    # Company lotteries indexes
    await db.company_lotteries.create_index([("company_id", 1), ("lottery_id", 1)], unique=True)
    
    print("✅ Production indexes created")
    
    # 6. Final report
    print("\n" + "=" * 60)
    print("  PRODUCTION CLEANUP COMPLETE")
    print("=" * 60)
    
    users = await db.users.count_documents({})
    companies = await db.companies.count_documents({})
    agents = await db.agents.count_documents({})
    
    print(f"\n📊 Remaining data:")
    print(f"  - Users: {users}")
    print(f"  - Companies: {companies}")
    print(f"  - Agents: {agents}")
    
    # List remaining users
    remaining_users = await db.users.find({}, {"_id": 0, "email": 1, "role": 1}).to_list(100)
    print(f"\n👤 Active users:")
    for u in remaining_users:
        print(f"  - {u['email']} ({u['role']})")
    
    client.close()
    print("\n✅ Database is now production-ready!")


if __name__ == "__main__":
    asyncio.run(cleanup_production())
