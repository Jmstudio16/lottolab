#!/bin/bash
# ==============================================
# SCRIPT DE DÉPLOIEMENT BACKEND - LOTTOLAB
# Pour VPS DigitalOcean avec Ubuntu
# ==============================================

echo "🚀 Déploiement LOTTOLAB Backend sur api.lottolab.tech"
echo "=================================================="

# 1. MISE À JOUR DU SYSTÈME
echo ""
echo "📦 1. Mise à jour du système..."
sudo apt update && sudo apt upgrade -y

# 2. INSTALLATION DES DÉPENDANCES
echo ""
echo "📦 2. Installation des dépendances..."
sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git

# 3. INSTALLATION DE MONGODB
echo ""
echo "📦 3. Installation de MongoDB..."
# Importer la clé GPG MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Ajouter le repo MongoDB
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org

# Démarrer MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

echo "✅ MongoDB installé et démarré"

# 4. CRÉER LE RÉPERTOIRE DE L'APPLICATION
echo ""
echo "📁 4. Création du répertoire de l'application..."
sudo mkdir -p /var/www/lottolab-backend
sudo chown $USER:$USER /var/www/lottolab-backend

echo ""
echo "=================================================="
echo "✅ Prérequis installés!"
echo ""
echo "ÉTAPES SUIVANTES (manuelles):"
echo "1. Copiez le code backend dans /var/www/lottolab-backend"
echo "2. Exécutez: cd /var/www/lottolab-backend && ./setup-backend.sh"
echo "3. Configurez Nginx avec: sudo nano /etc/nginx/sites-available/api.lottolab.tech"
echo "4. Activez SSL avec: sudo certbot --nginx -d api.lottolab.tech"
echo "=================================================="
