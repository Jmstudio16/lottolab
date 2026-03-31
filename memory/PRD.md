# LOTTOLAB - Professional Lottery SaaS Platform

## Version: 16.0.0 (Notifications & Profile Photo)
## Last Updated: 2026-03-31 05:20 UTC
## Deployed: 2026-03-31 01:20 Haiti Time

---

## STATUT: STABLE ✅

### Nouvelles Fonctionnalités (v16.0.0):

#### 1. 🔔 Notifications Temps Réel ✅
- **Backend**: WebSocket + stockage MongoDB + broadcast par rôle/company
- **Frontend**: Hook `useNotifications.js` avec fallback polling 10s
- **Header**: Badge animé, dropdown moderne, indicateur connexion
- **Son**: Activé par défaut avec toggle dans les notifications
- **Endpoints**:
  - `GET /api/notifications` - Récupérer notifications
  - `POST /api/notifications` - Créer notification
  - `PUT /api/notifications/{id}/read` - Marquer comme lu
  - `PUT /api/notifications/mark-all-read` - Tout marquer comme lu

#### 2. 📷 Photo de Profil (Tous Utilisateurs) ✅
- **Upload**: JPG, PNG, WebP - Max 2MB
- **Stockage**: `/app/backend/uploads/profile-photos/`
- **Endpoints**:
  - `POST /api/user/upload-profile-image` - Upload photo
  - `GET /api/user/profile-image/{filename}` - Servir photo
  - `DELETE /api/user/profile-image` - Supprimer photo
  - `GET /api/user/profile` - Profil complet

#### 3. 💰 Commissions Corrigées ✅
- **Règle**: Commission masquée si = 0 ou non configurée
- **Vendeurs**: Pas d'affichage de commission (réservé Admin)
- **Calcul**: Seulement si commission > 0
- **Fichiers modifiés**: `VendeurMesVentes.jsx`, `VendeurDashboard.jsx`

---

## État Actuel du Système

### Fonctionnalités Validées

| Fonctionnalité | Statut |
|----------------|--------|
| Notifications temps réel | ✅ Polling 10s (WS en production) |
| Badge cloche animé | ✅ Rouge avec compteur |
| Toggle son notifications | ✅ ON par défaut |
| Photo profil upload | ✅ Tous utilisateurs |
| Commission masquée vendeur | ✅ |
| Page vendeur nouvelle vente | ✅ 62 loteries ouvertes |
| Settlement automatique | ✅ 60/20/10 |

---

## Credentials de Test

| Rôle | Email | Password |
|------|-------|----------|
| Super Admin | jefferson@jmstudio.com | JMStudio@2026! |
| Company Admin | admin@lotopam.com | LotoPAM2026! |
| Vendeur Test | vendeur@lotopam.com | vendor123 |
| Tous Vendeurs/Agents | * | vendor123 |

---

## Architecture Fichiers

```
/app/backend/
├── profile_routes.py         # NEW: Upload photo profil
├── notification_routes.py    # UPDATED: Notifications + WebSocket
├── websocket_routes.py       # UPDATED: /ws/notifications endpoint
├── websocket_manager.py      # Broadcast par rôle/company
├── sync_service.py           # Loteries vendeur
└── server.py                 # Main entry

/app/frontend/
├── src/hooks/useNotifications.js     # NEW: Hook temps réel
├── src/components/Header.js          # UPDATED: Cloche + dropdown
├── src/components/ProfilePhotoUpload.jsx  # NEW: Upload photo
├── src/components/UserAvatar.jsx     # Avatar avec photo
└── public/notification.mp3           # Son notification
```

---

## Prochaines Étapes

### P1 - Haute Priorité
- [x] ~~Notifications temps réel~~
- [x] ~~Photo de profil tous utilisateurs~~
- [x] ~~Commission masquée vendeurs~~
- [ ] Ajouter Adresse, Téléphone, QR Code dans Company Settings

### P2 - Moyenne Priorité
- [ ] Notification 5 min avant fermeture loterie
- [ ] Export rapports PDF

### P3 - Basse Priorité
- [ ] APK Android avec mode offline
- [ ] Multi-langue (Espagnol, Anglais)

---

## Notes Techniques

### WebSocket
- En environnement preview: WebSocket retourne 403 (normal)
- Fallback automatique vers polling 10s
- En production: WebSocket temps réel fonctionnel

### Notifications Events
```javascript
// Types d'événements WebSocket
RESULT_PUBLISHED  // Résultat loterie publié
TICKET_WINNER     // Ticket gagnant détecté
TICKET_PAID       // Ticket payé
TICKET_SOLD       // Nouveau ticket vendu
NOTIFICATION      // Message admin
```

### Commission Logic
```python
# Backend: vendeur_routes.py
if commission_rate > 0:
    commission = total_sales * (commission_rate / 100)
else:
    commission = 0  # Ne jamais calculer si 0
```
