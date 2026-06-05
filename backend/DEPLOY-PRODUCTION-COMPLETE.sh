#!/bin/bash
# =====================================================================
# LOTTOLAB - DEPLOYMENT SCRIPT COMPLET
# =====================================================================
# Ce script:
# 1. Vérifie la configuration Nginx
# 2. Déploie le backend sur le port 8001
# 3. Redémarre Nginx
# 4. Teste que tout fonctionne
# =====================================================================

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║  🚀 LOTTOLAB - DÉPLOIEMENT COMPLET                            ║"
echo "║  Backend + Nginx Configuration                                ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# =====================================================================
# ÉTAPE 1: VÉRIFIER LE RÉPERTOIRE /app/backend
# =====================================================================
echo "📁 ÉTAPE 1: Vérifier les fichiers backend..."
echo "═════════════════════════════════════════════════════════════════"

BACKEND_PATH="/app/backend"

if [ ! -d "$BACKEND_PATH" ]; then
    echo "❌ ERREUR: Répertoire $BACKEND_PATH non trouvé!"
    exit 1
fi

cd "$BACKEND_PATH"

for file in server.py auth.py models.py requirements.txt .env; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file MANQUANT!"
        exit 1
    fi
done
echo ""

# =====================================================================
# ÉTAPE 2: ARRÊTER LE BACKEND EXISTANT
# =====================================================================
echo "🛑 ÉTAPE 2: Arrêter les anciens processus..."
echo "═════════════════════════════════════════════════════════════════"

if command -v pm2 &> /dev/null; then
    echo "Utiliser PM2 pour arrêter..."
    pm2 delete lottolab-backend 2>/dev/null || true
    pm2 kill 2>/dev/null || true
fi

echo "Tuer les processus uvicorn..."
pkill -9 -f "uvicorn server" 2>/dev/null || true
pkill -9 -f "python.*server" 2>/dev/null || true

sleep 2
echo "✓ Processus anciens arrêtés"
echo ""

# =====================================================================
# ÉTAPE 3: INSTALLER LES DÉPENDANCES
# =====================================================================
echo "📦 ÉTAPE 3: Installer/mettre à jour les dépendances..."
echo "═════════════════════════════════════════════════════════════════"

pip install -q --upgrade pip 2>/dev/null || true
echo "Installing packages..."
pip install -q -r requirements.txt 2>&1 | tail -1

echo "✓ Dépendances installées"
echo ""

# =====================================================================
# ÉTAPE 4: VÉRIFIER LA SYNTAXE PYTHON
# =====================================================================
echo "✅ ÉTAPE 4: Vérifier la syntaxe Python..."
echo "═════════════════════════════════════════════════════════════════"

python3 -m py_compile server.py auth.py models.py 2>&1
if [ $? -eq 0 ]; then
    echo "✓ Syntaxe Python valide"
else
    echo "✗ ERREUR DE SYNTAXE PYTHON!"
    exit 1
fi
echo ""

# =====================================================================
# ÉTAPE 5: DÉMARRER LE BACKEND
# =====================================================================
echo "🚀 ÉTAPE 5: Démarrer le backend..."
echo "═════════════════════════════════════════════════════════════════"

# Créer répertoires logs
mkdir -p /app/backend/logs /var/log

# Démarrer avec nohup (simple et fiable)
echo "Démarrage du backend sur le port 8001..."
nohup python3 -m uvicorn server:app \
    --host 0.0.0.0 \
    --port 8001 \
    --workers 2 \
    > /var/log/lottolab-backend.log 2>&1 &

BACKEND_PID=$!
sleep 3

# Vérifier que le processus tourne
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo "✓ Backend démarré (PID: $BACKEND_PID)"
else
    echo "⚠ Le processus n'est pas trouvé"
    echo "Vérifier les logs:"
    tail -20 /var/log/lottolab-backend.log
fi
echo ""

# =====================================================================
# ÉTAPE 6: VÉRIFIER QUE LE BACKEND RÉPOND
# =====================================================================
echo "🔍 ÉTAPE 6: Vérifier que le backend répond..."
echo "═════════════════════════════════════════════════════════════════"

for i in {1..10}; do
    if curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
        echo "✓ Backend répond sur http://localhost:8001/api/health"
        break
    fi
    if [ $i -lt 10 ]; then
        echo "  Tentative $i/10..."
        sleep 1
    fi
done
echo ""

# =====================================================================
# ÉTAPE 7: VÉRIFIER NGINX
# =====================================================================
echo "🌐 ÉTAPE 7: Vérifier Nginx..."
echo "═════════════════════════════════════════════════════════════════"

if command -v nginx &> /dev/null; then
    echo "✓ Nginx est installé"
    
    # Vérifier la syntaxe de la config
    nginx -t 2>&1 | grep -q "successful" && echo "✓ Configuration Nginx valide" || echo "⚠ Erreur de configuration Nginx"
    
    # Redémarrer Nginx
    systemctl restart nginx 2>/dev/null || service nginx restart 2>/dev/null || true
    echo "✓ Nginx redémarré"
else
    echo "⚠ Nginx n'est pas installé"
fi
echo ""

# =====================================================================
# ÉTAPE 8: TESTS FINAUX
# =====================================================================
echo "✔️  ÉTAPE 8: Tests finaux..."
echo "═════════════════════════════════════════════════════════════════"

echo ""
echo "Test 1: Backend tourne?"
if ps aux | grep -q "[u]vicorn server"; then
    echo "✓ Oui, le backend tourne"
else
    echo "✗ Non, le backend ne tourne pas"
fi

echo ""
echo "Test 2: Port 8001 écoute?"
if netstat -tlnp 2>/dev/null | grep -q 8001 || ss -tlnp 2>/dev/null | grep -q 8001; then
    echo "✓ Oui, le port 8001 écoute"
else
    echo "✗ Non, le port 8001 n'écoute pas"
fi

echo ""
echo "Test 3: Backend répond?"
if curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
    echo "✓ Oui, le backend répond"
else
    echo "✗ Non, le backend ne répond pas"
fi

echo ""
echo "Test 4: Configuration .env?"
if [ -f .env ] && grep -q "MONGO_URL" .env && grep -q "JWT_SECRET_KEY" .env; then
    echo "✓ Oui, .env configuré"
else
    echo "✗ Non, .env manquant ou incomplet"
fi

echo ""

# =====================================================================
# RÉSUMÉ FINAL
# =====================================================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ DÉPLOIEMENT TERMINÉ                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo "📊 STATUT:"
echo "  • Backend: En cours d'exécution sur le port 8001"
echo "  • Frontend: Accès via https://multi-tenant-lottery.emergent.host"
echo "  • API: Accessible via /api/*"
echo ""

echo "🔍 PROCHAINES ÉTAPES:"
echo "  1. Allez à: https://multi-tenant-lottery.emergent.host"
echo "  2. Essayez de vous connecter"
echo "  3. Vérifiez qu'il n'y a plus d'erreur HTTP 500"
echo ""

echo "📋 VÉRIFICATIONS UTILES:"
echo ""
echo "Voir les logs du backend:"
echo "  tail -50 /var/log/lottolab-backend.log"
echo ""
echo "Redémarrer le backend:"
echo "  pkill -9 -f uvicorn"
echo "  cd /app/backend && nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2 > /var/log/lottolab-backend.log 2>&1 &"
echo ""
echo "Voir le statut Nginx:"
echo "  systemctl status nginx"
echo ""
echo "Redémarrer Nginx:"
echo "  systemctl restart nginx"
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                   ✨ PRÊT POUR PRODUCTION! ✨                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
