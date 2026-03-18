#!/bin/bash
# ============================================
# LOTTOLAB - Script de Déploiement Automatique
# VPS Hostinger avec Ubuntu 20.04+
# ============================================

set -e

echo "=========================================="
echo "   LOTTOLAB - Installation Automatique"
echo "=========================================="

# Vérification root
if [ "$EUID" -ne 0 ]; then 
    echo "Erreur: Exécutez ce script en tant que root (sudo)"
    exit 1
fi

# Variables
BACKEND_DIR="/var/www/lottolab-api"
FRONTEND_DIR="/var/www/lottolab-frontend"
DOMAIN_API="api.lottolab.tech"
DOMAIN_FRONTEND="lottolab.tech"

echo ""
echo "[1/7] Mise à jour du système..."
apt update && apt upgrade -y

echo ""
echo "[2/7] Installation des dépendances..."
apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx curl wget unzip

echo ""
echo "[3/7] Installation de MongoDB..."
apt install -y mongodb
systemctl start mongodb
systemctl enable mongodb

echo ""
echo "[4/7] Configuration du Backend..."
mkdir -p $BACKEND_DIR
cp -r backend/* $BACKEND_DIR/
cd $BACKEND_DIR

# Créer environnement virtuel
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Créer .env si non existant
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  IMPORTANT: Modifiez $BACKEND_DIR/.env avec votre clé JWT!"
fi

# Permissions
chown -R www-data:www-data $BACKEND_DIR

echo ""
echo "[5/7] Configuration du Frontend..."
mkdir -p $FRONTEND_DIR
cp -r frontend/build/* $FRONTEND_DIR/
chown -R www-data:www-data $FRONTEND_DIR

echo ""
echo "[6/7] Configuration Nginx..."
cp nginx/api.lottolab.tech.conf /etc/nginx/sites-available/
cp nginx/lottolab.tech.conf /etc/nginx/sites-available/

# Créer configs temporaires sans SSL pour obtenir certificats
cat > /etc/nginx/sites-available/api.lottolab.tech.conf << 'NGINX_API'
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
    }
}
NGINX_API

cat > /etc/nginx/sites-available/lottolab.tech.conf << 'NGINX_FRONT'
server {
    listen 80;
    server_name lottolab.tech www.lottolab.tech;
    root /var/www/lottolab-frontend;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX_FRONT

ln -sf /etc/nginx/sites-available/api.lottolab.tech.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/lottolab.tech.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx

echo ""
echo "[7/7] Configuration du service systemd..."
cp systemd/lottolab-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable lottolab-api
systemctl start lottolab-api

echo ""
echo "=========================================="
echo "   Installation Terminée!"
echo "=========================================="
echo ""
echo "Prochaines étapes:"
echo ""
echo "1. Vérifiez que le DNS pointe vers ce serveur:"
echo "   - A record: api -> $(curl -s ifconfig.me)"
echo "   - A record: @ -> $(curl -s ifconfig.me)"
echo "   - A record: www -> $(curl -s ifconfig.me)"
echo ""
echo "2. Obtenez les certificats SSL:"
echo "   sudo certbot --nginx -d api.lottolab.tech"
echo "   sudo certbot --nginx -d lottolab.tech -d www.lottolab.tech"
echo ""
echo "3. Modifiez la clé JWT:"
echo "   sudo nano $BACKEND_DIR/.env"
echo ""
echo "4. Testez l'API:"
echo "   curl http://localhost:8001/api/health"
echo ""
echo "5. Accédez au site:"
echo "   https://lottolab.tech"
echo ""
echo "=========================================="
