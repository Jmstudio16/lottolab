# LOTTOLAB - Product Requirements Document
**Version**: 11.0.0  
**Date**: 22 Mars 2026  
**Status**: Production Ready - Nouvelles fonctionnalités de gestion des paiements

---

## 1. Nouvelles Fonctionnalités Implémentées (v11.0.0)

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

## 6. Tâches Restantes (Backlog)

### P1 - Prochaines Tâches
- [ ] Statut ticket "Actif" au lieu de "En attente" après impression
- [ ] Interface Company Admin pour configurer les limites de mise

### P2 - Tâches Futures
- [ ] Support multi-langue (Espagnol, Anglais)
- [ ] Mode hors ligne pour vendeurs
- [ ] APK dédiée pour appareils POS

---

## 7. Déploiement

**IMPORTANT**: Après ces modifications, vous devez REDÉPLOYER sur Emergent pour que les changements soient appliqués sur lottolab.tech.

Cliquez sur "Deploy" dans l'interface Emergent.

---

## 8. Support

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48
