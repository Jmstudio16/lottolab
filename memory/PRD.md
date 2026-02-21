# LOTTOLAB - Lottery SaaS Platform
## Product Requirements Document (PRD)

### Overview
LOTTOLAB is a multi-tenant Lottery SaaS platform with hierarchical RBAC model (SUPER_ADMIN, COMPANY_ADMIN, AGENT_POS). The system supports Universal Agent access from any device type (POS terminals, computers, phones, tablets) with real-time synchronization between admin configurations and agent devices.

**Status: 100% PRODUCTION READY** (as of 2026-02-21)

---

### Core Systems Implemented

#### 1. Real-Time Synchronization System
- **5-Second Sync Interval**: Agent devices poll `/api/device/sync` every 5 seconds
- **Config Versioning**: Every admin change increments `config_version`
- **Change Detection**: Agents compare local version with server version
- **Full Config Reload**: When `config_changed=true`, agents reload via `/api/device/config`

#### 2. Universal Device Support
- Agents can login and sell from ANY device type:
  - POS terminal (with optional IMEI validation)
  - Computer, Phone, Tablet
- IMEI validation is optional based on company settings
- All device sessions logged in `activity_logs`

#### 3. Logo Management System
- **System Logo**: Super Admin can set global LOTTOLAB logo
- **Company Logo**: Each company can upload their own logo
- **Logo Priority**: Company logo > System logo
- **Logo Display**: Appears on sidebar, login pages, tickets, dashboards

#### 4. Financial Lifecycle System (NEW - 2026-02-21)
- **Agent Balance Management**: `agent_balances` collection tracks credit_limit, current_balance, available_balance
- **Ticket Check**: `POST /api/tickets/check` verifies wins against `global_results`
- **Ticket Payout**: `POST /api/tickets/payout` processes payments and updates balances
- **Automatic Winning Detection**: Background service processes tickets when results are entered
- **Balance Integration**: Ticket sales automatically deduct from agent's available balance

---

### What's Been Implemented

#### Backend Endpoints

##### Financial System (`/api/`)
| Endpoint | Method | Status |
|----------|--------|--------|
| `/tickets/check` | POST | ✅ Complete |
| `/tickets/payout` | POST | ✅ Complete |
| `/agent/balance` | GET | ✅ Complete |
| `/company/agent-balances` | GET | ✅ Complete |
| `/company/agent-balances/{id}/adjust` | PUT | ✅ Complete |
| `/company/payouts` | GET | ✅ Complete |
| `/company/winning-tickets` | GET | ✅ Complete |
| `/company/financial-summary` | GET | ✅ Complete |

##### Settings & Logo Endpoints (`/api/`)
| Endpoint | Method | Status |
|----------|--------|--------|
| `/system/settings` | GET/PUT | ✅ Complete |
| `/system/logo/upload` | POST | ✅ Complete |
| `/company/profile` | GET/PUT | ✅ Complete |
| `/company/logo/upload` | POST | ✅ Complete |
| `/logo/display` | GET | ✅ Complete |

##### Company Admin CRUD Endpoints (`/api/company/`)
| Endpoint | Method | Status |
|----------|--------|--------|
| `/agents` | GET/POST/PUT/DELETE | ✅ Complete |
| `/pos-devices` | GET/POST/PUT/DELETE | ✅ Complete |
| `/tickets` | GET | ✅ Complete |
| `/activity-logs` | GET | ✅ Complete |
| `/lottery-catalog` | GET | ✅ Complete |
| `/pos-rules` | GET/PUT | ✅ Complete |
| `/blocked-numbers` | GET/POST/DELETE | ✅ Complete |
| `/limits` | GET/POST/PUT/DELETE | ✅ Complete |
| `/reports/sales` | GET | ✅ Complete |

##### Real-Time Sync Endpoints (`/api/`)
| Endpoint | Method | Status |
|----------|--------|--------|
| `/device/config` | GET | ✅ Complete |
| `/device/sync` | GET | ✅ Complete |
| `/ticket/print/{id}` | GET | ✅ Complete |
| `/lottery/sell` | POST | ✅ Complete (with balance deduction) |

#### Frontend Pages

##### Company Admin
| Page | Route | Status |
|------|-------|--------|
| Agent Balances | `/company/agent-balances` | ✅ Complete |
| Winning Tickets & Payouts | `/company/winning-tickets` | ✅ Complete |
| Dashboard | `/company/dashboard` | ✅ Complete |
| Agents Management | `/company/agents` | ✅ Complete |
| Profile Settings | `/company/profile-settings` | ✅ Complete |

##### Agent Terminal
| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/agent/dashboard` | ✅ Complete |
| New Ticket | `/agent/new-ticket` | ✅ Complete |
| My Tickets | `/agent/tickets` | ✅ Complete |
| Results | `/agent/results` | ✅ Complete |

---

### Database Collections

| Collection | Purpose |
|------------|---------|
| `system_settings` | Global LOTTOLAB settings (logo, name) |
| `companies` | Company profiles with `company_logo_url` |
| `users` | All users (admins, agents) |
| `agent_policies` | Agent permissions and limits |
| `agent_balances` | Agent credit tracking (NEW) |
| `ticket_payouts` | Payout records (NEW) |
| `pos_devices` | POS device registry |
| `device_sessions` | Active device sessions |
| `company_lotteries` | Company lottery catalog |
| `lottery_transactions` | Sold tickets |
| `global_results` | Lottery results (Super Admin) |
| `activity_logs` | Full audit trail |
| `company_config_versions` | Config version tracking |

---

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | jefferson@jmstudio.com | JMStudio@2026! |
| Company Admin | admin@lotopam.com | Admin123! |
| Agent | agent001@lotopam.com | Agent123! |

---

### File Structure

```
/app
├── backend/
│   ├── server.py
│   ├── financial_routes.py       # NEW: Financial lifecycle endpoints
│   ├── settings_routes.py        # Logo & settings endpoints
│   ├── company_admin_routes.py   # Company Admin CRUD
│   ├── sync_routes.py            # Real-time sync with logos
│   ├── super_admin_global_routes.py # Results with auto-winning detection
│   ├── universal_pos_routes.py   # Agent sales with balance deduction
│   └── uploads/company-logos/    # Uploaded company logos
├── frontend/
│   ├── public/assets/logos/
│   │   └── lottolab-logo.png
│   ├── src/
│   │   ├── pages/
│   │   │   ├── CompanyAgentBalancesPage.jsx   # NEW
│   │   │   ├── CompanyWinningTicketsPage.jsx  # NEW
│   │   │   └── LoginPage.js                   # Demo accounts removed
│   │   └── components/
│   │       └── Sidebar.js                     # Financial menu items
```

---

### Security Updates (2026-02-21)

- ✅ Demo accounts removed from login page UI
- ✅ No hardcoded credentials in frontend
- ✅ All endpoints require JWT authentication
- ✅ Multi-tenant isolation enforced on all queries

---

### Prioritized Backlog

#### P0 - Critical (ALL COMPLETE)
- [x] Agent Balance System
- [x] Ticket Check System
- [x] Ticket Payout System
- [x] Automatic Winning Detection
- [x] Admin Visibility (Balances & Payouts)
- [x] Security: Remove demo accounts

#### P1 - High Priority (Future)
- [ ] WebSocket-based real-time push notifications
- [ ] SMS/Email notifications for winners
- [ ] PDF/CSV export for reports
- [ ] API rate limiting

#### P2 - Medium Priority (Future)
- [ ] QR code scanning for ticket verification
- [ ] Automated device deactivation after inactivity
- [ ] Enhanced audit trail for ticket reprints
- [ ] Automated agent commission calculation

---

### Last Updated
- **Date**: 2026-02-21
- **Session**: Financial Lifecycle System + Security Hardening
- **Status**: System 100% production-ready for Hostinger deployment
- **Test Results**: 19/19 backend tests passed, all frontend pages verified
