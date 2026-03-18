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

async def seed_database():
    print("🌱 Seeding LOTTOLAB database...")
    
    # Clear existing data
    collections = ["users", "companies", "agents", "states", "lotteries", "plans", "company_lotteries", "pos_devices"]
    for collection in collections:
        await db[collection].delete_many({})
    
    # 1. Create Plans
    plans = [
        {
            "plan_id": "plan_basic",
            "name": "Basic",
            "max_agents": 5,
            "max_tickets_per_day": 1000,
            "max_lotteries": 10,
            "features": ["Basic reporting", "Email support"]
        },
        {
            "plan_id": "plan_pro",
            "name": "Pro",
            "max_agents": 20,
            "max_tickets_per_day": 5000,
            "max_lotteries": 50,
            "features": ["Advanced reporting", "Priority support", "Multi-device"]
        },
        {
            "plan_id": "plan_enterprise",
            "name": "Enterprise",
            "max_agents": 999,
            "max_tickets_per_day": 999999,
            "max_lotteries": 999,
            "features": ["Custom reporting", "24/7 support", "API access", "White-label"]
        }
    ]
    await db.plans.insert_many(plans)
    print("✅ Plans created")
    
    # 2. Create Super Admin
    super_admin = {
        "user_id": generate_id("user_"),
        "email": "jefferson@jmstudio.com",
        "password_hash": get_password_hash("JMStudio@2026!"),
        "name": "Jefferson Mignon",
        "role": "SUPER_ADMIN",
        "company_id": None,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(super_admin)
    print("✅ Super Admin created: jefferson@jmstudio.com / JMStudio@2026!")
    
    # 3. Create USA States (Priority 10)
    usa_states = [
        {"state_id": "state_ny", "name": "New York", "code": "NY", "country": "USA"},
        {"state_id": "state_fl", "name": "Florida", "code": "FL", "country": "USA"},
        {"state_id": "state_ga", "name": "Georgia", "code": "GA", "country": "USA"},
        {"state_id": "state_tx", "name": "Texas", "code": "TX", "country": "USA"},
        {"state_id": "state_tn", "name": "Tennessee", "code": "TN", "country": "USA"},
        {"state_id": "state_nj", "name": "New Jersey", "code": "NJ", "country": "USA"},
        {"state_id": "state_il", "name": "Illinois", "code": "IL", "country": "USA"},
        {"state_id": "state_ca", "name": "California", "code": "CA", "country": "USA"},
        {"state_id": "state_pa", "name": "Pennsylvania", "code": "PA", "country": "USA"},
        {"state_id": "state_ma", "name": "Massachusetts", "code": "MA", "country": "USA"}
    ]
    await db.states.insert_many(usa_states)
    print("✅ 10 USA States created")
    
    # 4. Create USA Lotteries
    base_time = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
    midday_draw = (base_time + timedelta(hours=1)).isoformat()
    evening_draw = (base_time + timedelta(hours=8)).isoformat()
    
    usa_lotteries = []
    for state in usa_states:
        # Pick 3 Midday
        usa_lotteries.append({
            "lottery_id": generate_id(f"lot_{state['code'].lower()}_p3m_"),
            "region": "USA_STATE",
            "state_id": state["state_id"],
            "lottery_name": f"{state['name']} Pick 3 Midday",
            "game_type": "Pick3",
            "draw_times": [midday_draw],
            "sales_open_offset_minutes": 240,
            "sales_close_offset_minutes": 5,
            "description": f"Pick 3 Midday draw for {state['name']}"
        })
        # Pick 3 Evening
        usa_lotteries.append({
            "lottery_id": generate_id(f"lot_{state['code'].lower()}_p3e_"),
            "region": "USA_STATE",
            "state_id": state["state_id"],
            "lottery_name": f"{state['name']} Pick 3 Evening",
            "game_type": "Pick3",
            "draw_times": [evening_draw],
            "sales_open_offset_minutes": 240,
            "sales_close_offset_minutes": 5,
            "description": f"Pick 3 Evening draw for {state['name']}"
        })
        # Pick 4 Evening
        usa_lotteries.append({
            "lottery_id": generate_id(f"lot_{state['code'].lower()}_p4_"),
            "region": "USA_STATE",
            "state_id": state["state_id"],
            "lottery_name": f"{state['name']} Pick 4 Evening",
            "game_type": "Pick4",
            "draw_times": [evening_draw],
            "sales_open_offset_minutes": 240,
            "sales_close_offset_minutes": 5,
            "description": f"Pick 4 Evening draw for {state['name']}"
        })
    
    await db.lotteries.insert_many(usa_lotteries)
    print(f"✅ {len(usa_lotteries)} USA Lotteries created")
    
    # 5. Create Haiti Lotteries
    haiti_lotteries = [
        {
            "lottery_id": generate_id("lot_ht_borlette_"),
            "region": "HAITI",
            "state_id": None,
            "lottery_name": "Borlette",
            "game_type": "Bolèt",
            "draw_times": [midday_draw, evening_draw],
            "sales_open_offset_minutes": 180,
            "sales_close_offset_minutes": 10,
            "description": "Traditional Haitian lottery (00-99)"
        },
        {
            "lottery_id": generate_id("lot_ht_loto3_"),
            "region": "HAITI",
            "state_id": None,
            "lottery_name": "Loto 3",
            "game_type": "Loto3D",
            "draw_times": [evening_draw],
            "sales_open_offset_minutes": 240,
            "sales_close_offset_minutes": 5,
            "description": "3-digit lottery Haiti"
        },
        {
            "lottery_id": generate_id("lot_ht_loto4_"),
            "region": "HAITI",
            "state_id": None,
            "lottery_name": "Loto 4",
            "game_type": "Loto4D",
            "draw_times": [evening_draw],
            "sales_open_offset_minutes": 240,
            "sales_close_offset_minutes": 5,
            "description": "4-digit lottery Haiti"
        },
        {
            "lottery_id": generate_id("lot_ht_mariage_"),
            "region": "HAITI",
            "state_id": None,
            "lottery_name": "Mariage",
            "game_type": "Mariage",
            "draw_times": [midday_draw, evening_draw],
            "sales_open_offset_minutes": 180,
            "sales_close_offset_minutes": 10,
            "description": "Mariage lottery Haiti"
        },
        {
            "lottery_id": generate_id("lot_ht_tipon_"),
            "region": "HAITI",
            "state_id": None,
            "lottery_name": "Ti Pon",
            "game_type": "TiPon",
            "draw_times": [midday_draw, evening_draw],
            "sales_open_offset_minutes": 180,
            "sales_close_offset_minutes": 10,
            "description": "Ti Pon lottery Haiti"
        }
    ]
    
    await db.lotteries.insert_many(haiti_lotteries)
    print(f"✅ {len(haiti_lotteries)} Haiti Lotteries created")
    
    # 6. Create Test Company: LotoPam Center
    company_id = generate_id("comp_")
    company = {
        "company_id": company_id,
        "name": "LotoPam Center",
        "slug": "lotopam",
        "status": "ACTIVE",
        "plan": "Pro",
        "license_start": datetime.now(timezone.utc).isoformat(),
        "license_end": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
        "currency": "HTG",
        "timezone": "America/Port-au-Prince",
        "contact_email": "contact@lotopam.com",
        "contact_phone": "+509-1234-5678",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.companies.insert_one(company)
    print("✅ Test Company created: LotoPam Center")
    
    # 7. Create Company Admin
    admin_user_id = generate_id("user_")
    admin_user = {
        "user_id": admin_user_id,
        "email": "admin@lotopam.com",
        "password_hash": get_password_hash("Admin123!"),
        "name": "Admin LotoPam",
        "role": "COMPANY_ADMIN",
        "company_id": company_id,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_user)
    print("✅ Company Admin created: admin@lotopam.com / Admin123!")
    
    # 8. Create Test Agent
    agent_user_id = generate_id("user_")
    agent_user = {
        "user_id": agent_user_id,
        "email": "agent001@pos.lottolab.local",
        "password_hash": get_password_hash("Agent123!"),
        "name": "Agent 001",
        "role": "AGENT_POS",
        "company_id": company_id,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(agent_user)
    
    agent_id = generate_id("agent_")
    agent = {
        "agent_id": agent_id,
        "company_id": company_id,
        "name": "Agent 001",
        "username": "agent001",
        "phone": "+509-9999-0001",
        "email": "agent001@pos.lottolab.local",
        "status": "ACTIVE",
        "can_void_ticket": False,
        "user_id": agent_user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.agents.insert_one(agent)
    print("✅ Test Agent created: agent001@pos.lottolab.local / Agent123!")
    
    # 9. Enable some lotteries for LotoPam
    all_lotteries = await db.lotteries.find({}, {"_id": 0}).to_list(1000)
    company_lotteries_docs = []
    
    for lottery in all_lotteries[:15]:
        company_lotteries_docs.append({
            "company_id": company_id,
            "lottery_id": lottery["lottery_id"],
            "enabled": True
        })
    
    if company_lotteries_docs:
        await db.company_lotteries.insert_many(company_lotteries_docs)
    print(f"✅ Enabled {len(company_lotteries_docs)} lotteries for LotoPam")
    
    # 10. Create POS Device
    device = {
        "device_id": generate_id("dev_"),
        "company_id": company_id,
        "device_name": "POS Terminal 01",
        "agent_id": agent_id,
        "status": "ACTIVE",
        "last_seen": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.pos_devices.insert_one(device)
    print("✅ POS Device created")
    
    print("\n🎉 Database seeding completed!")
    print("\n📋 LOGIN CREDENTIALS:")
    print("="*50)
    print("Super Admin:")
    print("  Email: jefferson@jmstudio.com")
    print("  Password: JMStudio@2026!")
    print("\nCompany Admin (LotoPam):")
    print("  Email: admin@lotopam.com")
    print("  Password: Admin123!")
    print("\nAgent POS:")
    print("  Email: agent001@pos.lottolab.local")
    print("  Password: Agent123!")
    print("="*50)

if __name__ == "__main__":
    asyncio.run(seed_database())
