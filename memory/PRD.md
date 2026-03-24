# LOTTOLAB - Product Requirements Document
**Version**: 12.4.0  
**Date**: 24 Mars 2026  
**Status**: Production Ready - Système 100% Fonctionnel

---

## 1. Résumé du Système

LOTTOLAB est une plateforme de loterie complète avec:
- **Super Admin**: Gestion globale, catalogues, schedules, résultats
- **Company Admin**: Gestion entreprise, succursales, tickets
- **Supervisor**: Gestion agents, rapports succursale
- **Vendeur**: Vente tickets, résultats, paiement gagnants

---

## 2. Corrections v12.4.0 (Cette Session)

### ✅ Système 100% Fonctionnel
- Tous les logins fonctionnent (4 rôles)
- Toutes les pages accessibles
- Tous les boutons fonctionnels

### ✅ Loteries Haiti
- 26 loteries Haiti configurées
- Horaires: 06:00-23:00
- Drapeau 🇭🇹 affiché
- Triées en premier dans la liste

### ✅ Initialisation Automatique Production
- Script de migration: `migrate_haiti_lotteries.py`
- Endpoint API: `POST /api/super/init-haiti-lotteries`
- Bouton UI: Super Admin > Settings > Initialiser Loteries Haiti
- Auto-init au démarrage serveur

### ✅ Ticket Imprimé
- Bouton "IMPRIMER" supprimé
- Logo entreprise affiché
- Téléphone et adresse affichés
- QR Code optionnel
- Texte header/footer personnalisable

---

## 3. Statistiques Actuelles

| Métrique | Valeur |
|----------|--------|
| Total Schedules | 403 |
| Loteries Haiti | 26 |
| Loteries ouvertes (Company) | 193 |
| Succursales | 2 |
| Agents actifs | 10 |

---

## 4. Guide de Déploiement Production

### Option A: Automatique (Recommandé)
Les loteries Haiti sont initialisées automatiquement au démarrage du serveur.
Aucune action requise après déploiement.

### Option B: Via Interface Super Admin
1. Connectez-vous sur lottolab.tech en tant que Super Admin
2. Allez dans **Settings**
3. Cliquez sur **Initialiser Loteries Haiti**

### Option C: Via Script
```bash
cd /app/backend
python3 migrate_haiti_lotteries.py
```

---

## 5. Comptes de Test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@lottolab.com | 123456 |
| Company Admin | admin@lotopam.com | Admin123! |
| Supervisor | supervisor@lotopam.com | Supervisor123! |
| Vendeur | vendeur@lotopam.com | Vendeur123! |

---

## 6. API Endpoints Clés

### Authentification
- `POST /api/auth/login` - Connexion tous rôles

### Super Admin
- `GET /api/super/global-schedules` - Liste des schedules (403)
- `GET /api/super/haiti-lotteries-status` - Status loteries Haiti
- `POST /api/super/init-haiti-lotteries` - Initialiser loteries Haiti

### Company Admin
- `GET /api/company/dashboard/stats` - Stats dashboard
- `GET /api/company/profile` - Configuration entreprise
- `PUT /api/company/profile` - Modifier configuration

### Vendeur
- `GET /api/device/config` - Config + loteries ouvertes
- `POST /api/device/tickets` - Créer ticket

### Tickets
- `GET /api/ticket/print/{id}` - Imprimer ticket
- `GET /api/sync/reprint-ticket/{id}` - Réimprimer ticket

---

## 7. Fichiers Importants

```
/app/backend/
├── server.py                    # Serveur principal
├── haiti_lottery_init.py        # Initialisation Haiti (auto)
├── migrate_haiti_lotteries.py   # Script migration standalone
├── sync_routes.py               # Ticket print (sans IMPRIMER)
├── ticket_print_routes.py       # Ticket print online
└── super_admin_global_routes.py # Endpoints Super Admin
```

---

## 8. Tâches Terminées

- [x] Login tous les rôles
- [x] Super Admin Dashboard + 403 schedules
- [x] Company Admin Dashboard + 193 loteries
- [x] Supervisor Dashboard + Agents
- [x] Vendeur Nouvelle Vente + 26 Haiti
- [x] Ticket sans bouton IMPRIMER
- [x] Configuration ticket (logo, téléphone, adresse, QR)
- [x] Initialisation auto production
- [x] Script de migration

---

## 9. Support

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48
- Website: lottolab.tech
