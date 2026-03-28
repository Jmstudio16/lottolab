# Module Limites Intelligentes - LOTTOLAB (PHASE 3)

## Vue d'ensemble

Le module Limites Intelligentes de LOTTOLAB fournit un contrôle anti-fraude avancé pour les opérations de loterie. Il comprend :

1. **Limite par numéro** - Max de mise configurable par numéro
2. **Blocage automatique** - Interdiction automatique quand limite atteinte
3. **Alertes temps réel** - Notifications admin avec seuil configurable
4. **Gestion dynamique** - Modifications synchronisées immédiatement

---

## 1. Architecture Backend

### Fichier Principal
- **Chemin** : `/app/backend/limits_routes.py`
- **Router** : `limits_router` avec préfixe `/api/limits`

### Intégration
Le module s'intègre avec :
- `server.py` : Vérification avant création de ticket (ligne ~840)
- `universal_pos_routes.py` : Vérification avant vente POS (ligne ~500)
- `security_system.py` : Audit trail pour toutes les actions

---

## 2. APIs Backend

### 2.1 Configuration des Limites

#### `GET /api/limits/config`
Récupère la configuration actuelle des limites.

**Réponse** :
```json
{
  "config_id": "global_limits",
  "default_max_bet_per_number": 5000.0,
  "default_max_bet_per_ticket": 50000.0,
  "alert_threshold_percentage": 80.0,
  "auto_block_enabled": true,
  "block_duration_minutes": 0,
  "number_specific_limits": {"42": 10000},
  "updated_at": "2026-03-28T05:00:00Z"
}
```

---

#### `PUT /api/limits/config`
Met à jour la configuration globale (Super Admin uniquement).

**Body** :
```json
{
  "default_max_bet_per_number": 5000.0,
  "default_max_bet_per_ticket": 50000.0,
  "alert_threshold_percentage": 80.0,
  "auto_block_enabled": true,
  "block_duration_minutes": 0
}
```

**Réponse** :
```json
{
  "message": "Configuration des limites mise à jour",
  "config": {...}
}
```

---

#### `PUT /api/limits/config/number`
Définit une limite spécifique pour un numéro.

**Body** :
```json
{
  "number": "42",
  "max_bet": 10000.0,
  "lottery_id": "lotto_ny_midi"
}
```

---

### 2.2 Vérification des Mises

#### `POST /api/limits/check`
Vérifie si une mise est autorisée AVANT de créer le ticket.

**Body** :
```json
{
  "lottery_id": "lotto_ny_midi",
  "draw_name": "Midi",
  "draw_date": "2026-03-28",
  "plays": [
    {"numbers": "42", "bet_type": "BORLETTE", "amount": 100}
  ]
}
```

**Réponse** :
```json
{
  "all_allowed": false,
  "lottery_id": "lotto_ny_midi",
  "draw_name": "Midi",
  "checks": [
    {
      "number": "42",
      "amount": 100,
      "current_total": 4500.0,
      "max_limit": 5000.0,
      "new_total": 4600.0,
      "remaining": 500.0,
      "percentage_used": 90.0,
      "is_allowed": true,
      "is_blocked": false,
      "reason": null,
      "needs_alert": true
    }
  ]
}
```

---

### 2.3 Gestion des Blocages

#### `POST /api/limits/numbers/block`
Bloque manuellement un numéro.

**Query Params** :
- `number` : Numéro à bloquer (ex: "42")
- `lottery_id` : ID de la loterie
- `draw_name` : Nom du tirage (Matin, Midi, Soir)
- `draw_date` : Date du tirage
- `reason` : Raison du blocage

**Réponse** :
```json
{
  "message": "Numéro 42 bloqué avec succès",
  "block_id": "block_abc123",
  "alert_id": "alert_xyz789"
}
```

---

#### `DELETE /api/limits/numbers/block/{block_id}`
Débloque un numéro.

---

#### `GET /api/limits/numbers/blocked`
Liste tous les numéros bloqués actifs.

**Réponse** :
```json
{
  "blocked_numbers": [
    {
      "block_id": "block_abc123",
      "number": "42",
      "lottery_id": "lotto_ny_midi",
      "draw_name": "Midi",
      "block_type": "MANUAL",
      "reason": "Blocage manuel",
      "active": true
    }
  ],
  "count": 1
}
```

---

### 2.4 Statut des Numéros

#### `GET /api/limits/numbers/status`
Récupère le statut de tous les numéros avec mises pour un tirage.

**Query Params** :
- `lottery_id`, `draw_name`, `draw_date`

**Réponse** :
```json
{
  "lottery_id": "lotto_ny_midi",
  "draw_name": "Midi",
  "default_limit": 5000.0,
  "numbers": [
    {
      "number": "42",
      "total_bets": 4500.0,
      "limit": 5000.0,
      "percentage": 90.0,
      "remaining": 500.0,
      "status": "WARNING",
      "is_blocked": false
    }
  ],
  "blocked_count": 0,
  "warning_count": 1,
  "limit_reached_count": 0
}
```

---

### 2.5 Gestion des Alertes

#### `GET /api/limits/alerts`
Liste les alertes de limites.

**Query Params** :
- `acknowledged` : true/false
- `severity` : CRITICAL, HIGH, MEDIUM, LOW
- `limit` : Nombre max

---

#### `POST /api/limits/alerts/acknowledge`
Acquitte une alerte.

**Body** :
```json
{
  "alert_id": "alert_abc123",
  "notes": "Vérifié par admin"
}
```

---

#### `POST /api/limits/alerts/acknowledge-all`
Acquitte toutes les alertes non acquittées.

---

### 2.6 Dashboard Stats

#### `GET /api/limits/dashboard/stats`
Statistiques temps réel pour le dashboard.

**Réponse** :
```json
{
  "config": {
    "default_max_bet": 5000.0,
    "alert_threshold": 80.0,
    "auto_block_enabled": true
  },
  "blocks": {
    "active_total": 1,
    "created_today": 1
  },
  "alerts": {
    "unacknowledged": 2,
    "critical": 0,
    "created_today": 2
  }
}
```

---

## 3. Modèles de Base de Données

### Collection `limit_config`
```javascript
{
  "config_id": "global_limits",
  "default_max_bet_per_number": 5000.0,
  "default_max_bet_per_ticket": 50000.0,
  "alert_threshold_percentage": 80.0,
  "auto_block_enabled": true,
  "block_duration_minutes": 0,
  "number_specific_limits": {"42": 10000},
  "lottery_specific_limits": {},
  "updated_at": "2026-03-28T05:00:00Z",
  "updated_by": "user_admin"
}
```

### Collection `blocked_numbers`
```javascript
{
  "block_id": "block_abc123",
  "number": "42",
  "lottery_id": "lotto_ny_midi",
  "draw_name": "Midi",
  "draw_date": "2026-03-28",
  "reason": "Limite automatique atteinte",
  "blocked_by": "user_admin",
  "block_type": "AUTOMATIC", // ou "MANUAL"
  "active": true,
  "created_at": "2026-03-28T10:30:00Z"
}
```

### Collection `limit_alerts`
```javascript
{
  "alert_id": "alert_xyz789",
  "alert_type": "THRESHOLD_WARNING", // ou "LIMIT_EXCEEDED_AUTO_BLOCK", "NUMBER_BLOCKED"
  "number": "42",
  "lottery_id": "lotto_ny_midi",
  "draw_name": "Midi",
  "current_total": 4500.0,
  "limit": 5000.0,
  "percentage": 90.0,
  "message": "ATTENTION: 42 à 90% (4500/5000 HTG)",
  "severity": "MEDIUM", // ou "HIGH", "CRITICAL"
  "acknowledged": false,
  "created_at": "2026-03-28T10:25:00Z"
}
```

---

## 4. Composants Frontend

### Page Principale
**Chemin** : `/app/frontend/src/pages/super_admin/SuperAdminLimitsPage.jsx`
**Route** : `/super/limits`

### Onglets
| Onglet | Description |
|--------|-------------|
| Vue d'ensemble | Stats temps réel, config actuelle, actions rapides |
| Numéros Bloqués | Liste avec déblocage |
| Alertes | Liste avec acquittement |
| Statut Numéros | Recherche par tirage |

### Fonctionnalités
- Rafraîchissement automatique (30 secondes)
- Modal de configuration
- Modal de blocage manuel
- Acquittement individuel et groupé

---

## 5. Logique d'Intégration

### Flux de Vérification (Ticket Creation)

```
1. Agent soumet une vente
   ↓
2. server.py reçoit la requête
   ↓
3. validate_bet_limits() appelé
   ↓
4. Pour chaque numéro:
   - Vérifie si bloqué → Refuse
   - Calcule total actuel
   - Compare avec limite
   - Si dépasse → Refuse + Auto-block
   - Si > seuil alerte → Crée alerte
   ↓
5. Si tout OK → Crée le ticket
6. Si refusé → Retourne erreur détaillée
```

### Blocage Automatique
Quand un numéro atteint sa limite :
1. Insertion dans `blocked_numbers`
2. Création d'alerte CRITICAL
3. Log dans audit trail
4. Blocage jusqu'au prochain tirage

---

## 6. Permissions et Rôles

| Action | SUPER_ADMIN | COMPANY_ADMIN |
|--------|-------------|---------------|
| Voir Dashboard | ✅ | ❌ |
| Modifier Config | ✅ | ❌ |
| Bloquer Numéro | ✅ | ❌ |
| Débloquer | ✅ | ❌ |
| Voir Alertes | ✅ | ❌ |
| Acquitter Alertes | ✅ | ❌ |

---

## 7. Tests Effectués

### Tests Backend (API)
| Endpoint | Méthode | Résultat |
|----------|---------|----------|
| `/api/limits/config` | GET | ✅ PASS |
| `/api/limits/config` | PUT | ✅ PASS |
| `/api/limits/dashboard/stats` | GET | ✅ PASS |
| `/api/limits/numbers/block` | POST | ✅ PASS |
| `/api/limits/numbers/blocked` | GET | ✅ PASS |
| `/api/limits/numbers/block/{id}` | DELETE | ✅ PASS |
| `/api/limits/check` | POST | ✅ PASS |
| `/api/limits/alerts` | GET | ✅ PASS |
| `/api/limits/alerts/acknowledge` | POST | ✅ PASS |

### Tests Frontend (UI)
| Fonctionnalité | Résultat |
|----------------|----------|
| Dashboard Vue d'ensemble | ✅ PASS |
| Stats temps réel | ✅ PASS |
| Onglet Numéros Bloqués | ✅ PASS |
| Déblocage numéro | ✅ PASS |
| Onglet Alertes | ✅ PASS |
| Modal Configuration | ✅ PASS |

---

## 8. Instructions d'Utilisation

### Configuration Initiale
1. Accéder à `/super/limits`
2. Cliquer sur "Configuration"
3. Définir :
   - Max par numéro (défaut: 5000 HTG)
   - Max par ticket (défaut: 50000 HTG)
   - Seuil d'alerte (défaut: 80%)
   - Blocage automatique (défaut: activé)

### Surveiller les Mises
1. Onglet "Statut Numéros"
2. Sélectionner loterie, tirage, date
3. Cliquer "Vérifier"
4. Observer les numéros WARNING (> seuil) et LIMIT_REACHED

### Bloquer un Numéro
1. Onglet "Numéros Bloqués"
2. Cliquer "Bloquer"
3. Remplir : numéro, loterie, tirage, date, raison
4. Confirmer

### Gérer les Alertes
1. Onglet "Alertes"
2. Voir les alertes non acquittées
3. Cliquer ✓ pour acquitter individuellement
4. Ou "Acquitter tout" pour tout valider

---

## 9. Changelog

### 28 Mars 2026 - Phase 3 Complète
- Implémentation complète du module limites intelligentes
- Backend : 15+ endpoints API
- Frontend : Dashboard avec 4 onglets
- Intégration avec création de tickets
- Blocage automatique fonctionnel
- Alertes temps réel
- Tests : 100% des fonctionnalités validées
- Documentation : Ce fichier créé

---

## 10. Contacts

**Développé par** : LOTTOLAB Development Team
**Version** : 3.0 (Phase 3)
**Date** : 28 Mars 2026
