# ============================================
# GUIDE COMPLET - DÉPLOIEMENT LOTTOLAB
# VPS HOSTINGER + MongoDB 4
# ============================================

## ARCHITECTURE

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   FRONTEND (Netlify)    │     │   BACKEND (VPS)         │
│   lottolab.tech         │────▶│   api.lottolab.tech     │
│   - React App           │     │   - FastAPI             │
│   - Static files        │     │   - MongoDB 4           │
└─────────────────────────┘     │   - Port 8001           │
                                └─────────────────────────┘
```

## PRÉREQUIS

- VPS Hostinger avec Ubuntu 20.04+
- Domaine: lottolab.tech + api.lottolab.tech
- DNS configuré vers IP du VPS

---

## ÉTAPE 1: CONNEXION AU VPS

```bash
ssh root@VOTRE_IP_VPS
```

---

## ÉTAPE 2: INSTALLATION DES DÉPENDANCES

```bash
# Mise à jour
sudo apt update && sudo apt upgrade -y

# Python
sudo apt install -y python3 python3-pip python3-venv

# Nginx + Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# MongoDB 4
sudo apt install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Vérification
sudo systemctl status mongodb
```

---

## ÉTAPE 3: TÉLÉCHARGEMENT DU CODE

### Option A: Depuis GitHub
```bash
cd /var/www
git clone https://github.com/Jmstudio16/lottolab.git
mv lottolab/backend lottolab-api
rm -rf lottolab
```

### Option B: Upload direct
1. Téléchargez `backend-deployment.zip` depuis Emergent
2. Uploadez via SFTP vers `/var/www/`
3. Décompressez:
```bash
cd /var/www
unzip backend-deployment.zip
mv backend-package lottolab-api
```

---

## ÉTAPE 4: CONFIGURATION PYTHON

```bash
cd /var/www/lottolab-api

# Environnement virtuel
python3 -m venv venv
source venv/bin/activate

# Dépendances
pip install --upgrade pip
pip install -r requirements.txt
```

---

## ÉTAPE 5: CONFIGURATION .ENV

```bash
cat > /var/www/lottolab-api/.env << 'EOF'
MONGO_URL="mongodb://localhost:27017"
DB_NAME="lottolab"
JWT_SECRET_KEY="CHANGEZ-CETTE-CLE-SECRETE-TRES-LONGUE"
CORS_ORIGINS="https://lottolab.tech,https://www.lottolab.tech"
EOF
```

---

## ÉTAPE 6: TEST MANUEL

```bash
cd /var/www/lottolab-api
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001

# Dans un autre terminal:
curl http://localhost:8001/api/health
```

Appuyez `Ctrl+C` pour arrêter après le test.

---

## ÉTAPE 7: SERVICE SYSTEMD

```bash
sudo nano /etc/systemd/system/lottolab-api.service
```

Collez:
```ini
[Unit]
Description=LOTTOLAB API
After=network.target mongodb.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/lottolab-api
Environment="PATH=/var/www/lottolab-api/venv/bin"
ExecStart=/var/www/lottolab-api/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Permissions
sudo chown -R www-data:www-data /var/www/lottolab-api

# Activation
sudo systemctl daemon-reload
sudo systemctl enable lottolab-api
sudo systemctl start lottolab-api

# Vérification
sudo systemctl status lottolab-api
```

---

## ÉTAPE 8: CONFIGURATION NGINX

```bash
sudo nano /etc/nginx/sites-available/api.lottolab.tech
```

Collez:
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
    }
}
```

```bash
# Activation
sudo ln -sf /etc/nginx/sites-available/api.lottolab.tech /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## ÉTAPE 9: CERTIFICAT SSL

```bash
sudo certbot --nginx -d api.lottolab.tech
```

Suivez les instructions (email, accepter conditions, choisir redirection).

---

## ÉTAPE 10: CONFIGURATION DNS

Dans votre gestionnaire DNS (Hostinger/Cloudflare):

| Type | Nom | Valeur |
|------|-----|--------|
| A | api | IP_DE_VOTRE_VPS |
| A | @ | IP_DE_VOTRE_VPS (ou Netlify si frontend sur Netlify) |
| A | www | IP_DE_VOTRE_VPS (ou Netlify si frontend sur Netlify) |

---

## ÉTAPE 11: DÉPLOIEMENT FRONTEND

### Option A: Netlify (Recommandé)
1. Connectez votre repo GitHub à Netlify
2. Build command: `yarn build`
3. Publish directory: `build`
4. Environment variable: `REACT_APP_BACKEND_URL=https://api.lottolab.tech`

### Option B: Même VPS
```bash
# Créer répertoire
sudo mkdir -p /var/www/lottolab-frontend

# Uploader frontend-build-production.zip
unzip frontend-build-production.zip -d /var/www/lottolab-frontend
mv /var/www/lottolab-frontend/build/* /var/www/lottolab-frontend/

# Nginx pour frontend
sudo nano /etc/nginx/sites-available/lottolab.tech
```

```nginx
server {
    listen 80;
    server_name lottolab.tech www.lottolab.tech;

    root /var/www/lottolab-frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/lottolab.tech /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d lottolab.tech -d www.lottolab.tech
```

---

## ÉTAPE 12: VÉRIFICATION FINALE

```bash
# Test API
curl https://api.lottolab.tech/api/health

# Test Login
curl -X POST https://api.lottolab.tech/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lottolab.com","password":"123456"}'
```

---

## COMMANDES UTILES

```bash
# Logs backend
sudo journalctl -u lottolab-api -f

# Redémarrer backend
sudo systemctl restart lottolab-api

# Logs Nginx
sudo tail -f /var/log/nginx/error.log

# Status MongoDB
sudo systemctl status mongodb
```

---

## DÉPANNAGE

### "Connection refused" sur port 8001
```bash
sudo systemctl status lottolab-api
sudo journalctl -u lottolab-api --no-pager -n 50
```

### "502 Bad Gateway"
- Backend ne tourne pas
- Port incorrect dans Nginx

### Erreur MongoDB "Unauthorized"
- Vérifiez MONGO_URL dans .env
- MongoDB 4 n'a généralement pas d'auth par défaut

### CORS Error
- Vérifiez CORS_ORIGINS dans .env
- Redémarrez: `sudo systemctl restart lottolab-api`

---

## COMPTES PAR DÉFAUT

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@lottolab.com | 123456 |
| Company Admin | admin@lotopam.com | Admin123! |
| Supervisor | supervisor@lotopam.com | Supervisor123! |
| Vendeur | vendeur@lotopam.com | Vendeur123! |

---

## SEO - GOOGLE SEARCH CONSOLE

1. Allez sur: https://search.google.com/search-console
2. Ajoutez la propriété: `lottolab.tech`
3. Vérifiez via DNS ou fichier HTML
4. Soumettez le sitemap: `https://lottolab.tech/sitemap.xml`

---

## SUPPORT

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48
