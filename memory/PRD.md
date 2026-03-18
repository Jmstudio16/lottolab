# LOTTOLAB - Product Requirements Document
**Version**: 9.0.1  
**Date**: 18 Mars 2026  
**Status**: Production Ready

---

## 1. Vision du Produit

LottoLab est une plateforme SaaS complète de gestion de loterie multi-entreprises permettant:
- Gestion des ventes de tickets
- Administration des tirages et résultats
- Suivi des gains et paiements
- Exports et rapports financiers

---

## 2. Architecture Technique

### Backend (FastAPI + MongoDB)
```
/backend
├── server.py              # Point d'entrée principal
├── models.py              # Modèles Pydantic
├── auth.py                # Authentification JWT
├── saas_core.py           # Logique multi-tenant
├── lottery_engine.py      # Moteur de calcul des gains
├── scheduler_tasks.py     # Tâches planifiées
└── *_routes.py            # Routes API par domaine
```

### Frontend (React + Tailwind CSS)
```
/frontend/src
├── pages/                 # 80+ pages (admin, vendeur, supervisor, etc.)
├── components/            # Composants réutilisables + Shadcn UI
├── api/                   # Client API avec auth
├── layouts/               # Layouts par rôle
└── i18n/                  # Traductions (FR, EN, ES, HT)
```

---

## 3. Fonctionnalités Implémentées ✅

### Authentification & Rôles
- [x] JWT Authentication
- [x] Multi-rôles: SUPER_ADMIN, COMPANY_ADMIN, SUPERVISOR, VENDEUR
- [x] Permissions par rôle

### Super Admin
- [x] Dashboard global
- [x] Gestion entreprises (CRUD)
- [x] Catalogue de loteries
- [x] Configuration des drapeaux
- [x] Plans et licences
- [x] Logs d'activité
- [x] Résultats globaux
- [x] Tirages globaux

### Company Admin
- [x] Dashboard entreprise
- [x] Gestion utilisateurs
- [x] Gestion succursales
- [x] Configuration loteries
- [x] Rapports de ventes
- [x] Exports PDF/Excel
- [x] Paramètres entreprise
- [x] Balance management

### Supervisor
- [x] Dashboard supervision
- [x] Gestion agents/vendeurs
- [x] Rapports d'équipe
- [x] Résultats
- [x] Tickets et suppressions

### Vendeur (POS)
- [x] Interface de vente optimisée mobile
- [x] Nouvelle vente (tickets)
- [x] Mes tickets
- [x] Mes ventes
- [x] Recherche tickets
- [x] Paiement gagnants
- [x] Résultats en direct

### Landing Page
- [x] Design professionnel
- [x] Animations (boules de loterie)
- [x] Responsive mobile
- [x] SEO optimisé
- [x] Bouton WhatsApp flottant

### SEO & Référencement
- [x] Meta tags optimisés
- [x] Open Graph tags
- [x] JSON-LD structured data
- [x] robots.txt
- [x] sitemap.xml

---

## 4. Fonctionnalités en Attente 🔄

### P2 - Priorité Moyenne
- [ ] **Logo sur tickets imprimés**: Intégrer le logo uploadé sur les reçus de tickets

### P3 - Priorité Basse
- [ ] Support multi-langues complet (Spanish, English)
- [ ] Mode hors-ligne pour POS
- [ ] Application mobile APK

---

## 5. Comptes de Test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@lottolab.com | 123456 |
| Company Admin | admin@lotopam.com | Admin123! |
| Supervisor | supervisor@lotopam.com | Supervisor123! |
| Vendeur | vendeur@lotopam.com | Vendeur123! |

---

## 6. Déploiement

### Fichiers de Déploiement
- `/deployment/GUIDE_DEPLOIEMENT_COMPLET.md` - Guide détaillé
- `/deployment/lottolab-api.service` - Service systemd
- `/deployment/nginx-api.lottolab.tech.conf` - Config Nginx

### URLs Production
- Frontend: https://lottolab.tech
- Backend API: https://api.lottolab.tech

### Stack Technique
- Python 3.9+ avec FastAPI
- MongoDB 4+
- React 18 avec Tailwind CSS
- Nginx comme reverse proxy

---

## 7. Support

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48

---

## Changelog Récent

### v9.0.1 (18 Mars 2026)
- ✅ Création du ZIP complet pour déploiement VPS
- ✅ Guide de déploiement Hostinger
- ✅ Landing page avec animations
- ✅ SEO optimisé (sitemap, robots.txt, meta tags)
- ✅ Bouton WhatsApp flottant
- ✅ Backend stabilisé contre erreurs MongoDB

### v9.0.0 (17 Mars 2026)
- Landing page redesignée
- Mobile responsiveness
- Fix build crash Babel
