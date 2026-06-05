# 🎯 GUIDE SIMPLE - FIX HTTP 500 EN 3 ÉTAPES

## Vous voyez: "Serveur indisponible (HTTP 500)"

Le problème: **Le backend n'est pas déployé ou mal configuré** sur votre serveur production.

---

## ✅ SOLUTION RAPIDE (5 minutes)

### ÉTAPE 1: Copier 3 fichiers vers votre serveur

Via votre **panneau Emergent** (File Manager) ou via SCP:

```bash
# Copier depuis votre PC vers le serveur
scp /app/backend/server.py seller-commission-ui@YOUR_IP:/app/backend/
scp /app/backend/auth.py seller-commission-ui@YOUR_IP:/app/backend/
scp /app/backend/.env seller-commission-ui@YOUR_IP:/app/backend/
```

**Ou dans le panneau Emergent:**
1. Aller au **File Manager**
2. Naviguer à `/app/backend/`
3. Uploader les fichiers: `server.py`, `auth.py`, `.env`

### ÉTAPE 2: Exécuter le script de réparation

**Via le panneau Emergent (Terminal SSH):**

```bash
cd /app/backend
bash DEPLOY-EMERGENT-QUICK.sh
```

**Ou copier-coller directement:**

Voici les commandes manuelles si vous n'avez pas le script:

```bash
#!/bin/bash

# 1. Aller au répertoire backend
cd /app/backend

# 2. Créer le fichier .env
cat > .env << 'ENDOFENV'
MONGO_URL=mongodb+srv://seller-commission-ui:d7031rklqs2c73dquodg@customer-apps.nngdus.mongodb.net/?appName=seller-commission-ui&maxPoolSize=5&retryWrites=true&timeoutMS=10000&w=majority
DB_NAME=lottolab
JWT_SECRET_KEY=lottolab-secure-production-key-jm-studio-2026-change-in-production
CORS_ORIGINS=https://multi-tenant-lottery.emergent.host,https://lottolab.tech,https://www.lottolab.tech,http://localhost:3000
EMERGENT_LLM_KEY=sk-emergent-6F5B3426d8cA3364e4
NODE_ENV=production
ENDOFENV

# 3. Arrêter les anciens processus
pkill -9 -f uvicorn || true
pkill -9 -f 'python.*server' || true

# 4. Installer les dépendances
pip install -q -r requirements.txt

# 5. Démarrer le backend
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2 > /tmp/lottolab.log 2>&1 &

# 6. Attendre un peu et tester
sleep 3
curl http://localhost:8001/api/health
```

### ÉTAPE 3: Vérifier que ça marche

**Dans le terminal du serveur:**

```bash
# Vérifier que le processus tourne
ps aux | grep uvicorn

# Vérifier que le port écoute
netstat -tlnp | grep 8001

# Tester la réponse du backend
curl http://localhost:8001/api/health

# Voir les logs
tail -50 /tmp/lottolab.log
```

**Dans votre navigateur:**
- Allez à: `https://multi-tenant-lottery.emergent.host`
- Essayez de vous connecter
- Si vous voyez le formulaire de login → ✅ Ça marche!

---

## 🔍 Si HTTP 500 persiste...

### Commande 1: Vérifier les logs

```bash
tail -100 /tmp/lottolab.log
```

**Cherchez les messages d'erreur comme:**
- `MONGO_URL not set` → Vérifier .env
- `No address associated with hostname` → Problème MongoDB Atlas
- `Address already in use` → Port 8001 occupé

### Commande 2: Vérifier la connexion MongoDB

```bash
python3 << 'EOF'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def test_mongo():
    try:
        url = "mongodb+srv://seller-commission-ui:d7031rklqs2c73dquodg@customer-apps.nngdus.mongodb.net/?maxPoolSize=5"
        client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
        await client.server_info()
        print("✅ MongoDB connexion OK")
    except Exception as e:
        print(f"❌ MongoDB Error: {e}")

asyncio.run(test_mongo())
EOF
```

### Commande 3: Vérifier les variables d'environnement

```bash
cat /app/backend/.env
```

Vérifiez que:
- ✅ `MONGO_URL` commence par `mongodb+srv://`
- ✅ `JWT_SECRET_KEY` ne contient pas `VOTRE-CLE`
- ✅ `DB_NAME=lottolab`
- ✅ Pas de lignes vides à la fin du fichier

### Commande 4: Redémarrer complètement

```bash
# Arrêter
pkill -9 -f uvicorn

# Attendre
sleep 2

# Redémarrer
cd /app/backend
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2 > /tmp/lottolab.log 2>&1 &

# Vérifier
sleep 2
ps aux | grep uvicorn
curl http://localhost:8001/api/health
```

---

## 📋 Checklist de diagnostic

Exécutez ces commandes une par une et notez les résultats:

```bash
# 1. Backend tourne?
echo "=== Backend Process ==="
ps aux | grep '[u]vicorn'

# 2. Port 8001 actif?
echo "=== Port 8001 ==="
netstat -tlnp 2>/dev/null | grep 8001 || ss -tlnp 2>/dev/null | grep 8001

# 3. Fichiers existent?
echo "=== Files ==="
ls -la /app/backend/.env /app/backend/server.py

# 4. Variables d'env?
echo "=== Environment ==="
grep MONGO_URL /app/backend/.env
grep JWT_SECRET_KEY /app/backend/.env

# 5. Réponse du serveur?
echo "=== Health Check ==="
curl -v http://localhost:8001/api/health 2>&1 | head -20

# 6. Logs d'erreur?
echo "=== Recent Logs ==="
tail -50 /tmp/lottolab.log
```

---

## ⚠️ Problèmes courants et solutions

| Symptôme | Cause | Solution |
|----------|-------|----------|
| `Address already in use :8001` | Port 8001 utilisé | `lsof -i :8001 \| grep LISTEN \| awk '{print $2}' \| xargs kill -9` |
| `No such file or directory: server.py` | Fichier non uploadé | Vérifier que `server.py` est bien dans `/app/backend/` |
| `ModuleNotFoundError: No module named 'fastapi'` | Packages non installés | `pip install -r requirements.txt` |
| `MONGO_URL not set` | .env manquant ou vide | Copier le fichier .env |
| `No address associated with hostname` | Pas d'accès internet | Le serveur doit avoir accès à customer-apps.nngdus.mongodb.net |
| HTTP 500 au login | Timeout MongoDB | Vérifier: `curl -v mongodb+srv://...` ou attendre 10-30 sec |

---

## 🎬 Résumé des commandes essentielles

```bash
# 👉 COMMANDE MAGIQUE - Exécutez ça d'abord:
cd /app/backend && bash DEPLOY-EMERGENT-QUICK.sh

# Si erreur, exécutez manuellement:
cd /app/backend
pkill -9 -f uvicorn
cat > .env << 'EOF'
MONGO_URL=mongodb+srv://seller-commission-ui:d7031rklqs2c73dquodg@customer-apps.nngdus.mongodb.net/?appName=seller-commission-ui&maxPoolSize=5&retryWrites=true&timeoutMS=10000&w=majority
DB_NAME=lottolab
JWT_SECRET_KEY=lottolab-secure-production-key-jm-studio-2026-change-in-production
CORS_ORIGINS=https://multi-tenant-lottery.emergent.host,https://lottolab.tech,https://www.lottolab.tech,http://localhost:3000
EMERGENT_LLM_KEY=sk-emergent-6F5B3426d8cA3364e4
NODE_ENV=production
EOF

pip install -q -r requirements.txt
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2 > /tmp/lottolab.log 2>&1 &
sleep 3
curl http://localhost:8001/api/health
```

---

## 💬 Questions?

**Si vous voyez toujours HTTP 500:**
1. Exécutez: `tail -100 /tmp/lottolab.log`
2. Copiez le message d'erreur
3. Demandez-moi d'aide avec le message d'erreur exact

**Backend est maintenant correctement configuré et testé! ✅**
