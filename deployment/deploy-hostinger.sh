#!/bin/bash
# ============================================
# SCRIPT DE DÉPLOIEMENT LOTTOLAB
# VPS Hostinger avec MongoDB 4
# ============================================

set -e

echo "============================================"
echo "  DÉPLOIEMENT LOTTOLAB SUR VPS HOSTINGER"
echo "============================================"

# Variables
APP_DIR="/var/www/lottolab-api"
NGINX_CONF="/etc/nginx/sites-available/api.lottolab.tech"

# 1. Mise à jour du système
echo ""
echo "[1/10] Mise à jour du système..."
sudo apt update && sudo apt upgrade -y

# 2. Installation des dépendances
echo ""
echo "[2/10] Installation des dépendances..."
sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git curl

# 3. Installation de MongoDB 4
echo ""
echo "[3/10] Installation de MongoDB..."
if ! command -v mongod &> /dev/null; then
    sudo apt install -y mongodb
    sudo systemctl start mongodb
    sudo systemctl enable mongodb
fi
echo "MongoDB status:"
sudo systemctl status mongodb --no-pager | head -5

# 4. Création du répertoire
echo ""
echo "[4/10] Création du répertoire de l'application..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# 5. Copie du code (assumant que le code est déjà uploadé)
echo ""
echo "[5/10] Vérification du code..."
if [ ! -f "$APP_DIR/server.py" ]; then
    echo "⚠️  ATTENTION: Le code backend n'est pas encore uploadé!"
    echo "   Uploadez le dossier backend vers $APP_DIR"
    echo "   Puis relancez ce script."
    exit 1
fi

# 6. Configuration de l'environnement Python
echo ""
echo "[6/10] Configuration de l'environnement Python..."
cd $APP_DIR
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 7. Configuration du fichier .env
echo ""
echo "[7/10] Configuration du fichier .env..."
if [ ! -f "$APP_DIR/.env" ]; then
    cat > $APP_DIR/.env << 'ENVEOF'
MONGO_URL="mongodb://localhost:27017"
DB_NAME="lottolab"
JWT_SECRET_KEY="CHANGEZ-CETTE-CLE-SECRETE-EN-PRODUCTION-$(openssl rand -hex 32)"
CORS_ORIGINS="https://lottolab.tech,https://www.lottolab.tech"
ENVEOF
    echo "✅ Fichier .env créé"
else
    echo "✅ Fichier .env existe déjà"
fi

# 8. Configuration de systemd
echo ""
echo "[8/10] Configuration du service systemd..."
sudo tee /etc/systemd/system/lottolab-api.service > /dev/null << 'SERVICEEOF'
[Unit]
Description=LOTTOLAB API Backend
After=network.target mongodb.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/lottolab-api
Environment="PATH=/var/www/lottolab-api/venv/bin"
ExecStart=/var/www/lottolab-api/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo chown -R www-data:www-data $APP_DIR
sudo systemctl daemon-reload
sudo systemctl enable lottolab-api
sudo systemctl restart lottolab-api

echo "Service status:"
sudo systemctl status lottolab-api --no-pager | head -10

# 9. Configuration de Nginx
echo ""
echo "[9/10] Configuration de Nginx..."
sudo tee $NGINX_CONF > /dev/null << 'NGINXEOF'
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
NGINXEOF

sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 10. Installation SSL (optionnel)
echo ""
echo "[10/10] Installation du certificat SSL..."
echo "Exécutez cette commande manuellement:"
echo "  sudo certbot --nginx -d api.lottolab.tech"

# Test final
echo ""
echo "============================================"
echo "  VÉRIFICATION"
echo "============================================"
sleep 3
curl -s http://localhost:8001/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'API Health: {d.get(\"status\", \"ERROR\")}')" || echo "❌ API non accessible"

echo ""
echo "============================================"
echo "  DÉPLOIEMENT TERMINÉ"
echo "============================================"
echo ""
echo "Prochaines étapes:"
echo "1. Configurez le DNS: api.lottolab.tech -> IP de votre VPS"
echo "2. Installez SSL: sudo certbot --nginx -d api.lottolab.tech"
echo "3. Testez: curl https://api.lottolab.tech/api/health"
echo ""
echo "Logs du service:"
echo "  sudo journalctl -u lottolab-api -f"
echo ""
