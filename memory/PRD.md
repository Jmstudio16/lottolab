# LOTTOLAB - Product Requirements Document
**Version**: 12.3.0  
**Date**: 22 Mars 2026  
**Status**: Production Ready - Toutes Loteries Haiti Actives

---

## 1. Corrections v12.3.0 (Cette Session)

### ✅ 26 Loteries Haiti Toutes Ouvertes
- Horaires élargis: 06:00 - 23:00 pour toutes les loteries Haiti
- Drapeau 🇭🇹 correctement affiché
- Tri: Loteries "Haiti" en premier, puis autres loteries Haiti, puis USA

### ✅ Loteries Haiti Disponibles (26 total)
| Loterie | Drapeau | Statut |
|---------|---------|--------|
| Haiti Borlette Midi | 🇭🇹 | ✅ OUVERT |
| Haiti Borlette Soir | 🇭🇹 | ✅ OUVERT |
| Haiti Loto 3 Midi | 🇭🇹 | ✅ OUVERT |
| Haiti Loto 3 Soir | 🇭🇹 | ✅ OUVERT |
| Haiti Loto 4 Midi | 🇭🇹 | ✅ OUVERT |
| Haiti Loto 4 Soir | 🇭🇹 | ✅ OUVERT |
| Haiti Loto 5 Midi | 🇭🇹 | ✅ OUVERT |
| Haiti Loto 5 Soir | 🇭🇹 | ✅ OUVERT |
| Haiti Mariage Midi | 🇭🇹 | ✅ OUVERT |
| Haiti Mariage Soir | 🇭🇹 | ✅ OUVERT |
| Tennessee Matin | 🇭🇹 | ✅ OUVERT |
| Tennessee Midi | 🇭🇹 | ✅ OUVERT |
| Tennessee Soir | 🇭🇹 | ✅ OUVERT |
| Texas Matin | 🇭🇹 | ✅ OUVERT |
| Texas Midi | 🇭🇹 | ✅ OUVERT |
| Texas Soir | 🇭🇹 | ✅ OUVERT |
| Texas Nuit | 🇭🇹 | ✅ OUVERT |
| Georgia Midi | 🇭🇹 | ✅ OUVERT |
| Georgia Soir | 🇭🇹 | ✅ OUVERT |
| Georgia Nuit | 🇭🇹 | ✅ OUVERT |
| Florida Midi | 🇭🇹 | ✅ OUVERT |
| Florida Soir | 🇭🇹 | ✅ OUVERT |
| New York Midi | 🇭🇹 | ✅ OUVERT |
| New York Soir | 🇭🇹 | ✅ OUVERT |
| Plop Plop | 🇭🇹 | ✅ OUVERT |
| Loto Rapid | 🇭🇹 | ✅ OUVERT |

---

## 2. Configuration Ticket Entreprise (v12.2.0)

### ✅ Page Configuration Entreprise Complète
- **Adresse** - Champ dans les paramètres Company Admin
- **Téléphone** - Champ dans les paramètres Company Admin  
- **QR Code Toggle** - Activer/Désactiver le QR code sur le ticket
- **Texte en Haut du Ticket** - Personnalisable
- **Texte en Bas du Ticket** - Personnalisable
- **Logo Entreprise** - Upload et affichage

### ✅ Ticket Imprimé - Informations Affichées
- Logo de l'entreprise
- Nom de l'entreprise
- Téléphone (Tél: +509 xxxx-xxxx)
- Adresse
- Texte personnalisé en haut
- Texte personnalisé en bas
- QR Code pour vérification (si activé)
- Statut "VALIDÉ"
- Mentions légales complètes
- LOTTOLAB.TECH en bas

---

## 3. Types de Mise Disponibles

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

## 4. Comptes de Test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@lottolab.com | 123456 |
| Company Admin | admin@lotopam.com | Admin123! |
| Supervisor | supervisor@lotopam.com | Supervisor123! |
| Vendeur | vendeur@lotopam.com | Vendeur123! |

---

## 5. Endpoints API

### Configuration Entreprise
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/company/profile` | Obtenir paramètres entreprise |
| PUT | `/api/company/profile` | Modifier paramètres |
| GET | `/api/ticket/print/{ticket_id}` | Générer ticket HTML |
| GET | `/api/verify-ticket/{code}` | Vérification publique |

### Loteries
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/device/config` | Config complète + loteries ouvertes |
| GET | `/api/device/sync` | Synchronisation temps réel |

---

## 6. Statistiques

- **Total Loteries**: 236
- **Loteries Haiti**: 26 (toutes ouvertes 06:00-23:00)
- **Loteries USA**: 210
- **Commission Vendeur**: 0% par défaut
- **Fuseau Horaire**: America/Port-au-Prince

---

## 7. Tâches Terminées

- [x] Configuration complète du ticket (Adresse, Téléphone, QR Code)
- [x] Texte haut/bas personnalisable
- [x] QR Code toggle
- [x] Synchronisation ticket avec paramètres
- [x] **26 loteries Haiti toutes ouvertes**
- [x] **Tri Haiti en premier**
- [x] **Drapeau 🇭🇹 correct**
- [x] Cases "Payé/Non Payé" sur tickets gagnants
- [x] Limites de mise (Loto4: 20 HTG, Loto5: 250 HTG)
- [x] Logique 60/20/10 pour les gains
- [x] Mariage Gratis auto
- [x] Minimum 1 HTG pour vendeur
- [x] Statut "Validé"
- [x] Résultats auto Plop Plop / Loto Rapid
- [x] Commission vendeur 0% par défaut

---

## 8. Backlog

### P2 - Refactoring
- [ ] Unifier templates tickets (Jinja2)

### P2 - Futures
- [ ] Support multi-langue
- [ ] Mode offline
- [ ] APK POS

---

## 9. Support

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48
