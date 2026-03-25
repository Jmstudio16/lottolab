# LOTTOLAB - Product Requirements Document
**Version**: 17.0.0  
**Date**: 25 Mars 2026  
**Status**: ✅ SYSTÈME MULTILINGUE 100% COMPLET - PRÊT POUR DÉPLOIEMENT

---

## 🚀 INSTRUCTIONS DE DÉPLOIEMENT

**Déployez le code sur lottolab.tech - Tout s'initialise AUTOMATIQUEMENT!**

---

## ✅ NOUVELLES FONCTIONNALITÉS (v17.0.0) - 25 Mars 2026

### 🌍 Système Multilingue 100% Complet

**4 Langues Supportées**:
- 🇫🇷 Français (fr)
- 🇭🇹 Créole Haïtien (ht)
- 🇺🇸 English (en)
- 🇪🇸 Español (es)

**Couverture Complète**:
- ✅ Page de login traduite avec sélecteur de langue
- ✅ Tous les menus et sous-menus traduits
- ✅ Tous les boutons et formulaires traduits
- ✅ Tous les messages d'erreur et notifications traduits
- ✅ Tous les dashboards (Super Admin, Company Admin, Superviseur, Vendeur)
- ✅ Changement de langue en temps réel sans rechargement

**Fichiers de traduction** (`/app/frontend/src/i18n/locales/`):
- `fr.json` - 400+ clés de traduction
- `ht.json` - 400+ clés de traduction
- `en.json` - 400+ clés de traduction
- `es.json` - 400+ clés de traduction

### ⏰ Horaires d'Ouverture/Fermeture des Loteries

**Configuration dans `global_schedules`**:
- Midi: ouvre 06:00, ferme 12:15/13:15, tirage 12:30/13:30
- Soir: ouvre 12:00, ferme 21:30/22:15, tirage 21:45/22:30
- Matin: configurable par Super Admin

**Comportement**:
- ✅ Loteries affichent "Ouvert (Xh restant)" avec temps restant
- ✅ Ventes automatiquement bloquées après fermeture
- ✅ Message "Fermé" affiché pour loteries hors horaires
- ✅ Filtres par pays (Haiti 🇭🇹, USA 🇺🇸)

### 💰 Limites de Mise Contrôlées par Admin

**Configuration**:
- `min_bet_amount`: 1 HTG (obligatoire)
- `max_bet_amount`: 999999 HTG (configurable par Company Admin)
- `max_per_number`: configurable
- `max_per_ticket`: configurable

**Synchronisation**:
- ✅ Limites configurées via Company Admin Settings
- ✅ Limites synchronisées en temps réel via `/api/device/config`
- ✅ Validation automatique côté vendeur
- ✅ Messages d'erreur si limite dépassée

### 🔄 Synchronisation Totale du Système

**Éléments synchronisés entre tous les rôles**:
- ✅ Traductions (langue sauvegardée par utilisateur)
- ✅ Primes (Configuration des Primes)
- ✅ Loteries activées (236 loteries)
- ✅ Horaires (ouverture/fermeture/tirage)
- ✅ Limites de mise
- ✅ Résultats
- ✅ Calcul des gains (PayoutEngine)

---

## ✅ FONCTIONNALITÉS v16.0.0 (Session précédente)

### 🎰 Moteur de Calcul Automatique des Gains (PayoutEngine)

**Backend - `/app/backend/payout_engine.py`**:
- ✅ **Borlette 60|20|10**: 
  - Extraction automatique des 2 derniers chiffres du 1er prix
  - 1er rang = mise × 60, 2ème rang = mise × 20, 3ème rang = mise × 10
- ✅ **Loto 3**: Match exact des 3 chiffres × prime configurée (défaut: 500)
- ✅ **Loto 4**: Match exact des 4 chiffres × prime configurée (défaut: 5000)
- ✅ **Loto 5**: Match exact des 5 chiffres × prime configurée (défaut: 50000)
- ✅ **Mariage**: 2 numéros combinés × prime configurée (défaut: 750)
- ✅ **Mariage Gratuit**: Même logique que Mariage

**Exemple de calcul vérifié**:
- Résultat: 1er=123, 2ème=45, 3ème=78
- Joueur mise 10 HTG sur "23" (Borlette) → Gagne 600 HTG (23 = derniers chiffres de 123)
- Joueur mise 10 HTG sur "45" (Borlette) → Gagne 200 HTG (2ème rang)
- Joueur mise 10 HTG sur "123" (Loto3) → Gagne 5000 HTG (match exact)

### 💰 Configuration des Primes par Company Admin

**Page Paramètres** (`/company/profile-settings`):
- ✅ Section "Configuration des Primes" avec 6 champs:
  - Prime Borlette (format: 60|20|10)
  - Prime Loto 3 (défaut: 500)
  - Prime Loto 4 (défaut: 5000)
  - Prime Loto 5 (défaut: 50000)
  - Prime Mariage (défaut: 750)
  - Prime Mariage Gratuit (défaut: 750)
- ✅ Bouton "Enregistrer les primes" (jaune)
- ✅ Boîte d'info explicative

**APIs**:
- `GET /api/company/primes` - Récupère les primes de la compagnie
- `PUT /api/company/primes` - Met à jour les primes
- `GET /api/company/primes/display` - Primes formatées pour le vendeur

### 🔧 Bug Fix: enabled_lotteries: 0

**Problème**: Les compagnies affichaient "enabled_lotteries: 0" bloquant les ventes.

**Solution** (`/app/backend/lottery_sync_service.py`):
- ✅ Synchronisation automatique au démarrage du serveur
- ✅ API `/api/company/sync-lotteries` pour sync manuelle
- ✅ API `/api/lottery-sync/repair-company/{company_id}` pour réparer une compagnie
- ✅ **Résultat**: 236 loteries activées (était 0)

### 📦 Snapshot des Primes à la Vente

- ✅ La prime active au moment de la vente est sauvegardée sur chaque jeu du ticket
- ✅ Champ `prime_at_sale` dans la structure `plays[]`
- ✅ Les changements futurs de prime n'affectent PAS les tickets existants

---

## ✅ FONCTIONNALITÉS v15.0.0 (Session précédente)

### 🌐 Système Multilingue 100% Complet (4 Langues)
- **Français** 🇫🇷 - Langue par défaut
- **Créole Haïtien** 🇭🇹 - Kreyòl Ayisyen
- **Anglais** 🇺🇸 - English
- **Espagnol** 🇪🇸 - Español

**TOUS les éléments traduits:**
- ✅ Menu latéral (Sidebar) - Tous les liens
- ✅ Dashboard Vendeur - Toutes les cartes, labels, titres
- ✅ Page Nouvelle Vente - Formulaire complet
- ✅ Messages d'erreur et de succès
- ✅ Navigation en temps réel (sans rechargement)
- ✅ Persistance en localStorage

### 📍 Nom Succursale sur Tickets
- ✅ Le nom de la succursale apparaît sur TOUS les tickets imprimés
- ✅ Format: "SUCCURSALE: [Nom de la succursale]"
- ✅ Fonctionne avec le champ `nom_succursale` de la collection `succursales`

### 🎰 Loteries Fermées Masquées
- ✅ Seules les loteries OUVERTES sont affichées aux vendeurs
- ✅ Les loteries fermées sont automatiquement cachées
- ✅ Affichage dynamique basé sur `is_open`

### 💰 Limite de Mise Configurable
- **Minimum**: Configurable par Admin Entreprise (défaut: 1 HTG)
- **Maximum**: Configurable par Admin Entreprise
- Affichage dynamique "Min: X HTG" sur la page de vente
- API /api/company/profile pour modifier les limites
- API /api/device/config renvoie les limites à l'appareil POS

### 🔔 Notifications Temps Réel
- Badge compteur sur l'icône cloche
- Liste des notifications avec marquage lu/non-lu
- Bouton "Tout lu" pour marquer tout comme lu
- Coche verte (✓) pour les notifications lues
- Point bleu animé pour les non-lues
- Rafraîchissement auto toutes les 15 secondes

### ⏰ Horloge Temps Réel
- Affichage heure Haiti en temps réel
- Mise à jour chaque seconde
- Format: HH:MM:SS + date

### 🎨 Animations Résultats
- Numéros avec effet bounce
- Hover effects sur les cartes
- Badge "✨ Nouveau" animé
- Point bleu animé à côté des dates

### 🎫 Ticket Personnalisable 100%
- **Texte en Haut**: Message d'accueil
- **Texte en Bas**: Message personnalisé
- **Message de Remerciement**: Texte de fin
- **Mentions Légales**: Entièrement modifiable
- **QR Code**: Toggle on/off
- Tout centré et professionnel

### 📷 Upload Photos
- Logo entreprise: jusqu'à 10MB
- Photo profil vendeur: jusqu'à 10MB
- Formats: PNG, JPG, WEBP, GIF, SVG
- Toutes dimensions acceptées

---

## ✅ RESPONSIVE MOBILE/TABLETTE/DESKTOP

| Appareil | Menu | Sélecteur Langue | Status |
|----------|------|------------------|--------|
| Mobile (375px) | Hamburger ☰ | Header | ✅ |
| Tablette (768px) | Hamburger ☰ | Header | ✅ |
| Desktop (1920px) | Sidebar complète | Sidebar/Header | ✅ |

---

## ✅ TOUS LES RÔLES

### Super Admin
- Dashboard avec stats
- Companies, Users, Global Schedules (403)
- Haiti Lotteries Init
- Notifications temps réel
- Horloge temps réel
- **Sélecteur de langue** 🌐

### Company Admin
- Dashboard (193 loteries ouvertes)
- Succursales, Catalogue Loteries
- **Configuration Ticket complète**
- **Configuration Limites de Mise**
- Notifications temps réel
- **Sélecteur de langue** 🌐

### Supervisor
- Dashboard, Agents, Rapports
- Notifications temps réel
- **Sélecteur de langue** 🌐

### Vendeur
- Dashboard + Nom Succursale
- Nouvelle Vente (31 loteries, 26 Haiti)
- **Résultats avec animations**
- Upload photo profil 10MB
- Notifications temps réel

---

## 🇭🇹 LOTERIES HAITI (26)

Toutes ouvertes 06:00-23:00:
- Haiti Borlette Midi/Soir
- Haiti Loto 3, 4, 5 Midi/Soir
- Haiti Mariage Midi/Soir
- Tennessee, Texas, Georgia, Florida, New York
- Plop Plop, Loto Rapid (24h)

---

## 🔑 Comptes de Test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@lottolab.com | 123456 |
| Company Admin | admin@lotopam.com | Admin123! |
| Supervisor | supervisor@lotopam.com | Supervisor123! |
| Vendeur | vendeur@lotopam.com | Vendeur123! |

---

## 📁 Fichiers Modifiés (Cette Session)

```
/app/frontend/src/
├── components/Header.js           # Notifications + horloge temps réel
├── pages/vendeur/VendeurResultats.jsx  # Animations
├── pages/company/CompanySettingsPage.jsx  # Champs ticket

/app/backend/
├── company_routes.py              # API ticket customization
├── ticket_print_routes.py         # Template personnalisable
├── sync_routes.py                 # Template personnalisable
├── settings_routes.py             # Upload 10MB
├── vendeur/vendeur_routes.py      # Upload 10MB
```

---

## 📞 Support

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48
- Website: lottolab.tech
