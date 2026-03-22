# LOTTOLAB - Product Requirements Document
**Version**: 12.1.0  
**Date**: 22 Mars 2026  
**Status**: Production Ready - Corrections Ticket + Commission

---

## 1. Nouvelles Corrections v12.1.0 (Cette Session)

### ✅ Ticket Imprimé - Modifications
- **POS ID remplacé par SUCCURSALE** - Plus sécurisé
- **"JM STUDIO" supprimé** - Remplacé par nom compagnie
- **Logo compagnie en haut** - S'affiche si configuré (logo_url)
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

## 2. Fonctionnalités v12.0.0 (Session Précédente)

### ✅ Mariage Gratis - Nouveaux Seuils
- 100 HTG = 1 mariage gratis
- 150 HTG = 2 mariages gratis
- 200 HTG = 2 mariages gratis
- 250 HTG = 3 mariages gratis
- 300 HTG = 3 mariages gratis

### ✅ Mise Minimum Vendeur
- Minimum de 1 HTG pour toutes les mises (sauf Loto 5 = 20 HTG min)
- Maximum configurable par Company Admin

### ✅ Statut Ticket "Validé"
- Les tickets affichent maintenant "Validé" au lieu de "En attente"
- Cohérent sur toutes les pages (Dashboard, Fiches Jouées, etc.)

### ✅ Résultats Automatiques - Plop Plop & Loto Rapid
- **Plop Plop**: Résultats toutes les heures (8h-21h), fermeture 55 min avant
- **Loto Rapid**: Résultats toutes les 2h (8h, 10h, 12h...), fermeture 5 min avant
- Génération automatique de numéros aléatoires si non programmés
- Le Super Admin peut programmer les résultats à l'avance
- Nouvelle page: `/super/scheduled-results`

### ✅ Tirage Matin Ajouté
- Ajout du tirage "Matin" à toutes les loteries Haiti
- Horaire: Ouverture 7h00, Fermeture 10h55, Tirage 11h00

### ✅ Activity Logs Fonctionnel
- Page Activity Logs opérationnelle pour Super Admin
- Filtre par type d'action et entité
- Audit trail complet du système

### ✅ Logo Compagnie sur Ticket
- Le logo de la compagnie s'affiche maintenant sur le ticket imprimé
- Configurable via `logo_url` dans les settings compagnie

### ✅ Fuseau Horaire Ticket Corrigé
- L'heure sur le ticket correspond au fuseau horaire Haiti (UTC-5)
- Utilise `America/Port-au-Prince`

---

## 2. Fonctionnalités v11.0.0 (Session Précédente)

### ✅ Cases "Payé/Non Payé" sur Tickets Gagnants
- Ajout de boutons "Payé" et "Non Payé" sur les tickets gagnants
- Visible dans les pages Supervisor et Company Admin
- **Seuls les Superviseurs et Company Admins peuvent modifier le statut**
- Le vendeur ne peut PAS modifier le statut de paiement
- Statut visible dans les rapports avec compteurs (Payés / Non Payés)
- Filtre par statut de paiement (Tous / Payés / Non Payés)

### ✅ Limites de Mise Maximales
- **Loto 4**: Maximum 20 HTG (configurable par Company Admin)
- **Loto 5**: Maximum 250 HTG (configurable par Company Admin)
- Validation backend et frontend
- Endpoint `/api/company/bet-limits` pour GET/PUT des limites

### ✅ Logique de Paiement 60/20/10
- Multiplicateurs de gains mis à jour:
  - 1er prix: x60 (au lieu de x50)
  - 2ème prix: x20
  - 3ème prix: x10
- S'applique aux types: Borlette, Loto 3, Pick 3

### ✅ Page "Fiches Jouées" Corrigée
- Endpoint corrigé: `/api/company/admin/fiches-jouees`
- Utilise maintenant `lottery_transactions` au lieu de `tickets`
- Affiche les numéros joués avec montants
- Filtres par période et statut

### ✅ Correction Fuseau Horaire Tickets
- L'heure sur les tickets imprimés utilise maintenant le fuseau horaire Haiti
- Par défaut: America/Port-au-Prince (UTC-5)

---

## 2. Fonctionnalités v10.0.0 (Session Précédente)

### ✅ WhatsApp Button
- Affiché UNIQUEMENT sur la page `/home`
- Supprimé de toutes les autres pages (super admin, company admin, superviseur, vendeur)

### ✅ Loteries Fermées Cachées
- La section "Non disponibles" a été supprimée de la page vendeur
- Seules les loteries OUVERTES sont affichées

### ✅ 2 Nouvelles Loteries Haiti
- **Plop Plop** - Résultat chaque heure (8h à 21h)
- **Loto Rapid** - Résultat chaque 2 heures (8h, 10h, 12h, 14h, 16h, 18h, 20h)
- Total: 236 loteries (26 Haiti, 210 USA)

### ✅ Tirage Matin Ajouté
- Ouverture: 7h00
- Fermeture: 10h55
- Tirage: 11h00
- Ajouté à toutes les loteries Haiti

### ✅ Mariages Gratis Automatique
- Bouton "Mariage Gratis" SUPPRIMÉ du vendeur
- Maintenant automatique selon le total de la vente:
  - 50 HTG = 1 mariage gratis
  - 100 HTG = 2 mariages gratis
  - 150 HTG = 3 mariages gratis
- Company Admin peut configurer les seuils

### ✅ Loto 4 avec 3 Options
- Loto 4 - Option 1 (2 cases pour numéros)
- Loto 4 - Option 2 (2 cases pour numéros)
- Loto 4 - Option 3 (2 cases pour numéros)

### ✅ Loto 5 avec 2 Options
- Loto 5 - Extra 1 (1+2) - 2 cases pour numéros
- Loto 5 - Extra 2 (1+3) - 2 cases pour numéros

### ✅ Texte Ticket Haut/Bas
- Company Admin peut définir le texte en haut du ticket
- Company Admin peut définir le texte en bas du ticket
- Synchronisé automatiquement avec les vendeurs

---

## 2. Types de Mise Disponibles (Vendeur)

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

## 3. Comptes de Test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@lottolab.com | 123456 |
| Company Admin | admin@lotopam.com | Admin123! |
| Supervisor | supervisor@lotopam.com | Supervisor123! |
| Vendeur | vendeur@lotopam.com | Vendeur123! |

---

## 4. Nouveaux Endpoints API (v11.0.0)

### Gestion des Tickets Gagnants (Company Admin)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/company/winning-tickets` | Liste tickets gagnants avec payment_status |
| GET | `/api/company/winning-tickets?payment_status=PAID` | Filtre payés |
| GET | `/api/company/winning-tickets?payment_status=UNPAID` | Filtre non payés |
| PUT | `/api/company/winning-tickets/{id}/payment-status` | Mettre à jour statut |

### Gestion des Tickets Gagnants (Supervisor)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/supervisor/winning-tickets` | Liste tickets gagnants des agents |
| PUT | `/api/supervisor/winning-tickets/{id}/payment-status` | Mettre à jour statut |

### Limites de Mise
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/company/bet-limits` | Obtenir limites Loto4/Loto5 |
| PUT | `/api/company/bet-limits` | Modifier limites |

### Fiches Jouées
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/company/admin/fiches-jouees` | Liste des tickets joués |
| GET | `/api/company/admin/fiches-jouees/search?code=XXX` | Rechercher un ticket |

---

## 5. Statistiques

- Total Loteries: 236
- Loteries Haiti: 26 (dont Plop Plop et Loto Rapid)
- Loteries USA: 210
- Tirages par jour: Matin, Midi, Soir, Nuit

---

## 7. Tâches Restantes (Backlog)

### ✅ TERMINÉ
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

### P2 - Tâches Futures
- [ ] Support multi-langue (Espagnol, Anglais)
- [ ] Mode hors ligne pour vendeurs
- [ ] APK dédiée pour appareils POS

---

## 8. Déploiement

**IMPORTANT**: Après ces modifications, vous devez REDÉPLOYER sur Emergent pour que les changements soient appliqués sur lottolab.tech.

Cliquez sur "Deploy" dans l'interface Emergent.

---

## 9. Endpoints Résultats Programmés (Super Admin)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/scheduled-results/list` | Liste des résultats programmés |
| POST | `/api/scheduled-results/program` | Programmer un nouveau résultat |
| PUT | `/api/scheduled-results/{id}` | Modifier un résultat programmé |
| DELETE | `/api/scheduled-results/{id}` | Annuler un résultat programmé |

---

## 10. Support

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48
