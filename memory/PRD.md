# LOTTOLAB - Product Requirements Document
**Version**: 10.0.0  
**Date**: 20 Mars 2026  
**Status**: Production Ready - Nouvelles fonctionnalités ajoutées

---

## 1. Nouvelles Fonctionnalités Implémentées (v10.0.0)

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
| Vendeur | vendeur@lotopam.com | Vendeur123! |

---

## 4. Statistiques

- Total Loteries: 236
- Loteries Haiti: 26 (dont Plop Plop et Loto Rapid)
- Loteries USA: 210
- Tirages par jour: Matin, Midi, Soir, Nuit

---

## 5. Déploiement

**IMPORTANT**: Après ces modifications, vous devez REDÉPLOYER sur Emergent pour que les changements soient appliqués sur lottolab.tech.

Cliquez sur "Deploy" dans l'interface Emergent.

---

## 6. Support

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48
