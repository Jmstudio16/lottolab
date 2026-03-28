# LOTTOLAB PRD - Mise à jour 28 Mars 2026

## Résumé du Projet
Application de loterie professionnelle pour Haïti avec système POS, gestion des tirages, calcul automatique des gains (60/20/10), impression thermique 80mm, et exports Excel/PDF.

## Architecture Technique
- **Frontend**: React + Tailwind CSS + ShadcnUI
- **Backend**: FastAPI + MongoDB (Motor async)
- **Impression**: HTML thermique optimisé 80mm
- **Exports**: Excel (xlsxwriter), PDF (ReportLab)
- **Auth**: JWT avec rate limiting (10/minute)

## Fonctionnalités Implémentées

### Phase 1: Core System (COMPLÉTÉ)
- ✅ Authentification multi-rôles (Super Admin, Company Admin, Manager, Supervisor, Agent)
- ✅ Gestion des entreprises et succursales
- ✅ Catalogue des loteries (236 loteries US)
- ✅ Création de tickets avec numéros et montants
- ✅ Impression tickets 80mm avec pagination intelligente

### Phase 2: Gestion des Gains (COMPLÉTÉ)
- ✅ Moteur de paiement `payout_engine.py` (60/20/10)
- ✅ Calcul automatique Borlette, Loto 3, Loto 4, Loto 5, Mariage
- ✅ Publication des résultats Super Admin
- ✅ Recalcul des gains sur modification

### Phase 3: Fonctionnalités Production (COMPLÉTÉ - 28/03/2026)
- ✅ **Système de Notifications** - Lu/Non lu persistant, Mark All Read
- ✅ **Gestion Heures de Tirage** - CRUD Super Admin exclusif
- ✅ **Synchronisation Temps Réel** - Polling /api/sync/global chaque 10s
- ✅ **Dropdown Loteries** - 236 loteries maintenant affichées (bug fixé)
- ✅ **Company Settings Complet**:
  - Logo entreprise avec upload
  - Nom, Téléphone, Adresse, Email
  - Toggle QR Code (Activé/Désactivé)
  - Header/Footer du ticket personnalisés
  - Configuration des primes (60|20|10)

## APIs Critiques

### Authentification
- `POST /api/auth/login` - Connexion (rate limit: 10/min)
- `GET /api/auth/me` - Info utilisateur connecté

### Notifications
- `GET /api/notifications` - Liste des notifications
- `PUT /api/notifications/{id}/read` - Marquer comme lu
- `PUT /api/notifications/mark-all-read` - Tout marquer lu
- `POST /api/notifications` - Créer notification (Admin)

### Heures de Tirage (Super Admin)
- `GET /api/super/draw-times` - Liste des tirages
- `POST /api/super/draw-times` - Créer tirage
- `PUT /api/super/draw-times/{id}` - Modifier tirage
- `DELETE /api/super/draw-times/{id}` - Supprimer tirage

### Synchronisation Temps Réel
- `GET /api/sync/global` - Sync complète (poll 10s)
- `GET /api/sync/ping` - Ping léger (poll 5s)
- `GET /api/sync/latest-results` - Derniers résultats

### Résultats
- `GET /api/results/lotteries` - Liste 236 loteries (Super Admin)
- `POST /api/results/publish` - Publier résultats

### Company Settings
- `GET /api/company/profile` - Paramètres entreprise
- `PUT /api/company/profile` - Sauvegarder paramètres
- `POST /api/company/logo/upload` - Upload logo

## Comptes de Test

### Super Admin
- Email: `jefferson@jmstudio.com`
- Mot de passe: `JMStudio@2026!`

### Company Admin
- Email: `admin@lotopam.com`
- Mot de passe: `Admin@2026!`

## Prochaines Tâches (Backlog)

### P1 - Priorité Haute
- [ ] Refactoring templates tickets (unifier sync_routes.py et ticket_print_routes.py)
- [ ] Tests E2E complets avec Playwright

### P2 - Priorité Moyenne
- [ ] Support multilingue (Espagnol, Anglais)
- [ ] Mode hors ligne APK pour POS Android

### P3 - Priorité Basse
- [ ] Rapport détaillé Mariages Gratis
- [ ] Intégration Bluetooth imprimante ESC/POS

## Changelog

### 28 Mars 2026 - Iteration 39
- Ajout système notifications persistant (read/unread)
- Ajout page Heures de Tirage Super Admin CRUD
- Ajout synchronisation temps réel (polling)
- Correction bug dropdown loteries (1 → 236)
- Ajout toggle QR Code dans Company Settings
- Tests: 13/13 backend, 100% frontend

### 27 Mars 2026 - Iteration 38
- Moteur de paiement 60/20/10
- Page Publication Résultats Super Admin
- Exports Excel/PDF
- Pagination intelligente tickets
