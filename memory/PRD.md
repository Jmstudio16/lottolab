# LOTTOLAB - Enterprise Lottery SaaS Platform
## Product Requirements Document (PRD)

### Overview
LOTTOLAB is a production-ready, enterprise-grade multi-tenant Lottery SaaS platform with hierarchical RBAC model (SUPER_ADMIN, COMPANY_ADMIN, AGENT_POS). The system now includes **LOTO PAM**, a public-facing online gaming platform that operates within the same codebase.

**Status**: ✅ **PRODUCTION READY** 
**Last Update**: 2026-02-22
**New Feature**: LOTO PAM Online Platform (Phase 1 Complete)

---

## Platform Architecture

### Dual-Platform Structure
```
LOTTOLAB (B2B SaaS)           LOTO PAM (B2C Public Platform)
├── Super Admin Portal        ├── Public Homepage
├── Company Admin Portal      ├── Player Registration/Login
├── Agent POS Terminal        ├── Wallet System
└── API Infrastructure        ├── Game Selection (Lottery)
                              ├── Results Viewing
                              └── KYC Submission
```

### Domain-Based Rendering
```javascript
if (hostname.includes('lotopam')) {
  // Render LOTO PAM public portal
  return <LotoPamApp />;
} else {
  // Render LOTTOLAB SaaS portal
  return <SaaSApp />;
}
```

---

## LOTO PAM Online Platform (NEW)

### Phase 1 - COMPLETED ✅

#### Public Portal Features
| Feature | Status | Route |
|---------|--------|-------|
| Homepage | ✅ | `/lotopam` |
| Registration | ✅ | `/lotopam/register` |
| Login | ✅ | `/lotopam/login` |
| Wallet | ✅ | `/lotopam/wallet` |
| Play Selection | ✅ | `/lotopam/play` |
| Lottery Play | ✅ | `/lotopam/play/lottery` |
| My Tickets | ✅ | `/lotopam/my-tickets` |
| Results | ✅ | `/lotopam/results` |
| KYC Submission | ✅ | `/lotopam/kyc` |
| Profile | ✅ | `/lotopam/profile` |

#### Super Admin LOTO PAM Module
| Feature | Status | Route |
|---------|--------|-------|
| Dashboard | ✅ | `/super/online/dashboard` |
| Players Management | ✅ | `/super/online/players` |
| Deposits Approval | ✅ | `/super/online/deposits` |
| Withdrawals Processing | ✅ | `/super/online/withdrawals` |
| Tickets Monitoring | ✅ | `/super/online/tickets` |
| KYC Verification | ✅ | `/super/online/kyc` |
| Platform Settings | ✅ | `/super/online/settings` |

#### Backend API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/online/register` | POST | Player registration |
| `/api/online/login` | POST | Player login |
| `/api/online/me` | GET | Get player profile |
| `/api/online/wallet` | GET | Get wallet balance |
| `/api/online/wallet/deposit` | POST | Request deposit |
| `/api/online/wallet/withdraw` | POST | Request withdrawal |
| `/api/online/results` | GET | Public results |
| `/api/online/lotteries` | GET | Available lotteries |
| `/api/online/tickets` | GET | Player tickets |
| `/api/online/tickets/create` | POST | Create ticket |
| `/api/online/kyc/submit` | POST | Submit KYC |
| `/api/online-admin/overview` | GET | Admin stats |
| `/api/online-admin/players` | GET | List players |
| `/api/online-admin/deposits/pending` | GET | Pending deposits |
| `/api/online-admin/deposits/approve` | POST | Approve deposit |
| `/api/online-admin/withdrawals/process` | POST | Process withdrawal |
| `/api/online-admin/kyc/review` | POST | Review KYC |

#### Database Collections (NEW)
- `online_players` - Player accounts
- `online_wallets` - Player balances
- `online_wallet_transactions` - Deposit/withdrawal history
- `online_tickets` - Betting tickets
- `kyc_submissions` - KYC documents
- `online_settings` - Platform configuration

### Phase 2 - UPCOMING
- [ ] Lottery gameplay with real-time countdown
- [ ] Ticket number selection interface
- [ ] Win calculation and notification

### Phase 3 - BACKLOG
- [ ] Keno game implementation
- [ ] Raffle/Tombola system
- [ ] SMS/Email notifications

---

## Multi-Language Support (i18n)

### Supported Languages
| Code | Language | Status |
|------|----------|--------|
| `en` | English | ✅ |
| `fr` | French | ✅ |
| `es` | Spanish | ✅ |
| `ht` | Haitian Creole | ✅ |

### Implementation
- `i18next` library configured
- Translation files in `/frontend/src/i18n/locales/`
- `LanguageSwitcher` component in header
- Language preference saved in localStorage

---

## Security & Production Features

### Rate Limiting
- Login: 10/minute per IP
- Ticket Sales: 120/minute per IP
- Registration: 5/minute per IP

### Anti-Fraud Detection
- High sales volume alerts
- Rapid consecutive sales detection
- Suspicious win rate alerts

### Authentication
- JWT tokens for both SaaS and Online players
- Bcrypt password hashing
- Role-based route protection

---

## Active Accounts

### SaaS Platform
| Email | Role |
|-------|------|
| jefferson@jmstudio.com | SUPER_ADMIN |
| admin@lotopam.com | COMPANY_ADMIN |
| agent001@lottolab.com | AGENT_POS |

### LOTO PAM (Test)
| Email | Status |
|-------|--------|
| testplayer@example.com | pending_kyc |

---

## File Structure (Key Files)

```
/app
├── backend/
│   ├── server.py                   # Main FastAPI app
│   ├── online_routes.py            # LOTO PAM public APIs
│   ├── online_models.py            # Pydantic models
│   ├── rate_limiter.py             # Rate limiting
│   └── fraud_detector.py           # Fraud detection
├── frontend/
│   ├── src/
│   │   ├── App.js                  # Domain-based routing
│   │   ├── i18n/                   # i18next config
│   │   │   └── locales/            # Translation files
│   │   ├── pages/
│   │   │   ├── lotopam/            # LOTO PAM public pages
│   │   │   └── super/              # Super Admin LOTO PAM module
│   │   ├── layouts/
│   │   │   └── LotoPamLayout.jsx   # Public portal layout
│   │   └── context/
│   │       └── LotoPamAuthContext.jsx # Player auth context
│   └── .env                        # Frontend config
├── nginx.conf                      # Production web server
└── pm2.config.js                   # Process manager
```

---

## Deployment Configuration

### Domains
- `lottolab.tech` → SaaS Portal
- `lotopam.com` → Public Gaming Platform

### Environment Variables
```bash
# Backend
MONGO_URL=mongodb://localhost:27017
DB_NAME=lottolab
JWT_SECRET_KEY=<secure-key>
CORS_ORIGINS=https://lottolab.tech,https://lotopam.com

# Frontend
REACT_APP_BACKEND_URL=https://api.lottolab.tech
```

---

## Testing

### Test Report: `/app/test_reports/iteration_8.json`
- Backend: 100% (16/16 tests passed)
- Frontend: 100% (All pages loading)
- Bugs Fixed: 4 (log_activity params, MongoDB ObjectId)

---

## Next Steps

1. **Phase 2**: Complete lottery gameplay with ticket creation
2. **Phase 3**: Implement Keno and Raffle games
3. **Enhancement**: Add real-time WebSocket notifications
4. **Production**: Configure SSL and deploy to Hostinger
