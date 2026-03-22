# LOTTOLAB - Product Requirements Document
**Version**: 12.2.0  
**Date**: 22 Mars 2026  
**Status**: Production Ready - Configuration Ticket Complète

---

## 1. Nouvelles Corrections v12.2.0 (Cette Session)

### ✅ Page Configuration Entreprise Complète
- **Adresse** - Champ ajouté dans les paramètres Company Admin
- **Téléphone** - Champ ajouté dans les paramètres Company Admin  
- **QR Code Toggle** - Activer/Désactiver le QR code sur le ticket
- **Texte en Haut du Ticket** - Personnalisable par Company Admin
- **Texte en Bas du Ticket** - Personnalisable par Company Admin
- **Logo Entreprise** - Upload et affichage sur les tickets

### ✅ Ticket Imprimé - Synchronisation Complète
Les informations suivantes s'affichent maintenant sur les tickets imprimés:
- Logo de l'entreprise (si configuré)
- Nom de l'entreprise
- Téléphone de l'entreprise (Tél: +509 xxxx-xxxx)
- Adresse de l'entreprise
- Texte personnalisé en haut (sous le logo)
- Texte personnalisé en bas (avant les mentions légales)
- QR Code pour vérification (si activé)
- Statut "VALIDÉ"
- Mentions légales complètes
- LOTTOLAB.TECH en bas

### ✅ Templates Ticket Unifiés
Les deux fichiers de génération de tickets ont été mis à jour:
- `ticket_print_routes.py` (tickets en ligne)
- `sync_routes.py` (tickets POS/offline)

### ✅ Tests Passés
- 10/10 tests backend
- 100% vérification frontend
- 56 loteries ouvertes sur 236

---

## 2. Fonctionnalités v12.1.0 (Session Précédente)

### ✅ Ticket Imprimé - Modifications
- **POS ID remplacé par SUCCURSALE** - Plus sécurisé
- **"JM STUDIO" supprimé** - Remplacé par nom compagnie
- **Logo compagnie en haut** - Configurable via `/api/company/profile`
- **"Gain potentiel" SUPPRIMÉ** - N'apparaît plus sur le ticket
- **LOTTOLAB.TECH en bas** - Après les mentions légales
- **Statut "VALIDÉ"** - Au lieu de "ACTIF"
- **Mentions légales complètes**:
  - Vérifiez ticket avant de vous déplacer
  - Payé UNE SEULE FOIS dans les 90 jours
  - Premier présentateur = bénéficiaire
  - Numéro effacé = non payé
  - Protéger de chaleur/humidité
  - Ne pas garder dans les pièces de monnaie

### ✅ Commission = 0 par défaut
- Si Supervisor/Admin n'a pas configuré le pourcentage → Vendeur = 0% commission
- La commission se calcule UNIQUEMENT si explicitement définie via `agent_policies`

### ✅ Fuseau Horaire Synchronisé
- Ticket imprimé utilise l'heure Haiti (America/Port-au-Prince)
- Consistant entre page vendeur et ticket

---

## 3. Endpoints API Configuration Entreprise

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/company/profile` | Obtenir tous les paramètres entreprise |
| PUT | `/api/company/profile` | Modifier les paramètres (nom, téléphone, adresse, etc.) |
| GET | `/api/ticket/print/{ticket_id}` | Générer le ticket HTML avec toutes les personnalisations |
| GET | `/api/verify-ticket/{verification_code}` | Page publique de vérification du ticket |

### Champs de l'endpoint /api/company/profile:
```json
{
  "company_id": "string",
  "company_name": "string",
  "company_phone": "string",
  "company_email": "string",
  "company_address": "string",
  "company_logo_url": "string",
  "display_logo_url": "string",
  "ticket_header_text": "string",
  "ticket_footer_text": "string",
  "qr_code_enabled": true,
  "currency": "HTG",
  "timezone": "America/Port-au-Prince"
}
```

---

## 4. Types de Mise Disponibles (Vendeur)

| Type | Description | Cases |
|------|-------------|-------|
| Borlette | Standard | 1 |
| Loto 3 | 3 chiffres | 1 |
| Loto 4 - Option 1 | 4 chiffres | 2 |
| Loto 4 - Option 2 | 4 chiffres | 2 |
| Loto 4 - Option 3 | 4 chiffres | 2 |
| Loto 5 - Extra 1 (1+2) | 5 chiffres | 2 |
| Loto 5 - Extra 2 (1+3) | 5 chiffres | 2 |
| Mariage | Combinaison | 1 |

---

## 5. Comptes de Test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@lottolab.com | 123456 |
| Company Admin | admin@lotopam.com | Admin123! |
| Supervisor | supervisor@lotopam.com | Supervisor123! |
| Vendeur | vendeur@lotopam.com | Vendeur123! |

---

## 6. Statistiques Loteries

- Total Loteries: 236
- Loteries Haiti: 26 (dont Plop Plop et Loto Rapid)
- Loteries USA: 210
- Loteries ouvertes actuellement: 56
- Tirages par jour: Matin, Midi, Soir, Nuit

---

## 7. Tâches Restantes (Backlog)

### ✅ TERMINÉ
- [x] Configuration complète du ticket (Adresse, Téléphone, QR Code)
- [x] Texte haut/bas personnalisable
- [x] QR Code toggle
- [x] Synchronisation ticket imprimé avec les paramètres
- [x] Cases "Payé/Non Payé" sur tickets gagnants
- [x] Limites de mise max (Loto4: 20 HTG, Loto5: 250 HTG)
- [x] Logique 60/20/10 pour les gains
- [x] Page "Fiches Jouées" corrigée
- [x] Mariage Gratis auto (100=1, 150=2, 200=2, 250=3, 300=3)
- [x] Minimum 1 HTG pour vendeur
- [x] Statut "Validé" au lieu de "En attente"
- [x] Résultats auto Plop Plop / Loto Rapid
- [x] Page programmation résultats Super Admin
- [x] Tirage Matin ajouté
- [x] Activity Logs fonctionnel
- [x] Logo compagnie sur ticket
- [x] Fuseau horaire ticket
- [x] Commission vendeur 0% par défaut

### P2 - Refactoring
- [ ] Unifier les templates de tickets (Jinja2 ou fonction partagée)
- [ ] Nettoyer la duplication de code ticket_print_routes.py / sync_routes.py

### P2 - Tâches Futures
- [ ] Support multi-langue (Espagnol, Anglais)
- [ ] Mode hors ligne pour vendeurs
- [ ] APK dédiée pour appareils POS

---

## 8. Architecture Technique

### Structure des fichiers clés:
```
/app
├── backend/
│   ├── server.py                   # Main entry, APScheduler init
│   ├── company_routes.py           # Company profile & settings APIs
│   ├── sync_routes.py              # POS sync + offline ticket HTML
│   ├── ticket_print_routes.py      # Online ticket HTML generation
│   ├── scheduled_results_routes.py # Auto-results for rapid lotteries
│   └── vendeur/vendeur_routes.py   # Seller dashboard & commission
├── frontend/
│   ├── src/pages/
│   │   ├── company/CompanySettingsPage.jsx   # Ticket customization
│   │   ├── vendeur/VendeurNouvelleVente.jsx  # Cart logic
│   │   └── SuperScheduledResultsPage.jsx     # Super admin schedules
```

### Base de données (MongoDB)
- `lottery_transactions`: Tous les tickets vendus
- `companies`: Paramètres entreprise (logo, téléphone, adresse, etc.)
- `global_schedules`: Horaires des tirages
- `agent_policies`: Politiques vendeur (commission, limites)

---

## 9. Support

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48
