#!/bin/bash
# =====================================================================
# LOTTOLAB - FIX HTTP 500 - QUICK START
# =====================================================================
# Ce script répare le problème HTTP 500 en déployant la nouvelle version

set -e

echo ""
echo "============================================================"
echo "  🚀 LOTTOLAB BACKEND - FIX HTTP 500 ET DÉPLOYER"
echo "============================================================"
echo ""

BACKEND_PATH="/app/backend"

# ============================================================
# BACKUP CURRENT CONFIG
# ============================================================
echo "1️⃣  Créer une sauvegarde..."
if [ -f "$BACKEND_PATH/.env" ]; then
    cp "$BACKEND_PATH/.env" "$BACKEND_PATH/.env.backup.$(date +%s)"
    echo "✓ Sauvegarde créée"
fi
echo ""

# ============================================================
# STOP CURRENT BACKEND
# ============================================================
echo "2️⃣  Arrêter le backend actuel..."
if command -v pm2 &> /dev/null; then
    pm2 delete lottolab-backend 2>/dev/null || true
    pm2 kill 2>/dev/null || true
fi
pkill -9 -f "uvicorn server" 2>/dev/null || true
sleep 2
echo "✓ Backend arrêté"
echo ""

# ============================================================
# UPDATE ENV VARIABLES
# ============================================================
echo "3️⃣  Vérifier/mettre à jour les variables d'environnement..."
cat > "$BACKEND_PATH/.env" << 'ENVEOF'
MONGO_URL=mongodb+srv://seller-commission-ui:d7031rklqs2c73dquodg@customer-apps.nngdus.mongodb.net/?appName=seller-commission-ui&maxPoolSize=5&retryWrites=true&timeoutMS=10000&w=majority
DB_NAME=lottolab
CORS_ORIGINS=https://multi-tenant-lottery.emergent.host,https://lottolab.tech,https://www.lottolab.tech,http://localhost:3000
JWT_SECRET_KEY=lottolab-secure-production-key-jm-studio-2026-change-in-production
EMERGENT_LLM_KEY=sk-emergent-6F5B3426d8cA3364e4
ENVEOF
echo "✓ .env mis à jour"
echo ""

# ============================================================
# INSTALL PACKAGES
# ============================================================
echo "4️⃣  Installer les dépendances..."
cd "$BACKEND_PATH"
pip install -q --upgrade pip setuptools wheel 2>/dev/null || true
pip install -q -r requirements.txt 2>/dev/null || true
echo "✓ Dépendances installées"
echo ""

# ============================================================
# VERIFY PYTHON
# ============================================================
echo "5️⃣  Vérifier la syntaxe Python..."
python3 -m py_compile server.py auth.py models.py 2>/dev/null || {
    echo "✗ Erreur de syntaxe Python"
    exit 1
}
echo "✓ Python valide"
echo ""

# ============================================================
# START BACKEND WITH PM2
# ============================================================
echo "6️⃣  Démarrer le backend avec PM2..."
if ! command -v pm2 &> /dev/null; then
    echo "⚠ PM2 non installé, installation..."
    npm install -g pm2 2>/dev/null || true
fi

# Start with PM2
cd "$BACKEND_PATH"
pm2 start "uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2" \
    --name lottolab-backend \
    --log /var/log/lottolab-backend.log 2>/dev/null || \
uvicorn server:app --host 0.0.0.0 --port 8001 > /tmp/lottolab.log 2>&1 &

sleep 3

# Check if running
if pm2 list 2>/dev/null | grep -q lottolab-backend; then
    pm2 save 2>/dev/null || true
    echo "✓ Backend démarré avec PM2"
elif ps aux | grep -q "uvicorn server" | grep -v grep; then
    echo "✓ Backend démarré en arrière-plan"
else
    echo "✗ Le backend n'a pas démarré"
    echo ""
    echo "Logs d'erreur:"
    tail -20 /tmp/lottolab.log
    exit 1
fi
echo ""

# ============================================================
# VERIFY BACKEND IS RUNNING
# ============================================================
echo "7️⃣  Vérifier que le backend fonctionne..."
sleep 2

for i in {1..5}; do
    if curl -s http://localhost:8001/api/health >/dev/null 2>&1; then
        echo "✓ Backend répond sur http://localhost:8001"
        break
    fi
    if [ $i -lt 5 ]; then
        echo "  Tentative $i/5..."
        sleep 2
    fi
done
echo ""

# ============================================================
# SHOW LOGS
# ============================================================
echo "8️⃣  Afficher les logs..."
echo "---"
if command -v pm2 &> /dev/null; then
    pm2 logs lottolab-backend --lines 20 --nostream
else
    tail -20 /tmp/lottolab.log || true
fi
echo ""

# ============================================================
# FINAL STATUS
# ============================================================
echo "============================================================"
echo "✅ BACKEND DÉPLOYÉ ET EN COURS D'EXÉCUTION"
echo "============================================================"
echo ""
echo "Statut:"
if ps aux | grep -q "uvicorn server" | grep -v grep; then
    echo "✓ Backend tourne sur le port 8001"
else
    echo "✗ Backend ne répond pas - vérifier les logs"
fi
echo ""
echo "Prochaines étapes:"
echo ""
echo "1️⃣  Testez le login:"
echo "   curl -X POST http://localhost:8001/api/auth/login \\"
echo '     -H "Content-Type: application/json" \'
echo '     -d \'{"email":"admin@example.com","password":"test"}\''
echo ""
echo "2️⃣  Vérifiez les logs en direct:"
if command -v pm2 &> /dev/null; then
    echo "   pm2 logs lottolab-backend"
else
    echo "   tail -f /tmp/lottolab.log"
fi
echo ""
echo "3️⃣  Vérifiez dans le navigateur:"
echo "   https://multi-tenant-lottery.emergent.host"
echo ""
echo "Si vous voyez toujours HTTP 500:"
echo "   - Vérifiez: pm2 logs lottolab-backend --lines 100"
echo "   - Vérifiez: curl http://localhost:8001/api/health"
echo "   - Vérifiez: MONGO_URL dans /app/backend/.env"
echo ""
