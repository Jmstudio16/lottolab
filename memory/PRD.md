# LOTTOLAB - Product Requirements Document
**Version**: 15.0.0  
**Date**: 25 Mars 2026  
**Status**: ✅ SYSTÈME MULTILINGUE 100% COMPLET

---

## 🚀 INSTRUCTIONS DE DÉPLOIEMENT

**Déployez le code sur lottolab.tech - Tout s'initialise AUTOMATIQUEMENT!**

---

## ✅ NOUVELLES FONCTIONNALITÉS (v15.0.0)

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
