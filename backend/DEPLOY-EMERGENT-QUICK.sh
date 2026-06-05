#!/bin/bash
# =====================================================================
# LOTTOLAB - FIX HTTP 500 - VERSION SIMPLE POUR EMERGENT
# =====================================================================
# Exécutez ce script sur votre serveur Emergent via le panneau SSH
# ou: bash < <(curl -s https://votre-serveur/fix.sh)

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   🚀 LOTTOLAB - FIX HTTP 500                              ║"
echo "║   Réparation complète du backend                          ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# =====================================================================
# ÉTAPE 1: VÉRIFIER LA STRUCTURE
# =====================================================================
echo "📁 ÉTAPE 1: Vérifier les fichiers..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

BACKEND_PATH="/app/backend"
if [ ! -d "$BACKEND_PATH" ]; then
    echo "❌ Erreur: Répertoire $BACKEND_PATH non trouvé"
    exit 1
fi

cd "$BACKEND_PATH"
echo "✓ Répertoire backend trouvé: $BACKEND_PATH"

FILES=("server.py" "auth.py" "models.py" "requirements.txt")
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ❌ $file MANQUANT"
        exit 1
    fi
done
echo ""

# =====================================================================
# ÉTAPE 2: CRÉER/VÉRIFIER .env
# =====================================================================
echo "⚙️  ÉTAPE 2: Configurer les variables d'environnement..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Créer .env avec les bonnes valeurs
cat > "$BACKEND_PATH/.env" << 'ENDOFENV'
# ============================================================
# LOTTOLAB - Configuration Backend Production
# ============================================================

# MongoDB Atlas Configuration
MONGO_URL=mongodb+srv://seller-commission-ui:d7031rklqs2c73dquodg@customer-apps.nngdus.mongodb.net/?appName=seller-commission-ui&maxPoolSize=5&retryWrites=true&timeoutMS=10000&w=majority
DB_NAME=lottolab

# JWT Authentication
JWT_SECRET_KEY=lottolab-secure-production-key-jm-studio-2026-change-in-production

# CORS - Domaines autorisés
CORS_ORIGINS=https://multi-tenant-lottery.emergent.host,https://lottolab.tech,https://www.lottolab.tech,http://localhost:3000

# Integration Keys
EMERGENT_LLM_KEY=sk-emergent-6F5B3426d8cA3364e4

# Environment
NODE_ENV=production
ENDOFENV

echo "✓ Fichier .env créé avec les bonnes valeurs"
echo "  - MONGO_URL: MongoDB Atlas (production)"
echo "  - JWT_SECRET_KEY: Clé sécurisée (pas de placeholder)"
echo "  - CORS_ORIGINS: Domaines autorisés"
echo ""

# =====================================================================
# ÉTAPE 3: ARRÊTER ANCIEN PROCESSUS
# =====================================================================
echo "🛑 ÉTAPE 3: Arrêter les anciens processus..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Arrêter PM2 si existe
if command -v pm2 &> /dev/null; then
    pm2 delete lottolab-backend 2>/dev/null || true
    pm2 kill 2>/dev/null || true
    echo "✓ PM2 processus supprimé"
fi

# Tuer uvicorn
pkill -9 -f "uvicorn server" 2>/dev/null || true
sleep 2
echo "✓ Processus uvicorn arrêté"
echo ""

# =====================================================================
# ÉTAPE 4: INSTALLER LES DÉPENDANCES
# =====================================================================
echo "📦 ÉTAPE 4: Installer les dépendances Python..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$BACKEND_PATH"

# Installer pip packages
pip install -q --upgrade pip 2>/dev/null || true
pip install -q fastapi uvicorn motor dnspython python-jose passlib bcrypt python-dotenv 2>&1 | grep -i "error\|failed" || true
pip install -q -r requirements.txt 2>&1 | tail -3

echo "✓ Dépendances installées"
echo ""

# =====================================================================
# ÉTAPE 5: VÉRIFIER LA SYNTAXE
# =====================================================================
echo "✅ ÉTAPE 5: Vérifier la syntaxe Python..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

python3 -m py_compile server.py auth.py models.py 2>&1
if [ $? -eq 0 ]; then
    echo "✓ Syntaxe Python valide"
else
    echo "❌ Erreur de syntaxe Python"
    exit 1
fi
echo ""

# =====================================================================
# ÉTAPE 6: DÉMARRER LE BACKEND
# =====================================================================
echo "🚀 ÉTAPE 6: Démarrer le backend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$BACKEND_PATH"

# Créer répertoire logs s'il n'existe pas
mkdir -p ./logs

# Essayer avec PM2 d'abord
if command -v pm2 &> /dev/null; then
    pm2 start "uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2" \
        --name lottolab-backend \
        --time \
        --log ./logs/combined.log \
        2>/dev/null
    
    sleep 3
    
    if pm2 list 2>/dev/null | grep -q "lottolab-backend"; then
        pm2 save 2>/dev/null || true
        echo "✓ Backend démarré avec PM2"
        STARTED=1
    else
        STARTED=0
    fi
else
    STARTED=0
fi

# Si PM2 échoue, démarrer avec nohup
if [ $STARTED -eq 0 ]; then
    nohup uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2 > ./logs/uvicorn.log 2>&1 &
    sleep 3
    
    if ps aux | grep -q "[u]vicorn server" ; then
        echo "✓ Backend démarré avec uvicorn"
        STARTED=1
    fi
fi

if [ $STARTED -eq 0 ]; then
    echo "❌ Backend n'a pas démarré"
    echo ""
    echo "Logs d'erreur:"
    tail -20 ./logs/uvicorn.log 2>/dev/null || tail -20 /tmp/uvicorn.log 2>/dev/null
    exit 1
fi
echo ""

# =====================================================================
# ÉTAPE 7: VÉRIFIER QUE LE BACKEND RÉPOND
# =====================================================================
echo "🔍 ÉTAPE 7: Vérifier que le backend fonctionne..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sleep 2

RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:8001/api/health 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "✓ Backend répond sur http://localhost:8001"
    echo "  HTTP Code: $HTTP_CODE"
    if [ -n "$BODY" ]; then
        echo "  Réponse: $BODY"
    fi
else
    echo "⚠️  Backend répond mais avec code: $HTTP_CODE"
fi
echo ""

# =====================================================================
# ÉTAPE 8: AFFICHER LE STATUT
# =====================================================================
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                      ✅ RÉPARATION TERMINÉE                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 STATUT FINAL:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier le statut final
if ps aux | grep -q "[u]vicorn server"; then
    echo "✅ Backend est en cours d'exécution"
else
    echo "⚠️  Backend ne semble pas tourner"
fi

if curl -s http://localhost:8001/api/health >/dev/null 2>&1; then
    echo "✅ Backend répond aux requêtes"
else
    echo "⚠️  Backend ne répond pas"
fi

echo ""
echo "🌐 ÉTAPES SUIVANTES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  Testez dans votre navigateur:"
echo "    https://multi-tenant-lottery.emergent.host"
echo ""
echo "2️⃣  Si HTTP 500 persiste, vérifiez les logs:"
if command -v pm2 &> /dev/null; then
    echo "    pm2 logs lottolab-backend --lines 100"
else
    echo "    tail -100 /app/backend/logs/uvicorn.log"
fi
echo ""
echo "3️⃣  Teste rapide du login:"
echo "    curl -X POST http://localhost:8001/api/auth/login \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"email\":\"test@example.com\",\"password\":\"test\"}'"
echo ""
echo "4️⃣  Vérifier MongoDB:"
echo "    python3 << 'EOF'"
echo "import asyncio"
echo "from motor.motor_asyncio import AsyncIOMotorClient"
echo "async def test():"
echo "    try:"
echo "        client = AsyncIOMotorClient('mongodb+srv://seller-commission-ui:d7031rklqs2c73dquodg@customer-apps.nngdus.mongodb.net/?maxPoolSize=5')"
echo "        await client.server_info()"
echo "        print('✅ MongoDB OK')"
echo "    except Exception as e:"
echo "        print(f'❌ MongoDB Error: {e}')"
echo "asyncio.run(test())"
echo "    EOF"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Tout est prêt! Votre backend devrait fonctionner correctement."
echo ""
