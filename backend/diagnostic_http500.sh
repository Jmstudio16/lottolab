#!/bin/bash
# =====================================================================
# LOTTOLAB - DIAGNOSTIC DU SERVEUR 500
# =====================================================================
# Exécutez ce script sur votre serveur production pour diagnostiquer
# pourquoi vous voyez HTTP 500 sur le login

echo "=================================================="
echo "  DIAGNOSTIC - HTTP 500 ERROR"
echo "=================================================="
echo ""

# 1. Vérifier si le backend tourne
echo "1️⃣  Vérifier si le backend est en cours d'exécution..."
echo "---"

if command -v pm2 &> /dev/null; then
    echo "Processus PM2:"
    pm2 list | grep -i lottolab || echo "  ⚠️  Aucun processus lottolab trouvé dans PM2"
    echo ""
    echo "Logs PM2:"
    pm2 logs lottolab-backend --lines 30 2>/dev/null || echo "  ⚠️  Aucun log PM2"
else
    echo "Chercher le processus uvicorn:"
    ps aux | grep -i "uvicorn" | grep -v grep || echo "  ⚠️  Aucun processus uvicorn trouvé!"
fi
echo ""

# 2. Vérifier si le port 8001 écoute
echo "2️⃣  Vérifier si le port 8001 est actif..."
echo "---"
netstat -tlnp 2>/dev/null | grep 8001 || ss -tlnp 2>/dev/null | grep 8001 || echo "  ⚠️  Port 8001 n'écoute pas"
echo ""

# 3. Tester la connexion locale
echo "3️⃣  Tester la connexion locale au backend..."
echo "---"
curl -s http://localhost:8001/api/health | head -c 200
echo ""
echo ""

# 4. Vérifier les variables d'environnement
echo "4️⃣  Vérifier les variables d'environnement..."
echo "---"
cd /app/backend 2>/dev/null || cd /var/www/app/backend 2>/dev/null || echo "⚠️  Répertoire /app/backend non trouvé"

if [ -f .env ]; then
    echo "✓ Fichier .env trouvé"
    echo "  MONGO_URL est défini: $(grep -c 'MONGO_URL' .env) fois"
    echo "  JWT_SECRET_KEY est défini: $(grep -c 'JWT_SECRET_KEY' .env) fois"
else
    echo "✗ Fichier .env NOT found"
fi
echo ""

# 5. Vérifier la connectivité MongoDB
echo "5️⃣  Vérifier la connectivité MongoDB..."
echo "---"
python3 << 'PYEOF'
import os
import sys
from pathlib import Path

try:
    # Charger .env
    from dotenv import load_dotenv
    Path('/app/backend/.env').exists() and load_dotenv('/app/backend/.env')
    
    mongo_url = os.environ.get('MONGO_URL')
    if not mongo_url:
        print("✗ MONGO_URL non défini")
        sys.exit(1)
    
    print(f"✓ MONGO_URL défini: {mongo_url[:50]}...")
    
    # Essayer une connexion
    print("Tentative de connexion à MongoDB...")
    from motor.motor_asyncio import AsyncIOMotorClient
    import asyncio
    
    async def test_mongo():
        try:
            client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=3000)
            await client.server_info()
            print("✓ MongoDB connexion réussie!")
            return True
        except Exception as e:
            print(f"✗ MongoDB connexion échouée: {str(e)[:100]}")
            return False
    
    result = asyncio.run(test_mongo())
    sys.exit(0 if result else 1)
    
except Exception as e:
    print(f"✗ Erreur: {e}")
    sys.exit(1)
PYEOF

echo ""

# 6. Vérifier les logs système
echo "6️⃣  Logs du système..."
echo "---"
echo "Vérifier avec: journalctl -u lottolab -n 50"
echo "Ou: tail -f /var/log/lottolab.log"
echo ""

echo "=================================================="
echo "RÉSUMÉ DES VÉRIFICATIONS"
echo "=================================================="
echo ""
echo "Si vous voyez HTTP 500, c'est généralement:"
echo ""
echo "❌ Backend n'est PAS en cours d'exécution"
echo "   → Solution: Démarrer avec PM2"
echo "      pm2 start 'uvicorn server:app --host 0.0.0.0 --port 8001' --name lottolab-backend"
echo ""
echo "❌ Port 8001 n'écoute pas"
echo "   → Solution: Vérifier les permissions et ports"
echo ""
echo "❌ Erreur de connexion MongoDB"
echo "   → Solutions possibles:"
echo "      1. Vérifier MONGO_URL dans .env (pas localhost)"
echo "      2. Serveur doit avoir accès Internet (DNS + port 27017)"
echo "      3. Vérifier les identifiants MongoDB Atlas"
echo "      4. Vérifier la whitelist IP dans MongoDB Atlas"
echo ""
echo "❌ JWT_SECRET_KEY est un placeholder"
echo "   → Solution: Mettre à jour JWT_SECRET_KEY dans .env"
echo ""
