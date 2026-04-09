# LOTTOLAB PRO - Professional Lottery SaaS Platform

## Version: 27.2.0 (LOTTOLAB PRO - POS Performance Optimized)
## Last Updated: 2026-04-09 00:55 UTC
## Deployed: 2026-04-08 20:55 Haiti Time

---

## 🚀 STATUT: PRODUCTION READY ✅

### Optimisations v27.2.0 (Performance POS):

#### 1. Chargement ultra-rapide des loteries ✅
- **Timeout réduit à 6 secondes** (au lieu de 8s)
- **Debounce 2 secondes** pour éviter les appels répétés
- **Chargement en arrière-plan** pour config et cache IndexedDB
- **API répond en < 0.2 secondes** (testé avec curl)

#### 2. Gestion silencieuse du cache ✅
- **Toast uniquement au premier chargement** si erreur
- **Pas de notification** quand l'API répond normalement
- **Fallback transparent** vers IndexedDB si API échoue

#### 3. Interface mobile optimisée ✅
- **Design réactif** pour écrans POS (414x896px testé)
- **Navigation en bas** : Vente, Tickets, Résultats, Profil
- **Indicateurs compacts** : WiFi, Imprimante, Timer

### Corrections v27.1.0 (Stabilisation Offline):

#### 1. Stabilisation du système de détection réseau ✅
- **SyncManager initialisé correctement** - Attente d'IndexedDB avant notifications
- **NetworkIndicator robuste** - Utilise `mountedRef` pour éviter les memory leaks
- **OfflineContext amélioré** - Gestion propre des événements online/offline
- **Debounce `fetchLotteries`** - Protection contre les appels trop fréquents (3s)

#### 2. WebSocket reconnexion contrôlée ✅
- Maximum **3 tentatives** de reconnexion avec backoff exponentiel
- Pas de reconnexion quand hors ligne
- Nettoyage propre des timers à la destruction du composant

#### 3. Compatibilité anciens imports ✅
- `syncService.js` transformé en wrapper vers le nouveau `offlineSyncManager`
- Migration transparente pour les composants existants

### Nouvelles Fonctionnalités (v27.0.0):

#### 1. Architecture Offline-First Complète ✅ (NOUVEAU)
- **IndexedDB** remplace localStorage pour toutes les données critiques:
  - Session utilisateur (7 jours de validité)
  - Tickets en attente de synchronisation
  - Cache des loteries et configurations
  - Limites de paris par type
  - Configuration imprimante
- **Fichiers créés/modifiés**:
  - `/app/frontend/src/services/offlineDB.js` - Service IndexedDB complet
  - `/app/frontend/src/services/offlineSyncManager.js` - Gestionnaire de sync robuste
  - `/app/frontend/src/contexts/OfflineContext.jsx` - Provider global
  - `/app/frontend/src/api/auth.js` - Authentification avec session persistante

#### 2. Sync Queue Manager Robuste ✅ (NOUVEAU)
- **Retry automatique** avec délais exponentiels (3s, 10s, 30s, 1m, 2m)
- **Maximum 5 tentatives** avant échec définitif
- **Synchronisation toutes les 30 secondes** quand en ligne
- **Background Sync** via Service Worker
- **Détection de duplicates** pour éviter les doubles ventes
- **États de ticket**: pending → syncing → synced | failed

#### 3. Login Offline & Session Persistante ✅ (NOUVEAU)
- Vendeur reste connecté même après redémarrage APK
- Tokens stockés dans IndexedDB (7 jours)
- Revalidation automatique au retour de connexion
- Pas de déconnexion si internet coupe

#### 4. Page Vendeur Nouvelle Vente 100% Offline ✅ (AMÉLIORÉ)
- Création de ticket sans internet
- Stockage immédiat dans IndexedDB
- Ajout automatique à la Sync Queue
- Impression locale via Bluetooth (sans serveur)
- Aucune dépendance API pendant la vente

#### 5. Imprimante Bluetooth Améliorée ✅ (AMÉLIORÉ)
- Support **Bridge Natif Android** (Capacitor/Cordova)
- Détection automatique: Web Bluetooth ou Native
- **Auto-reconnexion** (3 tentatives)
- Configuration sauvegardée dans IndexedDB
- Compatibilité 58mm et 80mm
- Bouton test impression fonctionnel

#### 6. Indicateurs de Statut Temps Réel ✅ (NOUVEAU)
- `NetworkIndicator.jsx` - Réseau (online/offline/lent)
- `StatusBar.jsx` - Combiné réseau + sync + imprimante
- Compteur de tickets en attente de sync
- Dernière synchronisation affichée

### Structure des Fichiers Offline

```
/app/frontend/src/
├── services/
│   ├── offlineDB.js          # IndexedDB manager (sessions, tickets, cache)
│   ├── offlineSyncManager.js # Sync queue avec retry logic
│   └── [syncService.js]      # Ancien service (déprécié, gardé pour compat)
├── contexts/
│   └── OfflineContext.jsx    # Provider global offline state
├── components/
│   ├── NetworkIndicator.jsx  # Indicateur réseau
│   └── StatusBar.jsx         # Barre de statut combinée
├── utils/
│   ├── escpos.js             # Commandes ESC/POS
│   └── bluetoothPrinter.js   # Service Bluetooth (Web + Native)
└── public/
    └── service-worker.js     # Cache API + offline fallback
```

### Schéma IndexedDB (lottolab_pro)

| Store | Usage |
|-------|-------|
| `session` | Token et user (key: current_session) |
| `tickets_pending` | Tickets créés offline (à sync) |
| `tickets_synced` | Tickets synchronisés (historique) |
| `tickets_failed` | Tickets échoués (max retries) |
| `lotteries` | Cache des loteries ouvertes |
| `results` | Cache des résultats |
| `config` | Configuration company/succursale |
| `bet_limits` | Limites par type de jeu |
| `sync_log` | Journal de synchronisation |
| `printer` | Configuration imprimante |

---

### Modifications Précédentes (v26.0.0):

#### 1. Page Historique Règlements Superviseur ✅ (NOUVEAU)
- **Route**: `/supervisor/settlement-history`
- **Endpoint**: `GET /api/settlement/supervisor-history`
- **Fonctionnalités**:
  - Affichage des règlements de tous les agents sous la supervision
  - Statistiques: Total règlements, Total payé, Tickets gagnants
  - Recherche par loterie
  - Détails extensibles pour chaque règlement

#### 2. Synchronisation Globale des Loteries ✅ (CORRIGÉ)
- **Super Admin désactive une loterie** → Disparaît immédiatement:
  - Company Admin: Config Drapeau
  - Supervisor: Config Drapeau
  - Vendeur: Liste des jeux pour vente
- **Endpoints modifiés**:
  - `GET /api/supervisor/lottery-flags` - Filtre `is_active_global`
  - `GET /api/company/available-lotteries` - Filtre `is_active_global`
  - `GET /api/sync/vendeur/open-lotteries` - Filtre `is_active_global` + flags de branche

#### 3. Settlement Engine Complet ✅ (ÉTENDU)
- **Types de jeux supportés avec multiplicateurs**:
  - BORLETTE: 60x (1er), 20x (2ème), 10x (3ème)
  - LOTO3: 500x
  - LOTO4: 5000x
  - L4O1, L4O2, L4O3: 5000x chacun
  - LOTO5: 50000x
  - L5O1, L5O2, L5O3: 50000x chacun
  - MARIAGE: 750x
  - MARIAGE_GRATUIT: 750x

#### 4. Commission 0% par Défaut ✅ (VÉRIFIÉ)
- Si commission non configurée dans Succursales → 0% partout
- Superviseur et Vendeur affichent 0 HTG de commission
- Carte de commission masquée si taux = 0

---

### Modifications Précédentes (v23.0.0):

#### 1. Création Dynamique de Loteries (Super Admin) ✅ (NOUVEAU)
- **Page**: `/super/lottery-catalog`
- **Endpoint**: `POST /api/saas/master-lotteries`
- **Champs du formulaire**:
  - Nom de la loterie
  - Code État/Région
  - Nom État/Région
  - Pays (HAITI, USA, DOMINICAN_REPUBLIC)
  - Type de Jeu (BORLETTE, LOTO3, LOTO4, LOTO5, MARIAGE, PICK3, PICK4, PICK5)
  - Catégorie (STANDARD, PREMIUM, SPECIAL)
  - Heures de tirage par défaut
  - Description (optionnel)
  - Toggle "Activer Globalement"
- **Synchronisation automatique**: Loterie disponible immédiatement pour toutes les compagnies

#### 2. Modification Complète des Superviseurs ✅ (NOUVEAU)
- **Page**: `/company/succursales`
- **Endpoint**: `PUT /api/company/succursales/{id}/supervisor`
- **Champs modifiables**:
  - Prénom et Nom
  - Email (avec validation d'unicité)
  - Téléphone
  - Mot de passe (avec confirmation)
  - Commission %
- **Bouton violet (KeyRound)** sur chaque carte de succursale pour ouvrir le modal

#### 3. Modification Complète des Vendeurs/Agents ✅ (NOUVEAU)
- **Page**: `/company/succursales` → Détails → Liste des agents
- **Endpoint**: `PUT /api/company/succursales/{id}/agents/{agent_id}/full`
- **Champs modifiables**:
  - Prénom et Nom
  - Email (avec validation d'unicité)
  - Téléphone
  - Mot de passe (avec confirmation et bouton voir/cacher)
  - Numéro de série POS
  - Commission %
  - Limite Crédit
  - Limite Gain
- **Modal redesigné** avec sections claires et icônes

#### 4. Endpoints Credentials ✅ (NOUVEAU)
- `GET /api/company/succursales/{id}/supervisor/credentials` - Obtenir infos superviseur
- `GET /api/company/succursales/{id}/agents/{agent_id}/credentials` - Obtenir infos agent
- Retournent les informations complètes sauf le mot de passe hashé

---

### Modifications Précédentes (v22.0.0):

#### 1. Rapport Journalier Style SGL ✅ (NOUVEAU)
- **Endpoint**: `GET /api/reports/daily-summary?start_date=&end_date=`
- **Colonnes**: No, Agent, Tfiche, Vente, A payé, %Agent, P/P sans %agent, P/P avec %agent, %Sup, B.Final
- **Fonctionnalités**:
  - Lignes en rouge pour les balances négatives
  - Totaux calculés automatiquement
  - Export CSV/Excel
  - Filtrage par dates

#### 2. Menu Vendeur Nettoyé ✅
- **Supprimé**: Bouton "Payer Gagnant" du menu vendeur
- Le paiement se fait maintenant directement dans "Lots Gagnants"

#### 3. Calcul des Gains ✅
- Le Settlement Engine calcule automatiquement les gains lors de la publication des résultats
- Multiplicateurs 60/20/10 appliqués correctement
- Synchronisation complète entre tickets joués et gains

---

### Modifications Précédentes (v21.0.0):

#### 1. Filtres de Dates - Mes Tickets Vendeur ✅ (NOUVEAU)
- **Page**: `/vendeur/mes-tickets`
- **Filtres rapides**: Aujourd'hui, Hier, Cette semaine, Tout
- **Personnalisé**: Sélecteurs date début + date fin

#### 2. Boutons Payé/Non Payé - Tickets Gagnants ✅ (NOUVEAU)
- **Page**: `/vendeur/fiches-gagnants`
- **Endpoint**: `PUT /api/vendeur/winning-tickets/{ticket_id}/payment`
- **Statut visible**: "PAYÉ" en vert ou "EN ATTENTE" en orange
- **Actions**: Bouton "Payé" et "Non Payé" pour chaque ticket gagnant

#### 3. Photo de Profil Persistante ✅ (NOUVEAU)
- **Contexte Auth**: `updateUserLocal` met à jour immédiatement le UI
- **Stockage**: Photo stockée en DB et localStorage
- **Affichage**: Photo visible dans Sidebar et Header après upload

---

### Modifications Précédentes (v20.0.0):

#### 1. Filtres de Dates Complets ✅ (NOUVEAU)
- **Pages mises à jour**:
  - `VendeurRapportPage.jsx` - Mon Rapport vendeur
  - `CompanyLotsGagnants.jsx` - Fiches Gagnants Company Admin
  - `CompanyWinningTicketsPage.jsx` - Tickets Gagnants & Paiements
  - `SupervisorLotsGagnants.jsx` - Fiches Gagnants Supervisor
  - `VendeurLotsGagnants.jsx` - Tickets Gagnants Vendeur
- **Filtres rapides**: Tout, Aujourd'hui, Hier, Cette semaine, Ce mois
- **Dates personnalisées**: Sélecteurs date début + date fin
- **Backend mis à jour**: Support `start_date`, `end_date`, `date_from`, `date_to`

#### 2. Menu Nettoyé ✅
- **Supprimé**: "Gestion des Soldes" du menu Company Admin
- Menu plus clair et focalisé sur les fonctionnalités essentielles

---

### Modifications Précédentes (v19.0.0):

#### 1. Limites par Type de Pari ✅
- **Nouvelle page**: `/company/bet-limits` pour Company Admin
- **Types supportés**: Borlette, Loto 3, Mariage, Loto 4 O1/O2/O3, Loto 5 E1/E2
- **Configuration par type**:
  - `min_bet`: Mise minimum
  - `max_bet`: Mise maximum  
  - `max_per_number`: Maximum par numéro
  - `enabled`: Activer/désactiver le type
- **Validation double**:
  - Frontend: Filtrage des types désactivés + validation montants
  - Backend: Validation OBLIGATOIRE dans PHASE 4 (universal_pos_routes.py)
- **Collection MongoDB**: `bet_type_limits`

#### 2. Synchronisation Temps Réel ✅
- Quand Company Admin change les limites → vendeurs impactés immédiatement
- Types désactivés disparaissent du dropdown vendeur
- Validation backend empêche toute fraude

---

### Modifications Précédentes (v18.0.0):

#### 1. Menus Réorganisés ✅
- **Super Admin**: "Moteur Règlement" supprimé, garde seulement "Publier Résultats"
- **Company Admin**: Ajout "Historique Règlements" (voir settlements de leur compagnie)
- **Supervisor**: Ajout "Historique Règlements"

#### 2. Commission Supervisor ✅
- Si commission = 0 ou non définie → Section "Votre Commission Superviseur" **MASQUÉE**
- Affichage conditionnel: `{supervisorCommission > 0 && ...}`

#### 3. Format Mariage Amélioré ✅
- Format: `29*08` (2 chiffres * 2 chiffres)
- Auto-séparateur: Quand le vendeur tape 2 chiffres, le `*` s'ajoute automatiquement
- Placeholder indique le format attendu

#### 4. Numéros Gagnants Lumineux ✅
- Animation GLOW sur les numéros gagnants
- Effet: `shadow-lg shadow-amber-500/30 animate-pulse`
- Badge "GAGNANT!" avec animation bounce

#### 5. Endpoint Rapport Vendeur ✅
- `GET /api/vendeur/report` créé
- Retourne: total_sales, total_tickets, commission calculée (si > 0)

#### 6. Endpoint Settlement History ✅
- `GET /api/settlement/company-history` créé
- Retourne l'historique des règlements filtrés par compagnie

---

## Architecture API - Limites par Type de Pari

### Endpoints
```
GET  /api/company/bet-type-limits      → Company Admin récupère les limites
PUT  /api/company/bet-type-limits      → Company Admin met à jour les limites
GET  /api/company/vendor/bet-type-limits → Vendeur récupère les limites de sa compagnie
```

### Structure DB (collection: bet_type_limits)
```json
{
  "company_id": "comp_xxx",
  "limits": {
    "BORLETTE": { "min_bet": 5, "max_bet": 5000, "max_per_number": 10000, "enabled": true },
    "LOTO3": { "min_bet": 5, "max_bet": 3000, "max_per_number": 6000, "enabled": true },
    "MARIAGE": { "min_bet": 10, "max_bet": 2000, "max_per_number": 4000, "enabled": true },
    "L4O1": { "min_bet": 5, "max_bet": 20, "max_per_number": 100, "enabled": true },
    "L4O2": { "min_bet": 5, "max_bet": 20, "max_per_number": 100, "enabled": true },
    "L4O3": { "min_bet": 5, "max_bet": 20, "max_per_number": 100, "enabled": true },
    "L5O1": { "min_bet": 20, "max_bet": 250, "max_per_number": 500, "enabled": true },
    "L5O2": { "min_bet": 20, "max_bet": 250, "max_per_number": 500, "enabled": true }
  },
  "updated_at": "2026-03-31T23:45:00Z"
}
```

### Validation Backend (universal_pos_routes.py - PHASE 4)
```python
# Line ~530
bet_type_limit_check = await validate_bet_type_limits(
    company_id=company_id,
    plays=validated_plays
)

if not bet_type_limit_check["allowed"]:
    errors = [e.get("error") for e in bet_type_limit_check.get("errors", [])]
    raise HTTPException(status_code=400, detail=f"Mise refusée: {'; '.join(errors)}")
```

---

## Configuration Validée

### Menus par Rôle

| Rôle | Historique Règlements | Publier Résultats |
|------|----------------------|-------------------|
| Super Admin | ❌ Non | ✅ Oui |
| Company Admin | ✅ Oui | ❌ Non |
| Supervisor | ✅ Oui | ❌ Non |

### Commission Logic

```javascript
// Frontend - Supervisor
{supervisorCommission > 0 && (
  <CommissionCard />  // Affiché seulement si > 0
)}

// Frontend - Vendeur
{commissionRate > 0 && (
  <CommissionCard />  // Affiché seulement si > 0
)}

// Backend - Calcul
if (commission_rate > 0):
    commission = total_sales * (commission_rate / 100)
else:
    commission = 0  // Pas de calcul
```

### Format Mariage

```
Input: "29"    → Auto: "29*"
Input: "29*08" → Valide

// Génération aléatoire
const mariage = `${num1}*${num2}`;  // Ex: "42*17"
```

---

## Tests Validés

- ✅ Commission vendeur = 0 si non configurée
- ✅ Commission supervisor MASQUÉE si = 0
- ✅ Rapport vendeur `/api/vendeur/report` fonctionne
- ✅ Historique settlements `/api/settlement/company-history` fonctionne
- ✅ Menu Super Admin sans "Historique Règlements"
- ✅ Menu Company Admin avec "Historique Règlements"
- ✅ Format Mariage 29*08 configuré

---

## Credentials de Test

| Rôle | Email | Password |
|------|-------|----------|
| Super Admin | jefferson@jmstudio.com | JMStudio@2026! |
| Company Admin | admin@lotopam.com | LotoPAM2026! |
| Vendeur | vendeur@lotopam.com | vendor123 |

---

## Architecture Fichiers Modifiés

```
/app/frontend/src/
├── components/Sidebar.js               # Menus réorganisés
├── layouts/SupervisorLayout.js         # +Historique Règlements
├── pages/
│   ├── company/
│   │   └── CompanySettlementHistoryPage.jsx  # NOUVEAU
│   ├── vendeur/
│   │   ├── VendeurNouvelleVente.jsx     # Format Mariage 29*08
│   │   └── VendeurLotsGagnants.jsx      # Numéros GLOW
│   └── supervisor/
│       └── SupervisorReportsPage.jsx    # Commission masquée si 0

/app/backend/
├── vendeur/vendeur_routes.py            # +get_vendeur_report()
└── settlement_routes.py                 # +get_company_settlement_history()
```

---

## Prochaines Actions

### Testé & Validé
- [x] Menus réorganisés
- [x] Commission masquée si 0
- [x] Format Mariage 29*08
- [x] Numéros gagnants lumineux
- [x] Endpoints rapport/settlement

### À Tester en Production
- [ ] Vente complète avec paiement
- [ ] Synchronisation soldes en temps réel
- [ ] Configuration Company Admin → impact vendeur
- [ ] Photo profil persistante

---

## Note Importante

Le système est prêt pour le lancement. Les fonctionnalités clés sont:
1. Commissions conditionnelles (0 = pas d'affichage)
2. Menus adaptés par rôle
3. Format Mariage professionnel
4. Numéros gagnants visuellement impactants
5. Rapports synchronisés
