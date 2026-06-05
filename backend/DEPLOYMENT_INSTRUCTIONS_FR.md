# 🚀 COMMENT RÉPARER LE HTTP 500 SUR LE SERVEUR PRODUCTION

## ⚠️ Le problème actuel

Vous voyez: **"Serveur indisponible (HTTP 500)"**

**Causes possibles:**
1. ❌ Backend Python n'est PAS EN COURS D'EXÉCUTION
2. ❌ Fichier `.env` manquant ou mal configuré
3. ❌ Impossible de se connecter à MongoDB Atlas
4. ❌ Port 8001 n'écoute pas

---

## ✅ Comment réparer

### Option 1: Via SSH (Recommandé - 2 minutes)

```bash
# Étape 1: Connectez-vous au serveur
ssh root@multi-tenant-lottery.emergent.host

# Étape 2: Vérifier si backend tourne
pm2 list
# ou
ps aux | grep uvicorn

# Étape 3: Si NON, exécuter le script de réparation
cd /app/backend
bash fix-http500.sh

# Étape 4: Vérifier les logs
pm2 logs lottolab-backend --lines 50

# Étape 5: Tester
curl http://localhost:8001/api/health
```

### Option 2: Copier manuellement les fichiers

**Sur votre ordinateur:**
```bash
# Télécharger les fichiers du local vers le serveur
scp /app/backend/server.py root@multi-tenant-lottery.emergent.host:/app/backend/
scp /app/backend/auth.py root@multi-tenant-lottery.emergent.host:/app/backend/
scp /app/backend/.env root@multi-tenant-lottery.emergent.host:/app/backend/
scp /app/backend/requirements.txt root@multi-tenant-lottery.emergent.host:/app/backend/
```

**Ensuite sur le serveur:**
```bash
ssh root@multi-tenant-lottery.emergent.host
cd /app/backend
pip install -r requirements.txt
pm2 restart lottolab-backend
```

---

## 🔍 Diagnostic - Vérifier l'état du serveur

```bash
# Connectez-vous au serveur
ssh root@multi-tenant-lottery.emergent.host

# Commande 1: Est-ce que le backend tourne?
pm2 list

# Commande 2: Est-ce que le port 8001 écoute?
netstat -tlnp | grep 8001
# ou
ss -tlnp | grep 8001

# Commande 3: Tester la connexion locale
curl http://localhost:8001/api/health

# Commande 4: Vérifier les variables d'environnement
cat /app/backend/.env

# Commande 5: Voir les logs d'erreur
pm2 logs lottolab-backend --lines 100
```

---

## 🛠️ Commandes utiles

```bash
# Arrêter le backend
pm2 stop lottolab-backend

# Redémarrer le backend
pm2 restart lottolab-backend

# Voir l'état
pm2 status

# Voir les logs en direct
pm2 logs lottolab-backend

# Voir les 100 dernières lignes de logs
pm2 logs lottolab-backend --lines 100

# Voir les logs d'une autre date
pm2 logs lottolab-backend --lines 200 | tail -50

# Tuer tous les processus Python
pkill -9 -f uvicorn

# Redémarrer complètement
pkill -9 -f uvicorn
pm2 delete lottolab-backend
cd /app/backend
pm2 start "uvicorn server:app --host 0.0.0.0 --port 8001" --name lottolab-backend
```

---

## ✅ Vérifications post-déploiement

Après avoir exécuté le script ou les commandes, vérifiez:

### 1️⃣ Backend tourne?
```bash
curl http://localhost:8001/api/health
```
**Résultat attendu:** `{"status":"healthy"}` ou similaire

### 2️⃣ Login fonctionne?
```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```
**Résultat attendu:** 
- Token JWT retourné (succès)
- Message d'erreur "User not found" ou "Invalid credentials" (bon signe, backend fonctionne)
- HTTP 500 (mauvais signe)

### 3️⃣ MongoDB est accessible?
```bash
python3 << 'EOF'
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

# Charger .env
load_dotenv('/app/backend/.env')
mongo_url = os.environ.get('MONGO_URL')

async def test():
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        await client.server_info()
        print("✓ MongoDB connexion OK")
    except Exception as e:
        print(f"✗ MongoDB connexion échouée: {e}")

asyncio.run(test())
EOF
```

---

## ⚠️ Problèmes courants et solutions

| Problème | Cause | Solution |
|----------|-------|----------|
| HTTP 500 toujours | Backend n'est pas démarré | `pm2 start "uvicorn server:app --host 0.0.0.0 --port 8001" --name lottolab-backend` |
| Timeout MongoDB | Pas d'accès internet | Vérifier: `ping customer-apps.nngdus.mongodb.net` |
| JWT erreur | Placeholder secret | Vérifier: `grep JWT_SECRET_KEY /app/backend/.env` |
| Port déjà utilisé | Autre processus utilise 8001 | `lsof -i :8001` puis `kill <PID>` |
| Pas d'accès fichier | Permissions | `chown -R root:root /app/backend && chmod 755 /app/backend` |

---

## 📞 Besoin d'aide?

Si vous avez toujours HTTP 500 après ces étapes:

1. **Collectez les informations:**
   ```bash
   pm2 logs lottolab-backend --lines 100 > /tmp/backend-logs.txt
   cat /app/backend/.env > /tmp/env-config.txt
   curl http://localhost:8001/api/health > /tmp/health.txt
   ```

2. **Partagez les logs**
3. **Vérifiez:** Port, Docker, Nginx config

---

**Les fichiers sont prêts à être déployés! ✅**

Exécutez simplement le script ou les commandes sur votre serveur.
