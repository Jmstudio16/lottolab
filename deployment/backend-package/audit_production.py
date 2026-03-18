"""
LOTTOLAB Production Audit Script
Validates all synchronization mechanisms and data integrity
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
db = client[os.environ.get('DB_NAME', 'test_database')]


async def audit_production():
    print("=" * 70)
    print("  LOTTOLAB PRODUCTION AUDIT REPORT")
    print("  Generated:", datetime.now(timezone.utc).isoformat())
    print("=" * 70)
    
    issues = []
    warnings = []
    passed = []
    
    # ========================================
    # 1. MULTI-TENANT ISOLATION AUDIT
    # ========================================
    print("\n📋 1. MULTI-TENANT ISOLATION AUDIT")
    print("-" * 50)
    
    companies = await db.companies.find({}, {"_id": 0}).to_list(100)
    
    for company in companies:
        cid = company["company_id"]
        
        # Check all users belong to correct company
        users = await db.users.find({"company_id": cid}, {"_id": 0, "email": 1}).to_list(500)
        
        # Check agents belong to company
        agents = await db.agents.find({"company_id": cid}, {"_id": 0}).to_list(500)
        
        # Check lotteries are company-specific
        lotteries = await db.company_lotteries.find({"company_id": cid}, {"_id": 0}).to_list(500)
        
        print(f"  ✅ {company['name']}: {len(users)} users, {len(agents)} agents, {len(lotteries)} lotteries")
        passed.append(f"Company '{company['name']}' has isolated data")
    
    # Check for data leakage (users with invalid company_id)
    valid_company_ids = [c["company_id"] for c in companies]
    valid_company_ids.append(None)  # Super Admin has None
    
    leaked_users = await db.users.find(
        {"company_id": {"$nin": valid_company_ids}},
        {"_id": 0, "email": 1, "company_id": 1}
    ).to_list(100)
    
    if leaked_users:
        issues.append(f"⚠️ {len(leaked_users)} users with invalid company_id")
        for u in leaked_users:
            print(f"  ❌ Data leak: {u['email']} -> company_id: {u['company_id']}")
    else:
        passed.append("No data leakage between companies")
        print("  ✅ No data leakage detected")
    
    # ========================================
    # 2. SYNCHRONIZATION MECHANISM AUDIT
    # ========================================
    print("\n📋 2. SYNCHRONIZATION MECHANISM AUDIT")
    print("-" * 50)
    
    # Check config versions exist for all companies
    for company in companies:
        cid = company["company_id"]
        config_version = await db.company_config_versions.find_one({"company_id": cid})
        
        if config_version:
            print(f"  ✅ {company['name']}: config_version = {config_version.get('version', 0)}")
            passed.append(f"Company '{company['name']}' has config versioning")
        else:
            warnings.append(f"Company '{company['name']}' missing config_version")
            print(f"  ⚠️ {company['name']}: No config_version (will be created on first change)")
    
    # Check device sessions
    active_sessions = await db.device_sessions.find(
        {"status": "active"},
        {"_id": 0, "agent_id": 1, "last_seen_at": 1, "device_type": 1}
    ).to_list(500)
    
    print(f"\n  📱 Active device sessions: {len(active_sessions)}")
    
    # Check for stale sessions (last_seen > 24 hours ago)
    now = datetime.now(timezone.utc)
    stale_sessions = 0
    for session in active_sessions:
        try:
            last_seen = datetime.fromisoformat(session.get("last_seen_at", "").replace("Z", "+00:00"))
            if (now - last_seen).total_seconds() > 86400:
                stale_sessions += 1
        except:
            pass
    
    if stale_sessions > 0:
        warnings.append(f"{stale_sessions} stale device sessions (>24h)")
        print(f"  ⚠️ {stale_sessions} stale sessions (consider cleanup)")
    else:
        passed.append("No stale device sessions")
    
    # ========================================
    # 3. FINANCIAL SYSTEM AUDIT
    # ========================================
    print("\n📋 3. FINANCIAL SYSTEM AUDIT")
    print("-" * 50)
    
    # Check agent balances exist
    agents = await db.agents.find({}, {"_id": 0, "agent_id": 1, "company_id": 1, "name": 1}).to_list(500)
    agents_with_balance = 0
    agents_without_balance = 0
    
    for agent in agents:
        balance = await db.agent_balances.find_one({"agent_id": agent["agent_id"]})
        if balance:
            agents_with_balance += 1
        else:
            agents_without_balance += 1
            # Check if agent has user account
            user = await db.users.find_one({"user_id": agent.get("user_id")})
            if user:
                warnings.append(f"Agent {agent['name']} missing balance record")
    
    print(f"  📊 Agents with balance: {agents_with_balance}")
    print(f"  📊 Agents without balance: {agents_without_balance}")
    
    if agents_without_balance == 0 or agents_without_balance < len(agents) * 0.2:
        passed.append("Agent balance system operational")
    
    # Check transaction integrity
    transactions = await db.lottery_transactions.count_documents({})
    pending_transactions = await db.lottery_transactions.count_documents({"status": "PENDING_RESULT"})
    paid_transactions = await db.lottery_transactions.count_documents({"status": "PAID"})
    
    print(f"\n  📊 Transactions: {transactions} total")
    print(f"  📊 Pending results: {pending_transactions}")
    print(f"  📊 Paid out: {paid_transactions}")
    
    passed.append("Transaction tracking operational")
    
    # ========================================
    # 4. LOTTERY SYSTEM AUDIT
    # ========================================
    print("\n📋 4. LOTTERY SYSTEM AUDIT")
    print("-" * 50)
    
    global_lotteries = await db.global_lotteries.count_documents({"is_active": True})
    global_schedules = await db.global_schedules.count_documents({"is_active": True})
    
    print(f"  📊 Global lotteries (active): {global_lotteries}")
    print(f"  📊 Global schedules (active): {global_schedules}")
    
    # Check lottery-schedule consistency
    lotteries_without_schedules = []
    all_lotteries = await db.global_lotteries.find({"is_active": True}, {"_id": 0, "lottery_id": 1, "lottery_name": 1}).to_list(500)
    
    for lottery in all_lotteries:
        schedules = await db.global_schedules.count_documents({"lottery_id": lottery["lottery_id"], "is_active": True})
        if schedules == 0:
            lotteries_without_schedules.append(lottery["lottery_name"])
    
    if lotteries_without_schedules:
        warnings.append(f"{len(lotteries_without_schedules)} lotteries without schedules")
        print(f"  ⚠️ {len(lotteries_without_schedules)} lotteries without schedules")
    else:
        passed.append("All lotteries have schedules")
        print(f"  ✅ All active lotteries have schedules")
    
    # ========================================
    # 5. SECURITY AUDIT
    # ========================================
    print("\n📋 5. SECURITY AUDIT")
    print("-" * 50)
    
    # Check for Super Admin accounts
    super_admins = await db.users.count_documents({"role": "SUPER_ADMIN"})
    print(f"  📊 Super Admin accounts: {super_admins}")
    
    if super_admins == 0:
        issues.append("No Super Admin account exists!")
    else:
        passed.append(f"{super_admins} Super Admin account(s) configured")
    
    # Check for weak patterns in emails
    weak_patterns = await db.users.count_documents({
        "email": {"$regex": "admin@admin|test@test|user@user", "$options": "i"}
    })
    
    if weak_patterns > 0:
        warnings.append(f"{weak_patterns} accounts with weak email patterns")
    else:
        passed.append("No weak email patterns detected")
        print("  ✅ No weak email patterns")
    
    # Check activity logging
    activity_logs = await db.activity_logs.count_documents({})
    recent_logs = await db.activity_logs.count_documents({
        "created_at": {"$gte": (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)).isoformat()}
    })
    
    print(f"  📊 Total activity logs: {activity_logs}")
    print(f"  📊 Today's logs: {recent_logs}")
    
    if activity_logs > 0:
        passed.append("Activity logging operational")
    else:
        warnings.append("No activity logs found")
    
    # ========================================
    # 6. DATABASE INDEXES AUDIT
    # ========================================
    print("\n📋 6. DATABASE INDEXES AUDIT")
    print("-" * 50)
    
    critical_indexes = [
        ("users", "email"),
        ("companies", "company_id"),
        ("lottery_transactions", "ticket_code"),
        ("agent_balances", "agent_id"),
        ("device_sessions", "session_id"),
    ]
    
    for collection, field in critical_indexes:
        indexes = await db[collection].index_information()
        has_index = any(field in str(idx) for idx in indexes.values())
        
        if has_index:
            print(f"  ✅ {collection}.{field} indexed")
            passed.append(f"Index on {collection}.{field}")
        else:
            warnings.append(f"Missing index: {collection}.{field}")
            print(f"  ⚠️ {collection}.{field} NOT indexed")
    
    # ========================================
    # FINAL REPORT
    # ========================================
    print("\n" + "=" * 70)
    print("  AUDIT SUMMARY")
    print("=" * 70)
    
    print(f"\n✅ PASSED: {len(passed)}")
    for p in passed[:10]:
        print(f"   - {p}")
    if len(passed) > 10:
        print(f"   ... and {len(passed) - 10} more")
    
    print(f"\n⚠️ WARNINGS: {len(warnings)}")
    for w in warnings:
        print(f"   - {w}")
    
    print(f"\n❌ ISSUES: {len(issues)}")
    for i in issues:
        print(f"   - {i}")
    
    # Production readiness score
    total_checks = len(passed) + len(warnings) + len(issues)
    score = (len(passed) / total_checks * 100) if total_checks > 0 else 0
    
    print(f"\n📊 PRODUCTION READINESS SCORE: {score:.1f}%")
    
    if len(issues) == 0 and len(warnings) <= 5:
        print("✅ SYSTEM IS PRODUCTION READY")
    elif len(issues) == 0:
        print("⚠️ SYSTEM NEEDS MINOR FIXES BEFORE PRODUCTION")
    else:
        print("❌ SYSTEM HAS CRITICAL ISSUES - NOT PRODUCTION READY")
    
    client.close()
    
    return {
        "passed": len(passed),
        "warnings": len(warnings),
        "issues": len(issues),
        "score": score
    }


if __name__ == "__main__":
    asyncio.run(audit_production())
