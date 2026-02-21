import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, timedelta
from auth import get_password_hash
from utils import generate_id

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

async def initialize_production_data():
    print("🚀 Initializing LOTTOLAB Production Data...")
    
    # 1. Create System Settings
    print("\n1. Creating System Settings...")
    existing_settings = await db.system_settings.find_one({"settings_id": "system_settings"})
    if not existing_settings:
        settings = {
            "settings_id": "system_settings",
            "platform_name": "LOTTOLAB",
            "platform_logo": "https://customer-assets.emergentagent.com/job_36e4b3a7-6dc6-43e8-b4c7-e0a52462b3df/artifacts/ztvthede_ChatGPT%20Image%2019%20f%C3%A9vr.%202026%2C%2020_13_22.png",
            "default_currency": "HTG",
            "default_timezone": "America/Port-au-Prince",
            "ticket_code_length": 12,
            "verification_code_length": 12,
            "maintenance_mode": False,
            "allow_company_registration": False,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": None
        }
        await db.system_settings.insert_one(settings)
        print("✅ System Settings created")
    else:
        print("✅ System Settings already exist")
    
    # 2. Update Plans with new fields
    print("\n2. Updating Plans...")
    plans = await db.plans.find({}).to_list(100)
    for plan in plans:
        if "price" not in plan or "max_pos_devices" not in plan:
            updates = {
                "price": 0.0 if plan["name"] == "Basic" else (49.99 if plan["name"] == "Pro" else 199.99),
                "max_pos_devices": 5 if plan["name"] == "Basic" else (20 if plan["name"] == "Pro" else 999),
                "status": "ACTIVE",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.plans.update_one(
                {"plan_id": plan["plan_id"]},
                {"$set": updates}
            )
            print(f"✅ Updated plan: {plan['name']}")
    
    # 3. Create Licenses for existing companies
    print("\n3. Creating Licenses for existing companies...")
    companies = await db.companies.find({}).to_list(100)
    plans_list = await db.plans.find({}).to_list(100)
    
    for company in companies:
        # Check if license exists
        existing_license = await db.licenses.find_one({"company_id": company["company_id"]})
        if not existing_license:
            # Find matching plan
            plan_name = company.get("plan", "Basic")
            plan = next((p for p in plans_list if p["name"] == plan_name), plans_list[0])
            
            now = datetime.now(timezone.utc)
            start_date = company.get("license_start") or company.get("created_at")
            expiry_date = company.get("license_end") or (now + timedelta(days=365)).isoformat()
            
            license_doc = {
                "license_id": generate_id("lic_"),
                "company_id": company["company_id"],
                "company_name": company["name"],
                "plan_id": plan["plan_id"],
                "plan_name": plan["name"],
                "start_date": start_date,
                "expiry_date": expiry_date,
                "status": "ACTIVE" if company.get("status") == "ACTIVE" else "INACTIVE",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.licenses.insert_one(license_doc)
            print(f"✅ Created license for: {company['name']}")
    
    # 4. Add last_login field to all users
    print("\n4. Updating Users with last_login field...")
    users_without_last_login = await db.users.find({"last_login": {"$exists": False}}).to_list(1000)
    for user in users_without_last_login:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"last_login": None}}
        )
    print(f"✅ Updated {len(users_without_last_login)} users")
    
    # 5. Create indexes for performance
    print("\n5. Creating database indexes...")
    await db.users.create_index("email")
    await db.users.create_index([("company_id", 1), ("role", 1)])
    await db.activity_logs.create_index([("created_at", -1)])
    await db.activity_logs.create_index("company_id")
    await db.activity_logs.create_index("action_type")
    await db.licenses.create_index("company_id")
    await db.tickets.create_index([("company_id", 1), ("created_at", -1)])
    print("✅ Indexes created")
    
    print("\n🎉 Production data initialization completed!")
    print("\n📊 Summary:")
    print(f"  - Plans: {len(plans)} configured")
    print(f"  - Companies: {len(companies)} active")
    print(f"  - Licenses: {len(companies)} created")
    print("  - System Settings: Configured")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(initialize_production_data())
