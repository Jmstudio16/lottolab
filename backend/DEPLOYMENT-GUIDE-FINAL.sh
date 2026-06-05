#!/bin/bash
# =====================================================================
# LOTTOLAB - DEPLOYMENT COMPLETE GUIDE FOR EMERGENT PRODUCTION SERVER
# =====================================================================
# Guide étape par étape pour déployer et fixer le HTTP 500
# Version: 2026-06-04

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                                                                    ║"
echo "║     🚀 LOTTOLAB - GUIDE COMPLET DE DÉPLOIEMENT PRODUCTION         ║"
echo "║                                                                    ║"
echo "║  Ce guide vous aidera à déployer et réparer HTTP 500              ║"
echo "║  Estimé: 10-15 minutes                                            ║"
echo "║                                                                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# =====================================================================
# PART 1: PRÉPARER LES FICHIERS LOCALEMENT
# =====================================================================
echo "═══════════════════════════════════════════════════════════════════"
echo "PART 1: Préparation locale (sur votre ordinateur)"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

echo "1️⃣  Vérifier que les fichiers sont prêts:"
echo "    ✓ /app/backend/server.py (modifié avec logs)"
echo "    ✓ /app/backend/auth.py (avec validation JWT)"
echo "    ✓ /app/backend/.env (avec credentials production)"
echo "    ✓ /app/backend/requirements.txt"
echo ""

echo "2️⃣  Créer un paquet de déploiement:"
echo "    mkdir -p ~/lottolab-deploy"
echo "    cp /app/backend/server.py ~/lottolab-deploy/"
echo "    cp /app/backend/auth.py ~/lottolab-deploy/"
echo "    cp /app/backend/.env ~/lottolab-deploy/"
echo "    cp /app/backend/requirements.txt ~/lottolab-deploy/"
echo ""

# =====================================================================
# PART 2: UPLOADER VERS LE SERVEUR
# =====================================================================
echo "═══════════════════════════════════════════════════════════════════"
echo "PART 2: Upload vers le serveur Emergent"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

echo "Option A: Via SCP (Si vous avez SSH accès)"
echo "──────────────────────────────────────────"
echo "scp ~/lottolab-deploy/server.py seller-commission-ui@YOUR_IP:/app/backend/"
echo "scp ~/lottolab-deploy/auth.py seller-commission-ui@YOUR_IP:/app/backend/"
echo "scp ~/lottolab-deploy/.env seller-commission-ui@YOUR_IP:/app/backend/"
echo "scp ~/lottolab-deploy/requirements.txt seller-commission-ui@YOUR_IP:/app/backend/"
echo ""

echo "Option B: Via panneau Emergent (File Manager)"
echo "──────────────────────────────────────────"
echo "1. Connectez-vous à votre panneau Emergent"
echo "2. Aller à: File Manager → /app/backend"
echo "3. Uploader les 4 fichiers:"
echo "   - server.py"
echo "   - auth.py"
echo "   - .env"
echo "   - requirements.txt"
echo ""

# =====================================================================
# PART 3: EXÉCUTER LES COMMANDES SUR LE SERVEUR
# =====================================================================
echo "═══════════════════════════════════════════════════════════════════"
echo "PART 3: Exécuter sur le serveur Emergent (via Terminal SSH)"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

echo "📋 INSTRUCTIONS À COPIER-COLLER DANS LE TERMINAL SSH:"
echo "──────────────────────────────────────────────────────"
echo ""
echo "# Copier ces commandes et exécutez-les une par une ou ensemble:"
echo ""

cat << 'DEPLOYMENT_COMMANDS'
# ============== DÉPLOIEMENT LOTTOLAB ==============

# 1. Aller au répertoire backend
cd /app/backend

# 2. Arrêter les anciens processus
echo "Arrêter les anciens processus..."
pkill -9 -f "uvicorn server" || true
pkill -9 -f "python.*server" || true
sleep 2

# 3. Vérifier que .env est bien uploadé
echo "Vérifier les fichiers..."
ls -la server.py auth.py .env requirements.txt

# 4. Mettre à jour les permissions
chmod 755 server.py auth.py
chmod 644 .env requirements.txt

# 5. Installer/mettre à jour les dépendances
echo "Installer les dépendances (cela peut prendre 1-2 minutes)..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# 6. Vérifier la syntaxe Python
echo "Vérifier la syntaxe..."
python3 -m py_compile server.py auth.py

# 7. Créer répertoires logs
mkdir -p /app/backend/logs

# 8. Démarrer le backend
echo "Démarrer le backend..."
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2 > /var/log/lottolab-backend.log 2>&1 &

# 9. Attendre le démarrage
sleep 3

# 10. Vérifier que ça tourne
echo "Vérifier le statut..."
ps aux | grep -i uvicorn
netstat -tlnp | grep 8001

# 11. Test santé du backend
echo "Test de santé du backend..."
curl -v http://localhost:8001/api/health

# 12. Voir les logs
echo "Logs récents:"
tail -30 /var/log/lottolab-backend.log

# ============== FIN DÉPLOIEMENT ==============
DEPLOYMENT_COMMANDS

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "PART 4: Vérification post-déploiement"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

echo "✅ Vérifications à faire sur le serveur:"
echo ""

echo "1️⃣  Backend tourne?"
echo "   ps aux | grep '[u]vicorn'"
echo "   Résultat attendu: Une ligne avec 'uvicorn server:app'"
echo ""

echo "2️⃣  Port 8001 écoute?"
echo "   netstat -tlnp | grep 8001"
echo "   Résultat attendu: Une ligne avec ':8001'"
echo ""

echo "3️⃣  Backend répond?"
echo "   curl http://localhost:8001/api/health"
echo "   Résultat attendu: JSON response ou HTTP 200"
echo ""

echo "4️⃣  Fichier .env correctement configuré?"
echo "   grep MONGO_URL /app/backend/.env"
echo "   grep JWT_SECRET_KEY /app/backend/.env"
echo "   Résultat attendu: Voir les valeurs (pas de VOTRE-CLE)"
echo ""

echo "5️⃣  Voir les logs si erreur?"
echo "   tail -100 /var/log/lottolab-backend.log"
echo "   ou"
echo "   pm2 logs lottolab-backend --lines 100"
echo ""

# =====================================================================
# PART 5: VÉRIFICATION DANS LE NAVIGATEUR
# =====================================================================
echo "═══════════════════════════════════════════════════════════════════"
echo "PART 5: Vérification dans le navigateur"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

echo "1️⃣  Allez à: https://multi-tenant-lottery.emergent.host"
echo ""

echo "2️⃣  Vous devriez voir:"
echo "   ✓ La page de login charge correctement"
echo "   ✓ Pas de message d'erreur HTTP 500"
echo "   ✓ Le formulaire est interactif"
echo ""

echo "3️⃣  Essayez de vous connecter:"
echo "   - Email: Votre email"
echo "   - Password: Votre mot de passe"
echo "   ✓ Si rejeté: Le backend fonctionne! (User not found)"
echo "   ✓ Si timeout: MongoDB Atlas access problem"
echo "   ✗ Si HTTP 500: Vérifier les logs"
echo ""

# =====================================================================
# PART 6: TROUBLESHOOTING
# =====================================================================
echo "═══════════════════════════════════════════════════════════════════"
echo "PART 6: Troubleshooting si problème"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

echo "❌ Je vois toujours HTTP 500"
echo "──────────────────────────────"
echo "Exécutez ceci sur le serveur:"
echo ""
echo "1. Vérifier les logs:"
echo "   tail -100 /var/log/lottolab-backend.log | grep -i error"
echo ""
echo "2. Redémarrer le backend:"
echo "   pkill -9 -f uvicorn"
echo "   sleep 2"
echo "   cd /app/backend"
echo "   nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2 > /var/log/lottolab-backend.log 2>&1 &"
echo ""
echo "3. Vérifier MongoDB:"
echo "   python3 << 'EOF'"
echo "import asyncio, os"
echo "from motor.motor_asyncio import AsyncIOMotorClient"
echo "async def test():"
echo "    try:"
echo "        client = AsyncIOMotorClient('mongodb+srv://seller-commission-ui:d7031rklqs2c73dquodg@customer-apps.nngdus.mongodb.net/?maxPoolSize=5')"
echo "        await client.server_info()"
echo "        print('✅ MongoDB OK')"
echo "    except Exception as e:"
echo "        print(f'❌ MongoDB Error: {e}')"
echo "asyncio.run(test())"
echo "   EOF"
echo ""

echo "❌ Port 8001 est déjà utilisé"
echo "──────────────────────────────"
echo "lsof -i :8001 | grep LISTEN | awk '{print $2}' | xargs kill -9"
echo ""

echo "❌ ModuleNotFoundError: No module named 'fastapi'"
echo "───────────────────────────────────────────────────"
echo "pip install -r /app/backend/requirements.txt"
echo ""

echo "❌ MONGO_URL not set"
echo "────────────────────"
echo "Vérifier que .env contient MONGO_URL:"
echo "cat /app/backend/.env | grep MONGO_URL"
echo ""

# =====================================================================
# PART 7: RÉSUMÉ FINAL
# =====================================================================
echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                                                                    ║"
echo "║                    ✅ GUIDE COMPLET TERMINÉ                       ║"
echo "║                                                                    ║"
echo "║  Résumé des actions à faire:                                      ║"
echo "║  1. ✓ Copier 4 fichiers vers /app/backend/ sur le serveur        ║"
echo "║  2. ✓ Exécuter les commandes de déploiement                      ║"
echo "║  3. ✓ Vérifier que le backend tourne (port 8001)                 ║"
echo "║  4. ✓ Tester dans le navigateur                                  ║"
echo "║                                                                    ║"
echo "║  Temps estimé: 10-15 minutes                                      ║"
echo "║  Difficulté: Facile (copy-paste des commandes)                   ║"
echo "║                                                                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

echo "📞 BESOIN D'AIDE?"
echo "─────────────────"
echo "Si vous avez un problème:"
echo "1. Exécutez: tail -200 /var/log/lottolab-backend.log"
echo "2. Copiez le message d'erreur"
echo "3. Demandez-moi d'aide avec le message d'erreur exact"
echo ""

echo "🎉 Bonne chance! Votre backend devrait maintenant fonctionner!"
echo ""
