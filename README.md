# ============================================
# LOTTOLAB - SYSTÈME DE GESTION DE LOTERIE
# ============================================

## Description

LottoLab est un système complet de gestion de loterie avec:
- Gestion multi-entreprises (SaaS)
- Points de vente (POS) pour vendeurs
- Gestion des tirages et résultats
- Suivi des tickets et gains
- Exports PDF/Excel
- Interface mobile responsive

## Architecture

```
/backend          - API FastAPI (Python)
/frontend         - Application React
/deployment       - Scripts et configs de déploiement
```

## Comptes par défaut

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@lottolab.com | 123456 |
| Company Admin | admin@lotopam.com | Admin123! |
| Supervisor | supervisor@lotopam.com | Supervisor123! |
| Vendeur | vendeur@lotopam.com | Vendeur123! |

## Déploiement

Consultez le guide complet: `/deployment/GUIDE_DEPLOIEMENT_COMPLET.md`

### Résumé rapide

1. **Backend (VPS)**
   - Installer Python 3.9+, MongoDB 4+
   - Copier `/backend` vers `/var/www/lottolab-api`
   - Configurer `.env`
   - Lancer avec systemd

2. **Frontend (Netlify ou VPS)**
   - `yarn build` avec `REACT_APP_BACKEND_URL=https://api.votredomaine.com`
   - Déployer le dossier `build`

## Support

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48

## Version

9.0.1 - Mars 2026
