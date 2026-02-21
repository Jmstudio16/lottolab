# LOTTOLAB - Configuration de Production pour Hostinger VPS

## 1. Variables d'Environnement Requises

### Backend (.env)
```bash
# Base de données MongoDB
MONGO_URL="mongodb://localhost:27017"
DB_NAME="lottolab_production"

# Sécurité JWT (CHANGER EN PRODUCTION!)
JWT_SECRET_KEY="VOTRE-CLE-SECRETE-TRES-LONGUE-64-CARACTERES-MINIMUM-A-GENERER"

# CORS - Remplacer par votre domaine
CORS_ORIGINS="https://votre-domaine.com,https://www.votre-domaine.com"
```

### Frontend (.env)
```bash
# URL de l'API Backend
REACT_APP_BACKEND_URL=https://api.votre-domaine.com
```

## 2. Commandes de Déploiement Hostinger

### 2.1 Préparation du Serveur
```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Installer Python 3.11+
sudo apt install -y python3.11 python3.11-venv python3-pip

# Installer MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Installer Nginx
sudo apt install -y nginx

# Installer PM2 pour gérer les processus
sudo npm install -g pm2
```

### 2.2 Configuration Backend
```bash
cd /var/www/lottolab/backend

# Créer environnement virtuel
python3.11 -m venv venv
source venv/bin/activate

# Installer dépendances
pip install -r requirements.txt

# Créer fichier .env avec vos valeurs de production
cp .env.example .env
nano .env

# Initialiser les données de production (une seule fois)
python init_production.py

# Démarrer avec PM2
pm2 start "uvicorn server:app --host 0.0.0.0 --port 8001" --name lottolab-backend
pm2 save
pm2 startup
```

### 2.3 Configuration Frontend
```bash
cd /var/www/lottolab/frontend

# Installer dépendances
npm install --legacy-peer-deps

# Créer .env de production
echo "REACT_APP_BACKEND_URL=https://api.votre-domaine.com" > .env

# Build de production
npm run build

# Le dossier build/ sera servi par Nginx
```

### 2.4 Configuration Nginx
```nginx
# /etc/nginx/sites-available/lottolab

# Frontend
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;
    
    root /var/www/lottolab/frontend/build;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API Backend (si domaine séparé)
server {
    listen 80;
    server_name api.votre-domaine.com;
    
    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2.5 Activer SSL avec Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com -d api.votre-domaine.com
```

## 3. Création du Super Admin Initial

Après le déploiement, exécutez le script de création du Super Admin:

```bash
cd /var/www/lottolab/backend
source venv/bin/activate
python create_super_admin.py
```

## 4. Checklist de Production

- [ ] JWT_SECRET_KEY générée avec une clé sécurisée de 64+ caractères
- [ ] CORS_ORIGINS configuré avec le(s) domaine(s) exact(s)
- [ ] MongoDB sécurisé avec authentification
- [ ] SSL/HTTPS activé sur tous les domaines
- [ ] PM2 configuré pour démarrer automatiquement
- [ ] Backups MongoDB automatisés
- [ ] Logs configurés et rotationnés
- [ ] Firewall configuré (UFW)

## 5. Sécurité Supplémentaire

### Configurer le Firewall
```bash
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

### Sécuriser MongoDB
```bash
mongosh
use admin
db.createUser({
  user: "lottolab_admin",
  pwd: "MOT_DE_PASSE_SECURISE",
  roles: [{ role: "readWrite", db: "lottolab_production" }]
})
```

Puis modifier MONGO_URL:
```
MONGO_URL="mongodb://lottolab_admin:MOT_DE_PASSE_SECURISE@localhost:27017/lottolab_production?authSource=admin"
```

## 6. Monitoring

### PM2 Monitoring
```bash
pm2 monit
pm2 logs lottolab-backend
```

### Nginx Logs
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```
