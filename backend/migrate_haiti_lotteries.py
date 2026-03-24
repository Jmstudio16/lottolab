#!/usr/bin/env python3
"""
=============================================================================
SCRIPT DE MIGRATION POUR LOTTOLAB PRODUCTION
=============================================================================

Ce script initialise les 26 loteries Haiti dans la base de données de production.
Il est conçu pour être exécuté APRÈS le déploiement sur lottolab.tech.

UTILISATION:
-----------
1. Connectez-vous à votre serveur de production
2. Naviguez vers le dossier backend
3. Exécutez: python3 migrate_haiti_lotteries.py

OU

Utilisez directement l'interface Super Admin:
1. Connectez-vous en tant que Super Admin sur lottolab.tech
2. Allez dans Settings
3. Cliquez sur "Initialiser Loteries Haiti"

Ce script est IDEMPOTENT - vous pouvez l'exécuter plusieurs fois sans problème.
=============================================================================
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

# Configuration
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'lottolab')

# Haiti lottery definitions
HAITI_LOTTERIES = [
    # Core Haiti Lotteries
    {"name": "Haiti Borlette Midi", "draw_name": "Midi", "draw_time": "12:30"},
    {"name": "Haiti Borlette Soir", "draw_name": "Soir", "draw_time": "19:30"},
    {"name": "Haiti Loto 3 Midi", "draw_name": "Midi", "draw_time": "12:30"},
    {"name": "Haiti Loto 3 Soir", "draw_name": "Soir", "draw_time": "19:30"},
    {"name": "Haiti Loto 4 Midi", "draw_name": "Midi", "draw_time": "12:30"},
    {"name": "Haiti Loto 4 Soir", "draw_name": "Soir", "draw_time": "19:30"},
    {"name": "Haiti Loto 5 Midi", "draw_name": "Midi", "draw_time": "12:30"},
    {"name": "Haiti Loto 5 Soir", "draw_name": "Soir", "draw_time": "19:30"},
    {"name": "Haiti Mariage Midi", "draw_name": "Midi", "draw_time": "12:30"},
    {"name": "Haiti Mariage Soir", "draw_name": "Soir", "draw_time": "19:30"},
    # State lotteries with Haiti flag
    {"name": "Tennessee Matin", "draw_name": "Matin", "draw_time": "10:30"},
    {"name": "Tennessee Midi", "draw_name": "Midi", "draw_time": "12:30"},
    {"name": "Tennessee Soir", "draw_name": "Soir", "draw_time": "19:30"},
    {"name": "Texas Matin", "draw_name": "Matin", "draw_time": "10:30"},
    {"name": "Texas Midi", "draw_name": "Midi", "draw_time": "12:30"},
    {"name": "Texas Soir", "draw_name": "Soir", "draw_time": "19:30"},
    {"name": "Texas Nuit", "draw_name": "Nuit", "draw_time": "22:30"},
    {"name": "Georgia Midi", "draw_name": "Midi", "draw_time": "12:30"},
    {"name": "Georgia Soir", "draw_name": "Soir", "draw_time": "19:30"},
    {"name": "Georgia Nuit", "draw_name": "Nuit", "draw_time": "22:30"},
    {"name": "Florida Midi", "draw_name": "Midi", "draw_time": "12:30"},
    {"name": "Florida Soir", "draw_name": "Soir", "draw_time": "19:30"},
    {"name": "New York Midi", "draw_name": "Midi", "draw_time": "12:30"},
    {"name": "New York Soir", "draw_name": "Soir", "draw_time": "19:30"},
    # Rapid lotteries
    {"name": "Plop Plop", "draw_name": "Continu", "draw_time": "00:00", "is_rapid": True},
    {"name": "Loto Rapid", "draw_name": "Continu", "draw_time": "00:00", "is_rapid": True},
]

async def migrate_haiti_lotteries():
    """Main migration function"""
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
    except ImportError:
        print("❌ Erreur: motor n'est pas installé.")
        print("   Exécutez: pip install motor")
        sys.exit(1)
    
    print("="*60)
    print("MIGRATION LOTERIES HAITI - LOTTOLAB")
    print("="*60)
    print(f"\nConnexion à: {MONGO_URL[:30]}...")
    print(f"Base de données: {DB_NAME}")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Test connection
    try:
        await db.command("ping")
        print("✅ Connexion à MongoDB réussie!\n")
    except Exception as e:
        print(f"❌ Erreur de connexion à MongoDB: {e}")
        sys.exit(1)
    
    created_count = 0
    updated_count = 0
    
    for lottery_def in HAITI_LOTTERIES:
        lottery_name = lottery_def["name"]
        print(f"📌 Traitement: {lottery_name}...", end=" ")
        
        # Check if lottery exists in master_lotteries
        existing_lottery = await db.master_lotteries.find_one(
            {"lottery_name": lottery_name},
            {"_id": 0, "lottery_id": 1}
        )
        
        if not existing_lottery:
            # Create the lottery in master_lotteries
            lottery_id = f"lot_haiti_{lottery_name.lower().replace(' ', '_')}_{int(datetime.now().timestamp())}"
            new_lottery = {
                "lottery_id": lottery_id,
                "lottery_name": lottery_name,
                "state_code": "HT",
                "flag_type": "HAITI",
                "is_active_global": True,
                "sales_open_offset_minutes": 240,
                "sales_close_offset_minutes": 5,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.master_lotteries.insert_one(new_lottery)
            print("CRÉÉ", end=" ")
            created_count += 1
        else:
            lottery_id = existing_lottery["lottery_id"]
            # Update flag_type to HAITI
            await db.master_lotteries.update_one(
                {"lottery_id": lottery_id},
                {"$set": {"flag_type": "HAITI", "state_code": "HT", "is_active_global": True}}
            )
            print("mis à jour", end=" ")
        
        # Also update global_lotteries
        await db.global_lotteries.update_one(
            {"lottery_name": lottery_name},
            {"$set": {"flag_type": "HAITI", "state_code": "HT", "is_active": True}},
            upsert=False
        )
        
        # Update company_lotteries
        result = await db.company_lotteries.update_many(
            {"lottery_name": lottery_name},
            {"$set": {"flag_type": "HAITI", "enabled": True}}
        )
        
        # Get lottery_id for schedule
        lottery = await db.master_lotteries.find_one(
            {"lottery_name": lottery_name},
            {"_id": 0, "lottery_id": 1}
        )
        
        if lottery:
            lottery_id = lottery["lottery_id"]
            
            # Check if schedule exists
            existing_schedule = await db.global_schedules.find_one(
                {"lottery_id": lottery_id}
            )
            
            is_rapid = lottery_def.get("is_rapid", False)
            
            schedule_data = {
                "lottery_id": lottery_id,
                "lottery_name": lottery_name,
                "draw_name": lottery_def["draw_name"],
                "open_time": "00:00" if is_rapid else "06:00",
                "close_time": "23:59" if is_rapid else "23:00",
                "draw_time": lottery_def["draw_time"],
                "days_of_week": [0, 1, 2, 3, 4, 5, 6],
                "is_active": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if existing_schedule:
                await db.global_schedules.update_one(
                    {"lottery_id": lottery_id},
                    {"$set": schedule_data}
                )
            else:
                schedule_data["schedule_id"] = f"sched_{lottery_id}"
                schedule_data["created_at"] = datetime.now(timezone.utc).isoformat()
                await db.global_schedules.insert_one(schedule_data)
                created_count += 1
        
        print("✅")
        updated_count += 1
    
    # Print summary
    print("\n" + "="*60)
    print("RÉSUMÉ DE LA MIGRATION")
    print("="*60)
    
    # Count totals
    haiti_master = await db.master_lotteries.count_documents({"flag_type": "HAITI"})
    haiti_global = await db.global_lotteries.count_documents({"flag_type": "HAITI"})
    haiti_schedules = await db.global_schedules.count_documents({
        "lottery_name": {"$regex": "^(Haiti|Tennessee|Texas|Georgia|Florida|New York|Plop|Loto Rapid)", "$options": "i"}
    })
    
    print(f"\n✅ Loteries Haiti dans master_lotteries: {haiti_master}")
    print(f"✅ Loteries Haiti dans global_lotteries: {haiti_global}")
    print(f"✅ Schedules Haiti: {haiti_schedules}")
    print(f"\n🎉 Migration terminée avec succès!")
    print(f"   - Créés: {created_count}")
    print(f"   - Mis à jour: {updated_count}")
    
    client.close()

if __name__ == "__main__":
    print("\n" + "="*60)
    print("       LOTTOLAB - SCRIPT DE MIGRATION PRODUCTION")
    print("="*60)
    
    # Check for --dry-run flag
    if "--help" in sys.argv:
        print(__doc__)
        sys.exit(0)
    
    asyncio.run(migrate_haiti_lotteries())
