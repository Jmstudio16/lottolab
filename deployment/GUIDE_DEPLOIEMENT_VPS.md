# ==============================================
# GUIDE DE DÉPLOIEMENT COMPLET - LOTTOLAB
# Backend sur VPS DigitalOcean
# ==============================================

## PRÉREQUIS
- VPS Ubuntu 22.04 ou 24.04
- Domaine api.lottolab.tech pointant vers l'IP du VPS
- Accès SSH au serveur

---

## ÉTAPE 1: CONNEXION AU VPS

```bash
ssh root@VOTRE_IP_VPS
# ou
ssh votre_user@VOTRE_IP_VPS
```

---

## ÉTAPE 2: INSTALLATION DES PRÉREQUIS

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Python, Nginx, et outils
sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git curl

# Installer MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org

# Démarrer MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Vérifier que MongoDB fonctionne
sudo systemctl status mongod
```

---

## ÉTAPE 3: TÉLÉCHARGER LE CODE BACKEND

### Option A: Depuis GitHub (recommandé)
```bash
cd /var/www
git clone https://github.com/VOTRE_REPO/lottolab-backend.git lottolab-backend
cd lottolab-backend
```

### Option B: Télécharger depuis Emergent
1. Sur Emergent, cliquez "Save to GitHub" ou téléchargez le code
2. Transférez le dossier `/app/backend` vers le VPS:
```bash
scp -r /chemin/local/backend root@VOTRE_IP:/var/www/lottolab-backend
```

---

## ÉTAPE 4: CONFIGURER LE BACKEND

```bash
cd /var/www/lottolab-backend

# Créer l'environnement virtuel
python3 -m venv venv
source venv/bin/activate

# Installer les dépendances
pip install --upgrade pip
pip install -r requirements.txt

# Créer le fichier .env
cat > .env << 'EOF'
MONGO_URL="mongodb://localhost:27017"
DB_NAME="lottolab"
CORS_ORIGINS="*"
JWT_SECRET_KEY="votre-cle-secrete-tres-longue-et-complexe-changez-la"
EOF

# Tester que le backend démarre
uvicorn server:app --host 127.0.0.1 --port 8001
# Appuyez Ctrl+C pour arrêter après avoir vu "Uvicorn running..."
```

---

## ÉTAPE 5: CONFIGURER SYSTEMD (démarrage automatique)

```bash
# Créer le fichier de service
sudo nano /etc/systemd/system/lottolab-backend.service
```

Collez ce contenu:
```ini
[Unit]
Description=LOTTOLAB Backend API
After=network.target mongodb.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/lottolab-backend
Environment="PATH=/var/www/lottolab-backend/venv/bin"
ExecStart=/var/www/lottolab-backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Donner les permissions
sudo chown -R www-data:www-data /var/www/lottolab-backend

# Activer et démarrer le service
sudo systemctl daemon-reload
sudo systemctl enable lottolab-backend
sudo systemctl start lottolab-backend

# Vérifier le statut
sudo systemctl status lottolab-backend
```

---

## ÉTAPE 6: CONFIGURER NGINX

```bash
# Créer la configuration Nginx
sudo nano /etc/nginx/sites-available/api.lottolab.tech
```

Collez ce contenu:
```nginx
server {
    listen 80;
    server_name api.lottolab.tech;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

```bash
# Activer le site
sudo ln -s /etc/nginx/sites-available/api.lottolab.tech /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Redémarrer Nginx
sudo systemctl restart nginx
```

---

## ÉTAPE 7: ACTIVER SSL/HTTPS

```bash
# Installer le certificat SSL avec Let's Encrypt
sudo certbot --nginx -d api.lottolab.tech

# Suivre les instructions (email, accepter les conditions)
# Choisir "2" pour rediriger HTTP vers HTTPS
```

---

## ÉTAPE 8: OUVRIR LE FIREWALL

```bash
# Si vous utilisez UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Vérifier
sudo ufw status
```

---

## ÉTAPE 9: TESTER

```bash
# Test local sur le VPS
curl http://localhost:8001/api/health

# Test depuis internet
curl https://api.lottolab.tech/api/health
```

Résultat attendu:
```json
{"status":"healthy","database":"connected","version":"9.0.0","timestamp":"..."}
```

---

## COMMANDES UTILES

```bash
# Voir les logs du backend
sudo journalctl -u lottolab-backend -f

# Redémarrer le backend
sudo systemctl restart lottolab-backend

# Voir les logs Nginx
sudo tail -f /var/log/nginx/error.log

# Vérifier si le port 8001 est utilisé
sudo lsof -i :8001

# Vérifier MongoDB
sudo systemctl status mongod
```

---

## DÉPANNAGE

### "Connection refused" sur port 8001
```bash
# Vérifier que le backend tourne
sudo systemctl status lottolab-backend

# Si arrêté, voir les logs
sudo journalctl -u lottolab-backend --no-pager -n 50
```

### "502 Bad Gateway" sur Nginx
```bash
# Le backend ne répond pas - vérifier qu'il tourne
curl http://127.0.0.1:8001/api/health

# Si pas de réponse, redémarrer
sudo systemctl restart lottolab-backend
```

### Erreur MongoDB "connection refused"
```bash
# Vérifier que MongoDB tourne
sudo systemctl status mongod

# Si arrêté
sudo systemctl start mongod
```

---

## CONFIGURATION NETLIFY (Frontend)

1. Allez sur netlify.com > Votre site > Site settings
2. Environment variables > Add variable:
   - **Key**: `REACT_APP_BACKEND_URL`
   - **Value**: `https://api.lottolab.tech`
3. Deployments > Trigger deploy > Deploy site

---

## RÉSUMÉ DES FICHIERS IMPORTANTS

| Fichier | Emplacement |
|---------|-------------|
| Code backend | `/var/www/lottolab-backend/` |
| Variables d'env | `/var/www/lottolab-backend/.env` |
| Service systemd | `/etc/systemd/system/lottolab-backend.service` |
| Config Nginx | `/etc/nginx/sites-available/api.lottolab.tech` |
| Logs backend | `journalctl -u lottolab-backend` |
| Logs Nginx | `/var/log/nginx/error.log` |
