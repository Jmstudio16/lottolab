# ========================================================
# INSTRUCTIONS DE DÉPLOIEMENT BACKEND - LOTTOLAB
# Suivez ces étapes dans l'ordre exact
# ========================================================

## MÉTHODE 1: TÉLÉCHARGEMENT DEPUIS EMERGENT (Recommandé)

### Sur Emergent:
1. Cliquez sur "Save to GitHub" dans la barre d'entrée du chat
2. Suivez les instructions pour pousser vers votre repo GitHub
3. Sur le VPS, clonez depuis GitHub

### OU téléchargez directement:
1. Dans Emergent, allez dans l'onglet "Files" (icône dossier)
2. Naviguez vers /app/backend
3. Téléchargez le dossier entier

---

## MÉTHODE 2: COMMANDES À EXÉCUTER SUR VOTRE VPS

### ÉTAPE 1: Préparation du VPS
```bash
# Connectez-vous à votre VPS
ssh root@VOTRE_IP_VPS

# Mettez à jour le système
sudo apt update && sudo apt upgrade -y

# Installez les dépendances
sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git curl
```

### ÉTAPE 2: Installation de MongoDB
```bash
# Importez la clé GPG MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Ajoutez le dépôt
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Installez MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Démarrez MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Vérifiez que MongoDB fonctionne
sudo systemctl status mongod
```

### ÉTAPE 3: Créez le répertoire
```bash
sudo mkdir -p /var/www/lottolab/backend
cd /var/www/lottolab/backend
```

### ÉTAPE 4: Transférez le code (depuis votre machine locale)
```bash
# DEPUIS VOTRE MACHINE LOCALE (pas le VPS)
# Après avoir téléchargé depuis Emergent:
scp -r ./backend/* root@VOTRE_IP_VPS:/var/www/lottolab/backend/
```

### ÉTAPE 5: Configurez le backend
```bash
# Sur le VPS
cd /var/www/lottolab/backend

# Créez l'environnement virtuel Python
python3 -m venv venv
source venv/bin/activate

# Installez les dépendances
pip install --upgrade pip
pip install -r requirements.txt
```

### ÉTAPE 6: Configurez le fichier .env
```bash
# Créez le fichier de configuration
cat > .env << 'EOF'
MONGO_URL="mongodb://localhost:27017"
DB_NAME="lottolab"
CORS_ORIGINS="*"
JWT_SECRET_KEY="CHANGEZ-CETTE-CLE-avec-une-valeur-longue-et-complexe-2026"
EOF
```

### ÉTAPE 7: Testez le démarrage
```bash
# Testez que le backend démarre
source venv/bin/activate
uvicorn server:app --host 127.0.0.1 --port 8001

# Vous devez voir: "Uvicorn running on http://127.0.0.1:8001"
# Appuyez Ctrl+C pour arrêter
```

### ÉTAPE 8: Configurez le service systemd
```bash
# Créez le fichier de service
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
WorkingDirectory=/var/www/lottolab/backend
Environment="PATH=/var/www/lottolab/backend/venv/bin"
ExecStart=/var/www/lottolab/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Donnez les permissions
sudo chown -R www-data:www-data /var/www/lottolab

# Activez et démarrez le service
sudo systemctl daemon-reload
sudo systemctl enable lottolab-backend
sudo systemctl start lottolab-backend

# Vérifiez le statut
sudo systemctl status lottolab-backend
```

### ÉTAPE 9: Configurez Nginx
```bash
# Créez la configuration Nginx
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
# Activez le site
sudo ln -sf /etc/nginx/sites-available/api.lottolab.tech /etc/nginx/sites-enabled/

# Testez et redémarrez Nginx
sudo nginx -t
sudo systemctl restart nginx
```

### ÉTAPE 10: Activez HTTPS/SSL
```bash
# Installez le certificat SSL Let's Encrypt
sudo certbot --nginx -d api.lottolab.tech

# Répondez aux questions:
# - Entrez votre email
# - Acceptez les conditions
# - Choisissez 2 (rediriger HTTP vers HTTPS)
```

### ÉTAPE 11: Testez!
```bash
# Test local
curl http://localhost:8001/api/health

# Test externe
curl https://api.lottolab.tech/api/health
```

---

## VÉRIFICATION FINALE

Le test doit retourner:
```json
{"status":"healthy","database":"connected","version":"9.0.0","timestamp":"..."}
```

Si vous voyez cette réponse, le backend est prêt!

---

## COMMANDES DE DÉPANNAGE

```bash
# Voir les logs du backend
sudo journalctl -u lottolab-backend -f

# Redémarrer le backend
sudo systemctl restart lottolab-backend

# Voir les erreurs Nginx
sudo tail -f /var/log/nginx/error.log

# Vérifier si MongoDB fonctionne
sudo systemctl status mongod

# Vérifier si le port 8001 écoute
sudo lsof -i :8001
```

---

## APRÈS LE DÉPLOIEMENT BACKEND

Une fois que `curl https://api.lottolab.tech/api/health` fonctionne:

1. Allez sur **Netlify** > Votre site > **Site settings** > **Environment variables**
2. Ajoutez: `REACT_APP_BACKEND_URL` = `https://api.lottolab.tech`
3. Cliquez **Trigger deploy** pour redéployer le frontend

Le login sur lottolab.tech fonctionnera!
