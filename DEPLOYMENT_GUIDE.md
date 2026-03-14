# GUIDE DE DÉPLOIEMENT - LOTTOLAB sur lottolab.tech

## Architecture
- **Frontend**: lottolab.tech (Netlify)
- **Backend**: api.lottolab.tech (VPS DigitalOcean avec Nginx/PM2)

---

## 1. CONFIGURATION NETLIFY (Frontend)

### Option A: Via le Dashboard Netlify
1. Allez dans **Site settings > Environment variables**
2. Ajoutez la variable:
   - **Key**: `REACT_APP_BACKEND_URL`
   - **Value**: `https://api.lottolab.tech`
3. Redéployez le site

### Option B: Le fichier `netlify.toml` est déjà créé
Le fichier `netlify.toml` à la racine du frontend contient déjà:
```toml
[build.environment]
  REACT_APP_BACKEND_URL = "https://api.lottolab.tech"
```

---

## 2. CONFIGURATION BACKEND (VPS - api.lottolab.tech)

### A. Fichier .env du backend
```bash
# /app/backend/.env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="lottolab"
CORS_ORIGINS="*"
JWT_SECRET_KEY="CHANGEZ-CETTE-CLE-EN-PRODUCTION"
```

### B. Configuration Nginx pour api.lottolab.tech
```nginx
server {
    listen 80;
    server_name api.lottolab.tech;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.lottolab.tech;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.lottolab.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.lottolab.tech/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

### C. Commandes pour démarrer le backend avec PM2
```bash
# Installation des dépendances
cd /app/backend
pip install -r requirements.txt

# Démarrer avec PM2
pm2 start "uvicorn server:app --host 0.0.0.0 --port 8001" --name lottolab-backend

# Vérifier le statut
pm2 status

# Voir les logs
pm2 logs lottolab-backend
```

---

## 3. VÉRIFICATION

### Test depuis le navigateur (Console F12)
```javascript
// Tester l'API health
fetch('https://api.lottolab.tech/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Tester le login
fetch('https://api.lottolab.tech/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'jefferson@jmstudio.com',
    password: 'JMStudio@2026!'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### Test depuis terminal
```bash
# Test health
curl https://api.lottolab.tech/api/health

# Test login
curl -X POST https://api.lottolab.tech/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jefferson@jmstudio.com","password":"JMStudio@2026!"}'
```

---

## 4. CHECKLIST AVANT DÉPLOIEMENT

- [ ] SSL/HTTPS actif sur api.lottolab.tech (Let's Encrypt)
- [ ] Port 443 ouvert dans le firewall
- [ ] MongoDB en marche sur le VPS
- [ ] PM2 démarre le backend sur port 8001
- [ ] Nginx configuré comme reverse proxy
- [ ] Variable `REACT_APP_BACKEND_URL` définie dans Netlify
- [ ] Redéployer le frontend sur Netlify après avoir ajouté la variable

---

## 5. ERREURS COURANTES

### "Mixed Content" Error
→ Assurez-vous que le backend utilise HTTPS (api.lottolab.tech avec SSL)

### "CORS Error"
→ Le backend inclut déjà `DynamicCORSMiddleware` qui accepte toutes les origines

### "Network Error" ou "Failed to fetch"
→ Vérifiez que le backend tourne: `curl https://api.lottolab.tech/api/health`

### "404 Not Found"
→ Vérifiez la configuration Nginx et que le proxy_pass pointe vers le bon port

---

## Support

En cas de problème:
1. Ouvrez la console navigateur (F12) sur lottolab.tech
2. Regardez l'onglet "Console" pour les erreurs JavaScript
3. Regardez l'onglet "Network" pour voir les requêtes API
4. Partagez les messages d'erreur exacts
