# LOTTOLAB - Guide de Déploiement Production

## 1. Prérequis

- Node.js 18+ 
- Python 3.10+
- MongoDB 6+
- SSL Certificate

## 2. Variables d'Environnement

### Backend (.env)
```env
# MongoDB
MONGO_URL=mongodb://user:password@host:27017/lottolab

# JWT
JWT_SECRET=your-secure-secret-key-min-32-chars

# CORS
CORS_ORIGINS=https://yourdomain.com

# Environment
ENV=production
DEBUG=false
```

### Frontend (.env)
```env
REACT_APP_BACKEND_URL=https://api.yourdomain.com
```

## 3. Build Production

### Frontend
```bash
cd frontend
yarn install --frozen-lockfile
yarn build
```

### Backend
```bash
cd backend
pip install -r requirements.txt
```

## 4. Démarrage Serveur

### Backend (Gunicorn)
```bash
gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001
```

### Frontend (Static Files)
Servir le dossier `frontend/build/` avec Nginx ou Apache.

## 5. Configuration Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Frontend
    location / {
        root /var/www/lottolab/frontend/build;
        try_files $uri /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Public ticket verification
    location /verify-ticket {
        proxy_pass http://127.0.0.1:8001/api/verify-ticket;
    }
}
```

## 6. Backup MongoDB (Cron quotidien)

```bash
# /etc/cron.daily/mongodb-backup
#!/bin/bash
DATE=$(date +%Y%m%d)
mongodump --uri="$MONGO_URL" --out=/backups/mongo/$DATE
find /backups/mongo -mtime +7 -delete
```

## 7. Monitoring

### Health Check
```bash
curl https://yourdomain.com/api/health
```

### Logs
```bash
tail -f /var/log/lottolab/backend.log
```

## 8. SSL (Let's Encrypt)

```bash
certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

## 9. Performance Tips

- Activer gzip compression
- Utiliser CDN pour assets statiques
- Configurer cache headers
- MongoDB indexes déjà créés

## 10. Contacts Support

- Email: support@lottolab.com
- Documentation: https://docs.lottolab.com

---
Version: 2.1.0 Production Ready
Date: 2026-02-28
