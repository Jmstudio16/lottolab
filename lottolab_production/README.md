# ============================================
# LOTTOLAB - GUIDE DE DÉPLOIEMENT COMPLET
# VPS Hostinger + MongoDB + Nginx + SSL
# ============================================

## 📋 PRÉREQUIS

- VPS Ubuntu 20.04+ (Hostinger)
- Accès root (SSH)
- Domaines configurés:
  - `lottolab.tech` → IP du VPS
  - `api.lottolab.tech` → IP du VPS

---

## 🚀 INSTALLATION RAPIDE (Automatique)

```bash
# 1. Connectez-vous à votre VPS
ssh root@VOTRE_IP_VPS

# 2. Uploadez le ZIP (depuis votre PC)
scp lottolab_production.zip root@VOTRE_IP_VPS:/root/

# 3. Sur le VPS, décompressez et installez
cd /root
unzip lottolab_production.zip
cd lottolab_production
chmod +x scripts/install.sh
sudo ./scripts/install.sh
```

---

## 🔧 INSTALLATION MANUELLE (Étape par étape)

### Étape 1: Mise à jour système
```bash
sudo apt update && sudo apt upgrade -y
```

### Étape 2: Installation des dépendances
```bash
sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx mongodb curl wget
```

### Étape 3: Démarrer MongoDB
```bash
sudo systemctl start mongodb
sudo systemctl enable mongodb
sudo systemctl status mongodb
```

### Étape 4: Configuration Backend
```bash
# Créer le dossier
sudo mkdir -p /var/www/lottolab-api
sudo cp -r backend/* /var/www/lottolab-api/
cd /var/www/lottolab-api

# Environnement Python
sudo python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Configuration
sudo cp .env.example .env
sudo nano .env  # Modifiez JWT_SECRET_KEY!

# Permissions
sudo chown -R www-data:www-data /var/www/lottolab-api
```

### Étape 5: Configuration Frontend
```bash
sudo mkdir -p /var/www/lottolab-frontend
sudo cp -r frontend/build/* /var/www/lottolab-frontend/
sudo chown -R www-data:www-data /var/www/lottolab-frontend
```

### Étape 6: Configuration Nginx
```bash
# Copier les configs
sudo cp nginx/api.lottolab.tech.conf /etc/nginx/sites-available/
sudo cp nginx/lottolab.tech.conf /etc/nginx/sites-available/

# Activer les sites
sudo ln -sf /etc/nginx/sites-available/api.lottolab.tech.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/lottolab.tech.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Tester et recharger
sudo nginx -t
sudo systemctl reload nginx
```

### Étape 7: Service Systemd
```bash
sudo cp systemd/lottolab-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable lottolab-api
sudo systemctl start lottolab-api
sudo systemctl status lottolab-api
```

### Étape 8: Certificats SSL
```bash
# API
sudo certbot --nginx -d api.lottolab.tech

# Frontend
sudo certbot --nginx -d lottolab.tech -d www.lottolab.tech
```

---

## ✅ VÉRIFICATION

### Test API
```bash
curl http://localhost:8001/api/health
# Résultat attendu: {"status":"healthy","database":"connected"...}
```

### Test Login
```bash
curl -X POST https://api.lottolab.tech/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lottolab.com","password":"123456"}'
```

### Accès Web
- Frontend: https://lottolab.tech
- API Health: https://api.lottolab.tech/api/health

---

## 👤 COMPTES PAR DÉFAUT

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@lottolab.com | 123456 |
| Company Admin | admin@lotopam.com | Admin123! |
| Supervisor | supervisor@lotopam.com | Supervisor123! |
| Vendeur | vendeur@lotopam.com | Vendeur123! |

---

## 🛠️ COMMANDES UTILES

```bash
# Logs Backend
sudo journalctl -u lottolab-api -f

# Redémarrer Backend
sudo systemctl restart lottolab-api

# Status Backend
sudo systemctl status lottolab-api

# Logs Nginx
sudo tail -f /var/log/nginx/error.log

# Status MongoDB
sudo systemctl status mongodb
```

---

## 🔥 DÉPANNAGE

### "Connection refused" port 8001
```bash
sudo systemctl status lottolab-api
sudo journalctl -u lottolab-api --no-pager -n 100
```

### "502 Bad Gateway"
- Le backend ne tourne pas
- Vérifiez: `sudo systemctl restart lottolab-api`

### Erreur CORS
- Vérifiez CORS_ORIGINS dans `/var/www/lottolab-api/.env`
- Redémarrez: `sudo systemctl restart lottolab-api`

### MongoDB "Unauthorized"
- MongoDB 4 n'a généralement pas d'auth par défaut
- Vérifiez: `sudo systemctl status mongodb`

---

## 📞 SUPPORT

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48

---

## 📁 STRUCTURE DU PACKAGE

```
lottolab_production/
├── backend/                 # API FastAPI
│   ├── server.py           # Point d'entrée
│   ├── requirements.txt    # Dépendances Python
│   ├── .env.example        # Template configuration
│   └── *.py                # Modules API
├── frontend/
│   └── build/              # React production build
├── nginx/
│   ├── api.lottolab.tech.conf
│   └── lottolab.tech.conf
├── systemd/
│   └── lottolab-api.service
├── scripts/
│   └── install.sh          # Installation automatique
└── README.md               # Ce guide
```
