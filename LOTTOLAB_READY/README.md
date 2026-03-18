# ============================================
# LOTTOLAB - SYSTÈME DE GESTION DE LOTERIE
# Version 9.0.1 - Production Ready
# ============================================

## 🎯 Description

LottoLab est une plateforme SaaS complète de gestion de loterie multi-entreprises.

## 📁 Structure du Projet

```
LOTTOLAB_READY/
├── backend/                    # API FastAPI (Python)
│   ├── server.py              # Point d'entrée
│   ├── requirements.txt       # Dépendances
│   ├── .env.example           # Template config
│   ├── .env                   # Config production
│   └── *.py                   # 41 modules
│
├── frontend/
│   ├── build/                 # Production build (prêt à déployer)
│   ├── src/                   # Code source React
│   ├── public/                # Assets publics
│   ├── package.json
│   └── .env                   # Config production
│
└── deployment/                # Fichiers de déploiement
    ├── install.sh             # Script auto-installation
    ├── nginx-api.lottolab.tech.conf
    ├── nginx-lottolab.tech.conf
    └── lottolab-api.service
```

## 🚀 Installation Rapide (VPS Hostinger)

### 1. Uploadez le projet sur votre VPS
```bash
# Depuis votre PC (après export depuis VS Code)
scp -r LOTTOLAB_READY root@VOTRE_IP:/root/
```

### 2. Lancez l'installation automatique
```bash
ssh root@VOTRE_IP
cd /root/LOTTOLAB_READY
chmod +x deployment/install.sh
sudo ./deployment/install.sh
```

### 3. Configurez le DNS dans Hostinger
| Type | Nom | Valeur |
|------|-----|--------|
| A | api | IP_DU_VPS |
| A | @ | IP_DU_VPS |
| A | www | IP_DU_VPS |

### 4. Installez SSL
```bash
sudo certbot --nginx -d api.lottolab.tech
sudo certbot --nginx -d lottolab.tech -d www.lottolab.tech
```

## 👤 Comptes par Défaut

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@lottolab.com | 123456 |
| Company Admin | admin@lotopam.com | Admin123! |
| Supervisor | supervisor@lotopam.com | Supervisor123! |
| Vendeur | vendeur@lotopam.com | Vendeur123! |

## 🔧 Commandes Utiles

```bash
# Status du backend
sudo systemctl status lottolab-api

# Logs en temps réel
sudo journalctl -u lottolab-api -f

# Redémarrer le backend
sudo systemctl restart lottolab-api

# Test API
curl https://api.lottolab.tech/api/health

# Logs Nginx
sudo tail -f /var/log/nginx/error.log
```

## 🌐 URLs Production

- **Frontend**: https://lottolab.tech
- **API**: https://api.lottolab.tech
- **Health Check**: https://api.lottolab.tech/api/health

## 📞 Support

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48

## ✅ Fonctionnalités

- Multi-entreprises (SaaS)
- Gestion des vendeurs et superviseurs
- Points de vente (POS)
- Tirages et résultats
- Calcul automatique des gains
- Exports PDF/Excel
- Responsive mobile
- SEO optimisé
- Bouton WhatsApp flottant

---
© 2026 JM Studio - LOTTOLAB
