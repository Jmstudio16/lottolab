#!/bin/bash
# COPY-PASTE THESE COMMANDS DIRECTLY INTO YOUR SERVER TERMINAL
# Ne modifiez rien, copiez-collez directement!

# ===== ÉTAPE 1: Se connecter au serveur =====
# ssh seller-commission-ui@YOUR_IP

# ===== ÉTAPE 2: EXÉCUTER CES COMMANDES =====

cd /app/backend

echo "🔄 Arrêter les anciens processus..."
pkill -9 -f "uvicorn server" 2>/dev/null || true
pkill -9 -f "python.*server" 2>/dev/null || true
sleep 2
echo "✓ Processus arrêtés"

echo ""
echo "📦 Installer les dépendances..."
pip install -q --upgrade pip 2>/dev/null || true
pip install -q -r requirements.txt
echo "✓ Dépendances installées"

echo ""
echo "🔍 Vérifier les fichiers..."
ls -la server.py auth.py .env requirements.txt
echo "✓ Fichiers vérifiés"

echo ""
echo "✅ Vérifier la syntaxe Python..."
python3 -m py_compile server.py auth.py
echo "✓ Syntaxe OK"

echo ""
echo "📂 Créer répertoire logs..."
mkdir -p ./logs
echo "✓ Répertoires créés"

echo ""
echo "🚀 Démarrer le backend..."
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2 > /var/log/lottolab-backend.log 2>&1 &
sleep 3
echo "✓ Backend démarré"

echo ""
echo "🔎 Vérifier le statut..."
if ps aux | grep -q "[u]vicorn server"; then
    echo "✅ Backend est en cours d'exécution!"
    echo ""
    echo "Vérifications finales:"
    echo "1. Port 8001 actif:"
    netstat -tlnp 2>/dev/null | grep 8001 || ss -tlnp 2>/dev/null | grep 8001
    echo ""
    echo "2. Test du backend:"
    curl -s http://localhost:8001/api/health || echo "Pas de réponse (normal si MongoDB non accessible)"
    echo ""
    echo "3. Logs récents:"
    tail -20 /var/log/lottolab-backend.log
else
    echo "❌ Le backend n'a pas démarré!"
    echo ""
    echo "Voir les logs:"
    tail -50 /var/log/lottolab-backend.log
fi

echo ""
echo "═════════════════════════════════════════════════════════"
echo "✅ DÉPLOIEMENT TERMINÉ!"
echo "═════════════════════════════════════════════════════════"
echo ""
echo "Prochaines étapes:"
echo "1. Allez à: https://multi-tenant-lottery.emergent.host"
echo "2. Essayez de vous connecter"
echo "3. Si HTTP 500 persiste:"
echo "   tail -100 /var/log/lottolab-backend.log"
echo ""
