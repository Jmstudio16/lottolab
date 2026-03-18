"""
LOTTOLAB SaaS - Database Seeding Script
Creates 190 master lotteries, default plans, super admin, and initial data
"""

import asyncio
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from auth import get_password_hash
from utils import generate_id, get_current_timestamp

# US State Lottery Data (190 lotteries)
US_STATES_LOTTERIES = [
    # New York (12 lotteries)
    {"state_code": "NY", "state_name": "New York", "lotteries": [
        ("NY Pick 3 Midday", "PICK3"), ("NY Pick 3 Evening", "PICK3"),
        ("NY Pick 4 Midday", "PICK4"), ("NY Pick 4 Evening", "PICK4"),
        ("NY Take 5 Midday", "PICK5"), ("NY Take 5 Evening", "PICK5"),
        ("NY Win 4 Midday", "BORLETTE"), ("NY Win 4 Evening", "BORLETTE"),
        ("NY Numbers Midday", "LOTO3"), ("NY Numbers Evening", "LOTO3"),
        ("NY Lotto", "LOTO6"), ("NY Cash4Life", "LOTO5"),
    ]},
    # Florida (10 lotteries)
    {"state_code": "FL", "state_name": "Florida", "lotteries": [
        ("FL Pick 2 Midday", "PICK2"), ("FL Pick 2 Evening", "PICK2"),
        ("FL Pick 3 Midday", "PICK3"), ("FL Pick 3 Evening", "PICK3"),
        ("FL Pick 4 Midday", "PICK4"), ("FL Pick 4 Evening", "PICK4"),
        ("FL Pick 5 Midday", "PICK5"), ("FL Pick 5 Evening", "PICK5"),
        ("FL Cash Pop", "BORLETTE"), ("FL Fantasy 5", "LOTO5"),
    ]},
    # Georgia (10 lotteries)
    {"state_code": "GA", "state_name": "Georgia", "lotteries": [
        ("GA Cash 3 Midday", "PICK3"), ("GA Cash 3 Evening", "PICK3"), ("GA Cash 3 Night", "PICK3"),
        ("GA Cash 4 Midday", "PICK4"), ("GA Cash 4 Evening", "PICK4"), ("GA Cash 4 Night", "PICK4"),
        ("GA Cash Pop", "BORLETTE"), ("GA Fantasy 5", "LOTO5"),
        ("GA FIVE", "PICK5"), ("GA Jumbo Bucks Lotto", "LOTO6"),
    ]},
    # Texas (8 lotteries)
    {"state_code": "TX", "state_name": "Texas", "lotteries": [
        ("TX Pick 3 Day", "PICK3"), ("TX Pick 3 Night", "PICK3"),
        ("TX Daily 4 Day", "PICK4"), ("TX Daily 4 Night", "PICK4"),
        ("TX Cash Five", "LOTO5"), ("TX All or Nothing Day", "BORLETTE"),
        ("TX All or Nothing Night", "BORLETTE"), ("TX Lotto Texas", "LOTO6"),
    ]},
    # Pennsylvania (10 lotteries)
    {"state_code": "PA", "state_name": "Pennsylvania", "lotteries": [
        ("PA Pick 2 Day", "PICK2"), ("PA Pick 2 Evening", "PICK2"),
        ("PA Pick 3 Day", "PICK3"), ("PA Pick 3 Evening", "PICK3"),
        ("PA Pick 4 Day", "PICK4"), ("PA Pick 4 Evening", "PICK4"),
        ("PA Pick 5 Day", "PICK5"), ("PA Pick 5 Evening", "PICK5"),
        ("PA Cash 5", "LOTO5"), ("PA Treasure Hunt", "LOTO5"),
    ]},
    # New Jersey (8 lotteries)
    {"state_code": "NJ", "state_name": "New Jersey", "lotteries": [
        ("NJ Pick 3 Midday", "PICK3"), ("NJ Pick 3 Evening", "PICK3"),
        ("NJ Pick 4 Midday", "PICK4"), ("NJ Pick 4 Evening", "PICK4"),
        ("NJ Jersey Cash 5", "LOTO5"), ("NJ Pick 6", "LOTO6"),
        ("NJ Cash Pop", "BORLETTE"), ("NJ 5 Card Cash", "BORLETTE"),
    ]},
    # Illinois (8 lotteries)
    {"state_code": "IL", "state_name": "Illinois", "lotteries": [
        ("IL Pick 3 Midday", "PICK3"), ("IL Pick 3 Evening", "PICK3"),
        ("IL Pick 4 Midday", "PICK4"), ("IL Pick 4 Evening", "PICK4"),
        ("IL Lucky Day Lotto Midday", "LOTO5"), ("IL Lucky Day Lotto Evening", "LOTO5"),
        ("IL Lotto", "LOTO6"), ("IL Pick 5", "PICK5"),
    ]},
    # Ohio (8 lotteries)
    {"state_code": "OH", "state_name": "Ohio", "lotteries": [
        ("OH Pick 3 Midday", "PICK3"), ("OH Pick 3 Evening", "PICK3"),
        ("OH Pick 4 Midday", "PICK4"), ("OH Pick 4 Evening", "PICK4"),
        ("OH Pick 5 Midday", "PICK5"), ("OH Pick 5 Evening", "PICK5"),
        ("OH Rolling Cash 5", "LOTO5"), ("OH Classic Lotto", "LOTO6"),
    ]},
    # Michigan (8 lotteries)
    {"state_code": "MI", "state_name": "Michigan", "lotteries": [
        ("MI Daily 3 Midday", "PICK3"), ("MI Daily 3 Evening", "PICK3"),
        ("MI Daily 4 Midday", "PICK4"), ("MI Daily 4 Evening", "PICK4"),
        ("MI Fantasy 5", "LOTO5"), ("MI Lotto 47", "LOTO6"),
        ("MI Keno", "KENO"), ("MI Club Keno", "KENO"),
    ]},
    # Virginia (8 lotteries)
    {"state_code": "VA", "state_name": "Virginia", "lotteries": [
        ("VA Pick 3 Day", "PICK3"), ("VA Pick 3 Night", "PICK3"),
        ("VA Pick 4 Day", "PICK4"), ("VA Pick 4 Night", "PICK4"),
        ("VA Cash 5", "LOTO5"), ("VA Bank a Million", "LOTO6"),
        ("VA Cash Pop", "BORLETTE"), ("VA Pick 5 Night", "PICK5"),
    ]},
    # North Carolina (8 lotteries)
    {"state_code": "NC", "state_name": "North Carolina", "lotteries": [
        ("NC Pick 3 Day", "PICK3"), ("NC Pick 3 Evening", "PICK3"),
        ("NC Pick 4 Day", "PICK4"), ("NC Pick 4 Evening", "PICK4"),
        ("NC Cash 5", "LOTO5"), ("NC Lucky for Life", "LOTO5"),
        ("NC Carolina Pick 3", "PICK3"), ("NC Carolina Pick 4", "PICK4"),
    ]},
    # Massachusetts (8 lotteries)
    {"state_code": "MA", "state_name": "Massachusetts", "lotteries": [
        ("MA Numbers Midday", "PICK3"), ("MA Numbers Evening", "PICK3"),
        ("MA Mass Cash", "LOTO5"), ("MA Megabucks Doubler", "LOTO6"),
        ("MA The Numbers Game Midday", "PICK4"), ("MA The Numbers Game Evening", "PICK4"),
        ("MA Lucky for Life", "LOTO5"), ("MA All or Nothing", "BORLETTE"),
    ]},
    # Maryland (8 lotteries)
    {"state_code": "MD", "state_name": "Maryland", "lotteries": [
        ("MD Pick 3 Midday", "PICK3"), ("MD Pick 3 Evening", "PICK3"),
        ("MD Pick 4 Midday", "PICK4"), ("MD Pick 4 Evening", "PICK4"),
        ("MD Pick 5 Midday", "PICK5"), ("MD Pick 5 Evening", "PICK5"),
        ("MD Bonus Match 5", "LOTO5"), ("MD Multi-Match", "LOTO6"),
    ]},
    # Connecticut (6 lotteries)
    {"state_code": "CT", "state_name": "Connecticut", "lotteries": [
        ("CT Play 3 Day", "PICK3"), ("CT Play 3 Night", "PICK3"),
        ("CT Play 4 Day", "PICK4"), ("CT Play 4 Night", "PICK4"),
        ("CT Cash 5", "LOTO5"), ("CT Lotto!", "LOTO6"),
    ]},
    # South Carolina (6 lotteries)
    {"state_code": "SC", "state_name": "South Carolina", "lotteries": [
        ("SC Pick 3 Midday", "PICK3"), ("SC Pick 3 Evening", "PICK3"),
        ("SC Pick 4 Midday", "PICK4"), ("SC Pick 4 Evening", "PICK4"),
        ("SC Palmetto Cash 5", "LOTO5"), ("SC Pick 5", "PICK5"),
    ]},
    # Tennessee (6 lotteries)
    {"state_code": "TN", "state_name": "Tennessee", "lotteries": [
        ("TN Cash 3 Midday", "PICK3"), ("TN Cash 3 Evening", "PICK3"),
        ("TN Cash 4 Midday", "PICK4"), ("TN Cash 4 Evening", "PICK4"),
        ("TN Tennessee Cash", "LOTO5"), ("TN Daily Tennessee Jackpot", "LOTO6"),
    ]},
    # Arizona (6 lotteries)
    {"state_code": "AZ", "state_name": "Arizona", "lotteries": [
        ("AZ Pick 3 Day", "PICK3"), ("AZ Pick 3 Night", "PICK3"),
        ("AZ Fantasy 5", "LOTO5"), ("AZ The Pick", "LOTO6"),
        ("AZ Triple Twist", "BORLETTE"), ("AZ Pick", "PICK4"),
    ]},
    # Colorado (6 lotteries)
    {"state_code": "CO", "state_name": "Colorado", "lotteries": [
        ("CO Pick 3", "PICK3"), ("CO Cash 5", "LOTO5"),
        ("CO Colorado Lotto+", "LOTO6"), ("CO Lucky for Life", "LOTO5"),
        ("CO Pick 4", "PICK4"), ("CO Cash Pop", "BORLETTE"),
    ]},
    # Louisiana (6 lotteries)
    {"state_code": "LA", "state_name": "Louisiana", "lotteries": [
        ("LA Pick 3", "PICK3"), ("LA Pick 4", "PICK4"),
        ("LA Pick 5", "PICK5"), ("LA Lotto", "LOTO6"),
        ("LA Easy 5", "LOTO5"), ("LA Cash Quest", "BORLETTE"),
    ]},
    # Missouri (6 lotteries)
    {"state_code": "MO", "state_name": "Missouri", "lotteries": [
        ("MO Pick 3 Midday", "PICK3"), ("MO Pick 3 Evening", "PICK3"),
        ("MO Pick 4 Midday", "PICK4"), ("MO Pick 4 Evening", "PICK4"),
        ("MO Show Me Cash", "LOTO5"), ("MO Lotto", "LOTO6"),
    ]},
    # Indiana (6 lotteries)
    {"state_code": "IN", "state_name": "Indiana", "lotteries": [
        ("IN Daily 3 Midday", "PICK3"), ("IN Daily 3 Evening", "PICK3"),
        ("IN Daily 4 Midday", "PICK4"), ("IN Daily 4 Evening", "PICK4"),
        ("IN Cash 5", "LOTO5"), ("IN Hoosier Lotto", "LOTO6"),
    ]},
    # Kentucky (6 lotteries)
    {"state_code": "KY", "state_name": "Kentucky", "lotteries": [
        ("KY Pick 3 Midday", "PICK3"), ("KY Pick 3 Evening", "PICK3"),
        ("KY Pick 4 Midday", "PICK4"), ("KY Pick 4 Evening", "PICK4"),
        ("KY Cash Ball", "LOTO5"), ("KY Kentucky 5", "PICK5"),
    ]},
    # Wisconsin (6 lotteries)
    {"state_code": "WI", "state_name": "Wisconsin", "lotteries": [
        ("WI Pick 3", "PICK3"), ("WI Pick 4", "PICK4"),
        ("WI Badger 5", "LOTO5"), ("WI SuperCash!", "LOTO6"),
        ("WI All or Nothing", "BORLETTE"), ("WI Daily Pick 4", "PICK4"),
    ]},
    # Arkansas (4 lotteries)
    {"state_code": "AR", "state_name": "Arkansas", "lotteries": [
        ("AR Cash 3 Midday", "PICK3"), ("AR Cash 3 Evening", "PICK3"),
        ("AR Cash 4 Midday", "PICK4"), ("AR Cash 4 Evening", "PICK4"),
    ]},
    # Kansas (4 lotteries)
    {"state_code": "KS", "state_name": "Kansas", "lotteries": [
        ("KS Pick 3", "PICK3"), ("KS 2by2", "PICK4"),
        ("KS Super Kansas Cash", "LOTO5"), ("KS Mega Money", "LOTO6"),
    ]},
    # Iowa (4 lotteries)
    {"state_code": "IA", "state_name": "Iowa", "lotteries": [
        ("IA Pick 3 Midday", "PICK3"), ("IA Pick 3 Evening", "PICK3"),
        ("IA Pick 4 Midday", "PICK4"), ("IA Pick 4 Evening", "PICK4"),
    ]},
    # District of Columbia (4 lotteries)
    {"state_code": "DC", "state_name": "District of Columbia", "lotteries": [
        ("DC DC-3 Midday", "PICK3"), ("DC DC-3 Evening", "PICK3"),
        ("DC DC-4 Midday", "PICK4"), ("DC DC-4 Evening", "PICK4"),
    ]},
    # West Virginia (4 lotteries)
    {"state_code": "WV", "state_name": "West Virginia", "lotteries": [
        ("WV Daily 3", "PICK3"), ("WV Daily 4", "PICK4"),
        ("WV Cash 25", "LOTO5"), ("WV Keno", "KENO"),
    ]},
    # Delaware (4 lotteries)
    {"state_code": "DE", "state_name": "Delaware", "lotteries": [
        ("DE Play 3 Day", "PICK3"), ("DE Play 3 Night", "PICK3"),
        ("DE Play 4 Day", "PICK4"), ("DE Play 4 Night", "PICK4"),
    ]},
    # Maine (2 lotteries)
    {"state_code": "ME", "state_name": "Maine", "lotteries": [
        ("ME Pick 3", "PICK3"), ("ME Pick 4", "PICK4"),
    ]},
    # New Hampshire (2 lotteries)
    {"state_code": "NH", "state_name": "New Hampshire", "lotteries": [
        ("NH Pick 3", "PICK3"), ("NH Pick 4", "PICK4"),
    ]},
    # Rhode Island (2 lotteries)
    {"state_code": "RI", "state_name": "Rhode Island", "lotteries": [
        ("RI The Numbers Midday", "PICK3"), ("RI The Numbers Evening", "PICK3"),
    ]},
    # Vermont (2 lotteries)  
    {"state_code": "VT", "state_name": "Vermont", "lotteries": [
        ("VT Tri-State Pick 3", "PICK3"), ("VT Tri-State Pick 4", "PICK4"),
    ]},
]

# Caribbean/Haiti Lotteries
CARIBBEAN_LOTTERIES = [
    {"state_code": "HT", "state_name": "Haiti", "country": "Haiti", "lotteries": [
        ("Haiti Borlette Midi", "BORLETTE"), ("Haiti Borlette Soir", "BORLETTE"),
        ("Haiti Loto 3 Midi", "LOTO3"), ("Haiti Loto 3 Soir", "LOTO3"),
        ("Haiti Loto 4 Midi", "LOTO4"), ("Haiti Loto 4 Soir", "LOTO4"),
        ("Haiti Mariage Midi", "MARIAGE"), ("Haiti Mariage Soir", "MARIAGE"),
        ("Haiti Loto 5 Midi", "LOTO5"), ("Haiti Loto 5 Soir", "LOTO5"),
    ]},
    {"state_code": "DR", "state_name": "Dominican Republic", "country": "Dominican Republic", "lotteries": [
        ("DR Loteria Real", "BORLETTE"), ("DR Loto Pool", "LOTO4"),
        ("DR Quiniela Pale", "MARIAGE"), ("DR Loto Real", "LOTO5"),
    ]},
]

async def seed_database():
    """Seed the database with all initial data"""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.lottolab
    
    print("=" * 60)
    print("LOTTOLAB SaaS - DATABASE SEEDING")
    print("=" * 60)
    
    now = get_current_timestamp()
    
    # 1. SEED MASTER LOTTERIES (190)
    print("\n🎰 Seeding Master Lotteries...")
    lottery_count = 0
    
    for state_data in US_STATES_LOTTERIES:
        for lottery_name, game_type in state_data["lotteries"]:
            lottery_id = generate_id("lot_")
            lottery_doc = {
                "lottery_id": lottery_id,
                "lottery_name": lottery_name,
                "state_code": state_data["state_code"],
                "state_name": state_data["state_name"],
                "country": "USA",
                "game_type": game_type,
                "category": "STANDARD",
                "default_draw_times": ["12:00", "19:00"] if "Midday" in lottery_name or "Day" in lottery_name else ["19:00", "21:00"],
                "description": f"{lottery_name} - {state_data['state_name']}",
                "is_active_global": True,
                "created_at": now,
                "updated_at": now
            }
            await db.master_lotteries.insert_one(lottery_doc)
            lottery_count += 1
    
    for state_data in CARIBBEAN_LOTTERIES:
        for lottery_name, game_type in state_data["lotteries"]:
            lottery_id = generate_id("lot_")
            lottery_doc = {
                "lottery_id": lottery_id,
                "lottery_name": lottery_name,
                "state_code": state_data["state_code"],
                "state_name": state_data["state_name"],
                "country": state_data.get("country", "Haiti"),
                "game_type": game_type,
                "category": "PREMIUM" if "Haiti" in lottery_name else "STANDARD",
                "default_draw_times": ["12:00", "19:00"] if "Midi" in lottery_name else ["19:00", "21:00"],
                "description": f"{lottery_name} - {state_data['state_name']}",
                "is_active_global": True,
                "created_at": now,
                "updated_at": now
            }
            await db.master_lotteries.insert_one(lottery_doc)
            lottery_count += 1
    
    print(f"   ✅ Created {lottery_count} master lotteries")
    
    # 2. SEED PLANS
    print("\n💳 Seeding Plans...")
    plans = [
        {
            "plan_id": generate_id("plan_"),
            "name": "Starter",
            "price": 0,
            "max_agents": 3,
            "max_tickets_per_day": 500,
            "max_lotteries": 20,
            "max_pos_devices": 3,
            "features": ["basic_reports", "email_support"],
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        },
        {
            "plan_id": generate_id("plan_"),
            "name": "Basic",
            "price": 99,
            "max_agents": 10,
            "max_tickets_per_day": 2000,
            "max_lotteries": 50,
            "max_pos_devices": 10,
            "features": ["basic_reports", "email_support", "priority_support"],
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        },
        {
            "plan_id": generate_id("plan_"),
            "name": "Professional",
            "price": 299,
            "max_agents": 50,
            "max_tickets_per_day": 10000,
            "max_lotteries": 100,
            "max_pos_devices": 50,
            "features": ["advanced_reports", "api_access", "priority_support", "custom_branding"],
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        },
        {
            "plan_id": generate_id("plan_"),
            "name": "Enterprise",
            "price": 999,
            "max_agents": 500,
            "max_tickets_per_day": 100000,
            "max_lotteries": 190,
            "max_pos_devices": 500,
            "features": ["advanced_reports", "api_access", "priority_support", "custom_branding", "dedicated_support", "white_label"],
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        },
    ]
    
    for plan in plans:
        await db.plans.insert_one(plan)
    print(f"   ✅ Created {len(plans)} plans")
    
    # 3. SEED SUPER ADMIN
    print("\n👑 Seeding Super Admin...")
    super_admin = await db.users.find_one({"email": "jefferson@jmstudio.com"})
    if not super_admin:
        super_admin_doc = {
            "user_id": generate_id("user_"),
            "email": "jefferson@jmstudio.com",
            "password_hash": get_password_hash("JMStudio@2026!"),
            "name": "Jefferson Admin",
            "role": "SUPER_ADMIN",
            "company_id": None,
            "status": "ACTIVE",
            "permissions": ["super_admin"],
            "created_at": now,
            "updated_at": now
        }
        await db.users.insert_one(super_admin_doc)
        print("   ✅ Super Admin created: jefferson@jmstudio.com")
    else:
        print("   ⏭️ Super Admin already exists")
    
    # 4. SEED DEMO COMPANY WITH ADMIN
    print("\n🏢 Seeding Demo Company...")
    demo_company = await db.companies.find_one({"slug": "lotopam-demo"})
    if not demo_company:
        company_id = generate_id("comp_")
        admin_id = generate_id("user_")
        
        # Create company
        company_doc = {
            "company_id": company_id,
            "name": "LotoPam Demo",
            "slug": "lotopam-demo",
            "slogan": "La chance vous sourit!",
            "contact_email": "admin@lotopam.com",
            "timezone": "America/Port-au-Prince",
            "currency": "HTG",
            "default_commission_rate": 10.0,
            "max_agents": 50,
            "max_daily_sales": 1000000.0,
            "plan": "Professional",
            "status": "ACTIVE",
            "license_start": now,
            "license_end": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
            "agents_count": 0,
            "tickets_today": 0,
            "total_sales": 0.0,
            "is_online": False,
            "created_at": now,
            "updated_at": now
        }
        await db.companies.insert_one(company_doc)
        
        # Create admin
        admin_doc = {
            "user_id": admin_id,
            "email": "admin@lotopam.com",
            "password_hash": get_password_hash("Admin123!"),
            "name": "Admin LotoPam",
            "role": "COMPANY_ADMIN",
            "company_id": company_id,
            "status": "ACTIVE",
            "permissions": ["full_access"],
            "created_at": now,
            "updated_at": now
        }
        await db.users.insert_one(admin_doc)
        
        # Link all lotteries to this company
        master_lotteries = await db.master_lotteries.find(
            {"is_active_global": True},
            {"_id": 0, "lottery_id": 1, "lottery_name": 1, "state_code": 1}
        ).to_list(500)
        
        for lottery in master_lotteries:
            cl_doc = {
                "id": generate_id("cl_"),
                "company_id": company_id,
                "lottery_id": lottery["lottery_id"],
                "lottery_name": lottery.get("lottery_name"),
                "state_code": lottery.get("state_code"),
                "is_enabled": True,
                "disabled_by_super_admin": False,
                "created_at": now,
                "updated_at": now
            }
            await db.company_lotteries.insert_one(cl_doc)
        
        # Create company config
        config_doc = {
            "config_id": generate_id("config_"),
            "company_id": company_id,
            "min_bet_amount": 10.0,
            "max_bet_amount": 10000.0,
            "max_bet_per_number": 5000.0,
            "max_bet_per_agent": 50000.0,
            "agent_commission_percent": 10.0,
            "stop_sales_before_draw_minutes": 5,
            "allow_ticket_void": True,
            "void_window_minutes": 5,
            "auto_print_ticket": True,
            "receipt_header": "LotoPam Demo",
            "receipt_footer": "Merci et bonne chance!",
            "created_at": now,
            "updated_at": now
        }
        await db.company_configurations.insert_one(config_doc)
        
        # Create config version
        await db.company_config_versions.insert_one({
            "company_id": company_id,
            "version": 1,
            "last_updated_at": now
        })
        
        print(f"   ✅ Demo Company created: LotoPam Demo")
        print(f"      Admin: admin@lotopam.com / Admin123!")
        print(f"      Lotteries linked: {len(master_lotteries)}")
    else:
        print("   ⏭️ Demo Company already exists")
    
    # 5. SEED GLOBAL SCHEDULES
    print("\n📅 Seeding Global Schedules...")
    schedules_count = 0
    
    # Get Haiti lotteries for schedules
    haiti_lotteries = await db.master_lotteries.find(
        {"state_code": "HT"},
        {"_id": 0, "lottery_id": 1, "lottery_name": 1}
    ).to_list(20)
    
    for lottery in haiti_lotteries:
        # Midday schedule
        if "Midi" in lottery["lottery_name"]:
            schedule_doc = {
                "schedule_id": generate_id("sched_"),
                "lottery_id": lottery["lottery_id"],
                "lottery_name": lottery["lottery_name"],
                "draw_name": "Midi",
                "days_of_week": [],  # All days
                "open_time": "08:00",
                "close_time": "12:55",
                "draw_time": "13:00",
                "stop_sales_before_minutes": 5,
                "is_active": True,
                "created_by": "system",
                "created_at": now,
                "updated_at": now
            }
            await db.global_schedules.insert_one(schedule_doc)
            schedules_count += 1
        # Evening schedule
        elif "Soir" in lottery["lottery_name"]:
            schedule_doc = {
                "schedule_id": generate_id("sched_"),
                "lottery_id": lottery["lottery_id"],
                "lottery_name": lottery["lottery_name"],
                "draw_name": "Soir",
                "days_of_week": [],  # All days
                "open_time": "14:00",
                "close_time": "20:55",
                "draw_time": "21:00",
                "stop_sales_before_minutes": 5,
                "is_active": True,
                "created_by": "system",
                "created_at": now,
                "updated_at": now
            }
            await db.global_schedules.insert_one(schedule_doc)
            schedules_count += 1
    
    print(f"   ✅ Created {schedules_count} global schedules")
    
    # 6. CREATE INDEXES
    print("\n📑 Creating indexes...")
    await db.master_lotteries.create_index("lottery_id", unique=True)
    await db.master_lotteries.create_index("state_code")
    await db.master_lotteries.create_index("is_active_global")
    
    await db.company_lotteries.create_index([("company_id", 1), ("lottery_id", 1)], unique=True)
    await db.company_lotteries.create_index("company_id")
    
    await db.global_schedules.create_index("schedule_id", unique=True)
    await db.global_schedules.create_index("lottery_id")
    
    await db.users.create_index("email", unique=True)
    await db.users.create_index("company_id")
    await db.users.create_index("role")
    
    await db.companies.create_index("company_id", unique=True)
    await db.companies.create_index("slug", unique=True)
    
    print("   ✅ Indexes created")
    
    # FINAL COUNT
    print("\n" + "=" * 60)
    print("SEEDING COMPLETE - FINAL COUNTS")
    print("=" * 60)
    
    master_count = await db.master_lotteries.count_documents({})
    company_count = await db.companies.count_documents({})
    user_count = await db.users.count_documents({})
    schedule_count = await db.global_schedules.count_documents({})
    plan_count = await db.plans.count_documents({})
    
    print(f"\n🎰 Master Lotteries: {master_count}")
    print(f"🏢 Companies: {company_count}")
    print(f"👥 Users: {user_count}")
    print(f"📅 Global Schedules: {schedule_count}")
    print(f"💳 Plans: {plan_count}")
    
    client.close()
    print("\n✅ Database seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed_database())
