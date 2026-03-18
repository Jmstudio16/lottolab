#!/bin/bash
# ============================================
# LOTTOLAB - SCRIPT D'INSTALLATION AUTOMATIQUE
# VPS Hostinger Ubuntu 20.04+
# ============================================

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "============================================"
echo "   LOTTOLAB - Installation Automatique"
echo "============================================"
echo -e "${NC}"

# Vérification root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Erreur: Exécutez ce script en tant que root (sudo)${NC}"
    exit 1
fi

# Variables
BACKEND_DIR="/var/www/lottolab-api"
FRONTEND_DIR="/var/www/lottolab-frontend"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${YELLOW}[1/8] Mise à jour du système...${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}[2/8] Installation des dépendances...${NC}"
apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx curl wget git

echo -e "${YELLOW}[3/8] Installation de MongoDB...${NC}"
apt install -y mongodb
systemctl start mongodb
systemctl enable mongodb
echo -e "${GREEN}MongoDB installé et démarré${NC}"

echo -e "${YELLOW}[4/8] Configuration du Backend...${NC}"
mkdir -p $BACKEND_DIR
cp -r $PROJECT_DIR/backend/* $BACKEND_DIR/
cd $BACKEND_DIR

# Environnement Python
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Permissions
chown -R www-data:www-data $BACKEND_DIR
chmod -R 755 $BACKEND_DIR

echo -e "${GREEN}Backend configuré${NC}"

echo -e "${YELLOW}[5/8] Configuration du Frontend...${NC}"
mkdir -p $FRONTEND_DIR
cp -r $PROJECT_DIR/frontend/build/* $FRONTEND_DIR/
chown -R www-data:www-data $FRONTEND_DIR
echo -e "${GREEN}Frontend configuré${NC}"

echo -e "${YELLOW}[6/8] Configuration Nginx...${NC}"
cp $PROJECT_DIR/deployment/nginx-api.lottolab.tech.conf /etc/nginx/sites-available/api.lottolab.tech
cp $PROJECT_DIR/deployment/nginx-lottolab.tech.conf /etc/nginx/sites-available/lottolab.tech
ln -sf /etc/nginx/sites-available/api.lottolab.tech /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/lottolab.tech /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo -e "${GREEN}Nginx configuré${NC}"

echo -e "${YELLOW}[7/8] Configuration du service systemd...${NC}"
cp $PROJECT_DIR/deployment/lottolab-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable lottolab-api
systemctl start lottolab-api
echo -e "${GREEN}Service systemd configuré${NC}"

echo -e "${YELLOW}[8/8] Vérification finale...${NC}"
sleep 3
if curl -s http://localhost:8001/api/health | grep -q "healthy"; then
    echo -e "${GREEN}✓ API Backend fonctionne!${NC}"
else
    echo -e "${RED}✗ Problème avec le backend. Vérifiez: sudo journalctl -u lottolab-api${NC}"
fi

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "VOTRE_IP")

echo -e "${GREEN}"
echo "============================================"
echo "   Installation Terminée!"
echo "============================================"
echo -e "${NC}"
echo ""
echo -e "${YELLOW}PROCHAINES ÉTAPES:${NC}"
echo ""
echo "1. Configurez le DNS dans Hostinger:"
echo "   - A record: api.lottolab.tech -> $SERVER_IP"
echo "   - A record: lottolab.tech -> $SERVER_IP"
echo "   - A record: www.lottolab.tech -> $SERVER_IP"
echo ""
echo "2. Attendez la propagation DNS (5-30 min)"
echo ""
echo "3. Installez les certificats SSL:"
echo "   sudo certbot --nginx -d api.lottolab.tech"
echo "   sudo certbot --nginx -d lottolab.tech -d www.lottolab.tech"
echo ""
echo "4. Testez le site:"
echo "   https://lottolab.tech"
echo ""
echo -e "${YELLOW}COMMANDES UTILES:${NC}"
echo "   sudo systemctl status lottolab-api"
echo "   sudo journalctl -u lottolab-api -f"
echo "   sudo systemctl restart lottolab-api"
echo ""
echo -e "${GREEN}============================================${NC}"
