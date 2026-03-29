# LOTTOLAB - Documentation Technique LOT 1-3

## Vue d'ensemble

Ce document décrit les modifications apportées au système de loterie LOTTOLAB pour :
- **LOT 1** : Moteur central de calcul des gains
- **LOT 2** : Synchronisation & publication des résultats
- **LOT 3** : Animation des numéros gagnants

---

## LOT 1 : Moteur Central de Calcul des Gains

### Fichier créé
`/app/backend/winning_engine.py`

### Description
Ce module est le **SEUL point de calcul** pour tous les gains de loterie. Il centralise :
- La lecture des primes (compagnie → globale → défaut)
- Le calcul pour tous les types de jeux
- La détection automatique des gagnants
- La journalisation complète pour audit

### Règle métier 60/20/10
```
1er lot = multiplicateur 60
2e lot = multiplicateur 20
3e lot = multiplicateur 10
```

### Formule de calcul
```
gain = mise × multiplicateur_du_lot
```

### Types de jeux supportés
| Type | Code | Multiplicateurs |
|------|------|-----------------|
| BORLETTE | 20 | 60/20/10 |
| MARIAGE | 40 | 750 |
| LOTO 3 | 30 | 500 |
| LOTO 4 | 41/42/43 | 750 |
| LOTO 5 | 51/52/53 | 750 |

### Fonctions principales

#### `get_payout_config(company_id, bet_type)`
Récupère la configuration de prime avec priorité :
1. Configuration de la compagnie
2. Configuration globale
3. Valeurs par défaut

#### `determine_winning_lot(played_number, winning_numbers, bet_type)`
Détermine si un numéro a gagné et sur quel lot.

Retourne : `1`, `2`, `3` ou `None`

#### `calculate_line_winnings(...)`
Calcule le gain pour une ligne de ticket.

Retourne :
```python
{
    "played_number": "42",
    "bet_type": "BORLETTE",
    "bet_amount": 100.0,
    "winning_lot": 1,
    "multiplier": 60,
    "gain": 6000.0,
    "is_winner": True,
    "status": "WINNER",
    "payout_config": {...}
}
```

#### `calculate_ticket_winnings(ticket, winning_numbers, company_id)`
Calcule les gains pour un ticket complet (toutes les lignes).

Retourne :
```python
{
    "ticket_id": "...",
    "total_bet": 500.0,
    "total_gain": 8000.0,
    "is_winner": True,
    "status": "WINNER",
    "winning_plays": [...],
    "winning_plays_count": 2,
    "all_plays_calculated": [...]
}
```

#### `process_result_and_calculate_winners(result, company_id)`
Traite automatiquement tous les tickets après publication d'un résultat.

### Exemples de calcul

#### Exemple 1 : Borlette 1er lot
```
Numéro joué : 42
Mise : 100 HTG
Résultat : 42-15-88 (42 est en 1er)
Calcul : 100 × 60 = 6000 HTG
```

#### Exemple 2 : Ticket multi-lignes
```
Ticket :
- 42 → 100 HTG (gagne 1er lot)
- 15 → 100 HTG (gagne 2e lot)
- 99 → 100 HTG (perd)

Résultat : 42-15-88

Calcul :
- 42 : 100 × 60 = 6000 HTG
- 15 : 100 × 20 = 2000 HTG
- 99 : 0 HTG

Total : 8000 HTG
```

---

## LOT 2 : Synchronisation & Publication

### Modifications
- `/app/backend/lottery_results_routes.py` : Intégration du moteur central

### Flux de publication
1. Super Admin publie un résultat
2. `process_winning_tickets()` est appelé en background
3. Pour chaque ticket concerné :
   - Appel à `calculate_ticket_winnings()`
   - Mise à jour du statut (WINNER/LOSER)
   - Enregistrement des détails de calcul
4. Journalisation dans `winning_calculations_audit`

### Nouvelles routes API

#### `POST /api/super-admin/recalculate-ticket/{ticket_id}`
Recalcule les gains pour un ticket spécifique.

#### `GET /api/super-admin/test-winning-engine`
Exécute les tests du moteur de calcul.

#### `POST /api/super-admin/reprocess-result/{result_id}`
Retraite tous les tickets pour un résultat publié.

---

## LOT 3 : Animation des Numéros Gagnants

### Fichier créé
`/app/frontend/src/components/WinningNumberBadge.jsx`

### Composants

#### `WinningNumberBadge`
Badge individuel pour un numéro gagnant.

Props :
- `number` : Numéro à afficher
- `position` : 1, 2, ou 3 (lot)
- `animated` : Activer les animations
- `size` : "sm", "md", "lg", "xl"
- `showLabel` : Afficher "1er lot", etc.
- `showBadge` : Afficher badge "GAGNANT"

#### `WinningNumbersRow`
Ligne de 3 numéros gagnants.

Props :
- `winningNumbers` : `{first, second, third}` ou string "42-15-88"
- `animated` : Activer les animations
- `size` : Taille des badges

#### `WinningTicketHighlight`
Encadre un ticket gagnant avec effet visuel.

#### `WinnerIndicator` / `LoserIndicator`
Indicateurs de statut gagnant/perdant.

### Animations CSS
```css
@keyframes winnerPulse { /* Pulsation pour 1er lot */ }
@keyframes winnerGlow { /* Brillance */ }
@keyframes shimmer { /* Effet brillant */ }
@keyframes float { /* Flottement pour 2e/3e lot */ }
```

### Couleurs
- **1er lot** : Or (amber-500) avec pulse
- **2e lot** : Argent (slate-400) avec float
- **3e lot** : Bronze (amber-700) avec float

---

## Collections MongoDB Ajoutées/Modifiées

### `prime_configs`
Configuration des primes par compagnie ou globale.

```javascript
{
    "prime_id": "prime_xxx",
    "company_id": "comp_xxx" | null,  // null = global
    "bet_type": "BORLETTE",
    "bet_code": "20",
    "bet_name": "Borlette",
    "payout_formula": "60|20|10",
    "is_active": true
}
```

### `winning_calculations_audit`
Audit des calculs de gains.

```javascript
{
    "audit_id": "audit_xxx",
    "action": "RESULT_PROCESSED",
    "lottery_id": "...",
    "draw_name": "Midi",
    "winning_numbers": {"first": "42", "second": "15", "third": "88"},
    "processed_tickets": 150,
    "winners": 12,
    "total_payout": 125000.0,
    "created_at": "..."
}
```

### Champs ajoutés aux tickets (`lottery_transactions`)
```javascript
{
    // Existants...
    "status": "WINNER" | "LOSER",
    "is_winner": true,
    "winnings": 6000.0,
    "win_amount": 6000.0,
    "winning_plays": [...],
    "all_plays_calculated": [...],
    "calculation_details": {
        "company_id": "...",
        "winning_numbers": {...},
        "calculated_at": "..."
    },
    "winning_numbers_parsed": {"first": "42", ...},
    "result_processed_at": "...",
    "payment_status": "UNPAID"
}
```

---

## Tests Effectués

### Tests unitaires du moteur
```
Test 1: Parse formula 60|20|10 → [60, 20, 10] ✓
Test 2: Borlette 1er lot (42) → lot 1 ✓
Test 3: Borlette 2e lot (15) → lot 2 ✓
Test 4: Borlette 3e lot (88) → lot 3 ✓
Test 5: Borlette perdant (99) → None ✓
Test 6: Mariage gagnant (42-15) → lot 1 ✓
Test 7: Mariage perdant (42-99) → None ✓
Test 8: Parse formula 500 → [500] ✓
```

### Test API
```bash
GET /api/super-admin/test-winning-engine
→ {"passed": 8, "failed": 0, "total": 8}
```

### Test calcul ticket
```
Ticket: 42, 15, 99 (mise 100 chaque)
Résultat: 42-15-88

42 → GAGNANT (lot 1) : 100 × 60 = 6000 HTG
15 → GAGNANT (lot 2) : 100 × 20 = 2000 HTG
99 → PERDANT : 0 HTG

Total: 8000 HTG ✓
```

---

## Fichiers Modifiés

1. `/app/backend/winning_engine.py` (NOUVEAU)
2. `/app/backend/lottery_results_routes.py` (MODIFIÉ)
3. `/app/frontend/src/components/WinningNumberBadge.jsx` (NOUVEAU)
4. `/app/frontend/src/pages/SuperGlobalResultsPage.js` (MODIFIÉ)

---

## Prochaines Étapes (LOT 4)

### Commissions & Impression
1. Commissions = 0 si non configurées
2. Impression ticket fonctionnelle à 100%
3. Impression ticket gagnant avec détails
4. Respect strict de la hiérarchie des rôles

---

**Date** : 29 Mars 2026
**Version** : 1.0
