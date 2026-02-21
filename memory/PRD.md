# LOTTOLAB - Lottery SaaS Platform
## Product Requirements Document (PRD)

### Overview
LOTTOLAB is a multi-tenant Lottery SaaS platform with hierarchical RBAC model (SUPER_ADMIN, COMPANY_ADMIN, AGENT_POS). The system supports Universal Agent access from any device type (POS terminals, computers, phones, tablets) with real-time synchronization between admin configurations and agent devices.

**Status: 100% PRODUCTION READY** (as of 2026-02-21)
**Production Deployment Guide: /app/PRODUCTION_CONFIG.md**

---

### Production Security Updates (2026-02-21)

#### JWT Security Hardening
- JWT_SECRET_KEY is now **REQUIRED** via environment variable
- No fallback default key - system will fail to start without proper configuration
- Key must be set in `/app/backend/.env`

#### Files Created for Production Deployment
1. `/app/PRODUCTION_CONFIG.md` - Complete Hostinger deployment guide
2. `/app/backend/.env.production.example` - Production environment template
3. `/app/backend/create_super_admin.py` - Interactive Super Admin creation script

#### Security Checklist
- [x] JWT_SECRET_KEY required via environment (no hardcoded fallback)
- [x] Demo accounts removed from login page UI
- [x] No hardcoded credentials in frontend
- [x] All endpoints require JWT authentication
- [x] Multi-tenant isolation enforced on all queries
- [x] Production deployment documentation created

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

#### 4. Financial Lifecycle System
- **Agent Balance Management**: `agent_balances` collection tracks credit_limit, current_balance, available_balance
- **Ticket Check**: `POST /api/tickets/check` verifies wins against `global_results`
- **Ticket Payout**: `POST /api/tickets/payout` processes payments and updates balances
- **Automatic Winning Detection**: Background service processes tickets when results are entered
- **Balance Integration**: Ticket sales automatically deduct from agent's available balance

#### 5. Result Management System
- **Super Admin Control**: Only SUPER_ADMIN can publish, edit, delete results
- **Auto Sync**: Results automatically sync to all Company Admins and Agents
- **State Lottery Support**: 50 US states supported with emoji flags
- **Draw Types**: Morning, Midday, Evening, Night
- **Winning Numbers Display**: Professional colored balls (Gold/Silver/Bronze)
- **Auto Ticket Processing**: When results are published, all pending tickets are automatically checked

#### 6. Company & Agent Management System
- **Super Admin Company Creation**: Full form with logo, info, admin account, subscription, limits
- **Login as Company Admin**: Super Admin can impersonate any company admin
- **Agent Full Creation**: Creates user, policy, device, and balance in one operation
- **Global Visibility**: Super Admin sees ALL companies, agents, POS, tickets across platform

---

### Database Collections (MongoDB)

| Collection | Purpose |
|------------|---------|
| `system_settings` | Global LOTTOLAB settings (logo, name) |
| `companies` | Company profiles with `company_logo_url` |
| `users` | All users (admins, agents) |
| `agent_policies` | Agent permissions and limits |
| `agent_balances` | Agent credit tracking |
| `ticket_payouts` | Payout records |
| `pos_devices` | POS device registry |
| `device_sessions` | Active device sessions |
| `company_lotteries` | Company lottery catalog |
| `lottery_transactions` | Sold tickets |
| `global_lotteries` | Global lottery catalog |
| `global_schedules` | Lottery schedules |
| `global_results` | Lottery results (Super Admin) |
| `activity_logs` | Full audit trail |
| `company_config_versions` | Config version tracking |
| `plans` | Subscription plans |
| `licenses` | Company licenses |
| `blocked_numbers` | Blocked numbers per company |
| `sales_limits` | Sales limits per company |
| `prime_configs` | Payout multiplier configs |

---

### Test Credentials (Development Only)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | jefferson@jmstudio.com | JMStudio@2026! |
| Company Admin | admin@lotopam.com | Admin123! |
| Agent | agent001@lottolab.com | Agent123! |

**Note:** For production, use `/app/backend/create_super_admin.py` to create secure admin accounts.

---

### API Endpoints Summary

#### Authentication
- `POST /api/auth/login` - Standard login (all roles)
- `POST /api/auth/agent/login` - Agent POS login with device session
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

#### Super Admin
- `GET /api/super/dashboard/stats` - Dashboard statistics
- `GET/POST /api/super/companies` - Company CRUD
- `POST /api/super-admin/companies/full-create` - Create company with admin
- `POST /api/super-admin/companies/{id}/impersonate` - Login as company admin
- `GET/POST/PUT/DELETE /api/super-admin/global-lotteries` - Lottery catalog
- `GET/POST/PUT/DELETE /api/super-admin/global-schedules` - Schedules
- `GET/POST/PUT/DELETE /api/super-admin/results` - Results management

#### Company Admin
- `GET /api/company/dashboard/stats` - Dashboard statistics
- `GET/POST /api/company/agents` - Agent management
- `GET /api/company/agent-balances` - Agent balances
- `PUT /api/company/agent-balances/{id}/adjust` - Adjust balance
- `GET /api/company/winning-tickets` - Winning tickets
- `GET /api/company/payouts` - Payout history
- `GET /api/company/financial-summary` - Financial reports

#### Agent POS
- `GET /api/device/config` - Full device configuration
- `GET /api/device/sync` - Real-time sync (every 5 seconds)
- `POST /api/lottery/sell` - Sell ticket
- `POST /api/lottery/cancel` - Cancel ticket
- `GET /api/agent/tickets` - Agent's tickets
- `GET /api/agent/balance` - Agent's balance
- `GET /api/results/today` - Today's results

#### Financial
- `POST /api/tickets/check` - Check if ticket is winner
- `POST /api/tickets/payout` - Process payout

---

### File Structure

```
/app
├── backend/
│   ├── server.py              # Main FastAPI server
│   ├── auth.py                # JWT authentication (SECURE)
│   ├── models.py              # Pydantic models
│   ├── financial_routes.py    # Financial endpoints
│   ├── sync_routes.py         # Device sync
│   ├── super_admin_routes.py  # Super admin CRUD
│   ├── super_admin_global_routes.py  # Results management
│   ├── company_admin_routes.py  # Company admin CRUD
│   ├── universal_pos_routes.py  # POS sales
│   ├── settings_routes.py     # Settings & logo
│   ├── create_super_admin.py  # Production admin creation
│   ├── .env                   # Environment variables
│   └── .env.production.example  # Production template
├── frontend/
│   ├── src/
│   │   ├── App.js            # Routes configuration
│   │   ├── pages/
│   │   │   ├── LoginPage.js  # Login (no demo accounts)
│   │   │   ├── SuperDashboardPage.js
│   │   │   ├── CompanyDashboardPage.js
│   │   │   └── agent/        # Agent POS pages
│   │   └── components/
│   └── .env                  # Frontend env
├── PRODUCTION_CONFIG.md      # Deployment guide
└── memory/
    └── PRD.md               # This file
```

---

### Production Deployment Checklist

- [x] JWT_SECRET_KEY environment variable required
- [x] Production deployment guide created
- [x] Super Admin creation script available
- [x] No demo accounts in UI
- [x] All API endpoints tested and working
- [x] Multi-tenant isolation verified
- [x] Financial system tested (check, payout, balances)
- [x] Device sync verified (5-second polling)
- [x] All three dashboards functional

---

### Prioritized Backlog

#### P0 - Critical (ALL COMPLETE)
- [x] Agent Balance System
- [x] Ticket Check System
- [x] Ticket Payout System
- [x] Automatic Winning Detection
- [x] Admin Visibility (Balances & Payouts)
- [x] Security: Remove demo accounts
- [x] Production deployment preparation

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
- **Session**: Production Deployment Preparation
- **Status**: System 100% production-ready for Hostinger deployment
- **Test Results**: All backend APIs working, all frontend pages verified
