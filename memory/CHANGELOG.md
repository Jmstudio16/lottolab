# LOTTOLAB - Changelog

## v18.0.0 - 25 Mars 2026

### 🆕 Nouvelles Fonctionnalités

#### Upload Images (Object Storage)
- **Logo Entreprise**: Upload via Emergent Object Storage
  - `POST /api/company/logo/upload`
  - `DELETE /api/company/logo`
  - Formats: PNG, JPG, WEBP, GIF, SVG (max 10MB)
  - Logo affiché dans Header, Sidebar, Tickets

- **Photos Profil Vendeur/Superviseur**: 
  - `POST /api/vendeur/profile/photo`
  - `DELETE /api/vendeur/profile/photo`
  - Avatar affiché partout (initiales si pas de photo)

- **Service de Fichiers**:
  - `GET /api/files/{path}` - Sert les images uploadées
  - `GET /api/storage/health` - Vérifie état Object Storage

#### Ticket Thermique 80mm Professionnel
- Template unifié (`ticket_template.py`)
- Format exact: Logo, Compagnie, Tel, Succursale (pas N/A), Vendeur, Machine, Ticket ID, Loterie, Tirage, Date, Heure temps réel, Numéros, Total, VALIDÉ, QR Code, LOTTOLAB.TECH
- Optimisé noir/blanc pour imprimantes thermiques

#### Composants Frontend
- `UserAvatar.jsx` - Avatar utilisateur (photo ou initiales)
- `Logo.js` - Logo dynamique avec contexte
- `LogoContext.js` - Contexte pour gestion logos

### 🔧 Améliorations
- `settings_routes.py` utilise Object Storage si disponible (fallback local)
- `ticket_print_routes.py` et `sync_routes.py` utilisent le template unifié
- Header, Sidebar, VendeurLayout affichent UserAvatar

### ✅ Tests
- 12/12 tests passés (iteration_36.json)
- Backend: Storage, Logo upload, Photo upload, Ticket print
- Frontend: UserAvatar, Logo, Company Settings, Vendeur Profile

---

## v17.0.0 - 25 Mars 2026

### 🌍 Système Multilingue 100%
- 4 langues: FR, HT, EN, ES
- 400+ clés de traduction par langue
- Changement en temps réel sans rechargement

### ⏰ Horaires Loteries
- Open/Close/Draw times configurables
- Affichage "Ouvert (Xh restant)"
- Blocage automatique après fermeture

### 💰 Limites de Mise
- min_bet_amount: 1 HTG
- max_bet_amount configurable par Company Admin
- Validation temps réel côté vendeur

---

## v16.0.0 - 24 Mars 2026

### 🎰 PayoutEngine
- Calcul automatique des gains
- Borlette 60|20|10, Loto 3/4/5, Mariage
- Snapshot des primes au moment de la vente

### 🔄 Synchronisation Loteries
- 236 loteries actives
- Fix enabled_lotteries: 0 bug

### 💰 Configuration Primes
- Interface Company Admin
- Primes par type de jeu
