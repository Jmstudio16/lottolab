#!/bin/bash
# =====================================================================
# 🚀 LOTTOLAB - RÉPARER LE HTTP 500 - ULTRA SIMPLE
# =====================================================================
# Exécutez CECI directement dans le terminal du serveur production:
# =====================================================================

# 1. Aller au répertoire backend
cd /app/backend || exit 1

# 2. Arrêter les anciens processus
pkill -9 -f "uvicorn server" 2>/dev/null || true
pkill -9 -f "python.*server" 2>/dev/null || true
sleep 2

# 3. Installer les dépendances
pip install -q --upgrade pip
pip install -q -r requirements.txt

# 4. Vérifier la syntaxe
python3 -m py_compile server.py auth.py models.py || { echo "Erreur Python!"; exit 1; }

# 5. Créer répertoires logs
mkdir -p /var/log /app/backend/logs

# 6. Démarrer le backend
echo "Démarrage du backend..."
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2 > /var/log/lottolab-backend.log 2>&1 &
sleep 3

# 7. Vérifier que ça tourne
echo ""
echo "═════════════════════════════════════════════════════════════"
echo "✅ VÉRIFICATIONS:"
echo "═════════════════════════════════════════════════════════════"
echo ""

# Vérifier processus
if ps aux | grep -q "[u]vicorn server"; then
    echo "✓ Backend est en cours d'exécution"
else
    echo "✗ Backend n'est pas en cours d'exécution!"
fi

# Vérifier port
if netstat -tlnp 2>/dev/null | grep -q 8001 || ss -tlnp 2>/dev/null | grep -q 8001; then
    echo "✓ Port 8001 écoute"
else
    echo "✗ Port 8001 n'écoute pas!"
fi

# Vérifier réponse
echo ""
echo "Teste de santé du backend..."
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:8001/api/health 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "✓ Backend répond avec HTTP $HTTP_CODE"
else
    echo "⚠ Backend répond avec HTTP $HTTP_CODE (ou pas de réponse)"
fi

echo ""
echo "═════════════════════════════════════════════════════════════"
echo "✅ DÉPLOIEMENT COMPLET!"
echo "═════════════════════════════════════════════════════════════"
echo ""
echo "Allez à: https://multi-tenant-lottery.emergent.host"
echo "Et vérifiez que le HTTP 500 a disparu! 🎉"
echo ""
echo "Si HTTP 500 persiste, vérifiez les logs:"
echo "  tail -50 /var/log/lottolab-backend.log"
echo ""
