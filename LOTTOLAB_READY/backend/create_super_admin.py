"""
Script de création du Super Admin pour LOTTOLAB Production
Exécuter une seule fois après le déploiement initial
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone
from auth import get_password_hash
from utils import generate_id
import getpass

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    print("❌ Erreur: MONGO_URL non configuré dans .env")
    exit(1)

client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'lottolab_production')]


async def create_super_admin():
    print("=" * 60)
    print("  LOTTOLAB - Création du Super Admin de Production")
    print("=" * 60)
    print()
    
    # Vérifier si un Super Admin existe déjà
    existing = await db.users.find_one({"role": "SUPER_ADMIN"})
    if existing:
        print(f"⚠️  Un Super Admin existe déjà: {existing['email']}")
        confirm = input("Voulez-vous en créer un autre? (oui/non): ").strip().lower()
        if confirm != "oui":
            print("Opération annulée.")
            return
    
    print("\nEntrez les informations du Super Admin:\n")
    
    # Collecter les informations
    name = input("Nom complet: ").strip()
    while not name:
        print("Le nom est obligatoire.")
        name = input("Nom complet: ").strip()
    
    email = input("Email: ").strip().lower()
    while not email or "@" not in email:
        print("Email invalide.")
        email = input("Email: ").strip().lower()
    
    # Vérifier si l'email existe
    existing_email = await db.users.find_one({"email": email})
    if existing_email:
        print(f"❌ L'email {email} est déjà utilisé.")
        return
    
    password = getpass.getpass("Mot de passe (min 8 caractères): ")
    while len(password) < 8:
        print("Le mot de passe doit avoir au moins 8 caractères.")
        password = getpass.getpass("Mot de passe (min 8 caractères): ")
    
    confirm_password = getpass.getpass("Confirmer le mot de passe: ")
    if password != confirm_password:
        print("❌ Les mots de passe ne correspondent pas.")
        return
    
    # Créer le Super Admin
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "user_id": generate_id("user_"),
        "email": email,
        "password_hash": get_password_hash(password),
        "name": name,
        "role": "SUPER_ADMIN",
        "company_id": None,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now,
        "last_login": None
    }
    
    await db.users.insert_one(user_doc)
    
    print()
    print("=" * 60)
    print("  ✅ SUPER ADMIN CRÉÉ AVEC SUCCÈS")
    print("=" * 60)
    print(f"  Email: {email}")
    print(f"  Nom: {name}")
    print(f"  User ID: {user_doc['user_id']}")
    print("=" * 60)
    print()
    print("⚠️  IMPORTANT: Conservez ces informations en lieu sûr!")
    print()
    
    client.close()


if __name__ == "__main__":
    asyncio.run(create_super_admin())
