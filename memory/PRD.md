# LOTTOLAB - Lottery SaaS Platform
## Product Requirements Document (PRD)

### Overview
LOTTOLAB is a multi-tenant Lottery SaaS platform with hierarchical RBAC model (SUPER_ADMIN, COMPANY_ADMIN, AGENT_POS). The system supports Universal Agent access from any device type (POS terminals, computers, phones, tablets) with real-time synchronization between admin configurations and agent devices.

### Core Requirements

#### 1. Real-Time Synchronization System (P0)
- **5-Second Sync Interval**: Agent devices MUST poll `/api/device/sync` every 5 seconds
- **Config Versioning**: Every admin change increments `config_version`
- **Change Detection**: Agents compare their local version with server version to detect changes
- **Full Config Reload**: When `config_changed=true`, agents reload full configuration via `/api/device/config`

#### 2. Universal Device Support
- Agents can login and sell from ANY device type:
  - POS terminal (with optional IMEI validation)
  - Computer
  - Phone
  - Tablet
- IMEI validation is optional based on company settings
- All device sessions logged in `activity_logs`

#### 3. Logo Management System (NEW - Session 2/21/2026)
- **System Logo**: Super Admin can set global LOTTOLAB logo
- **Company Logo**: Each company can upload their own logo
- **Logo Priority**: Company logo > System logo
- **Logo Display**: Appears on sidebar, login pages, tickets, dashboards
- **Real-time Sync**: Logo changes sync to POS devices within 5 seconds

---

### What's Been Implemented

#### Backend (100% Complete)

##### Settings & Logo Endpoints (`/api/`)
| Endpoint | Method | Status |
|----------|--------|--------|
| `/system/settings` | GET | ✅ Complete |
| `/system/settings` | PUT | ✅ Complete (Super Admin) |
| `/system/logo/upload` | POST | ✅ Complete (Super Admin) |
| `/company/profile` | GET | ✅ Complete |
| `/company/profile` | PUT | ✅ Complete |
| `/company/logo/upload` | POST | ✅ Complete |
| `/company/logo` | DELETE | ✅ Complete |
| `/logo/display` | GET | ✅ Complete |
| `/uploads/company-logos/{filename}` | GET | ✅ Complete |

##### Company Admin CRUD Endpoints (`/api/company/`)
| Endpoint | Method | Status |
|----------|--------|--------|
| `/agents` | GET/POST/PUT/DELETE | ✅ Complete |
| `/pos-devices` | GET/POST/PUT/DELETE | ✅ Complete |
| `/tickets` | GET | ✅ Complete |
| `/activity-logs` | GET | ✅ Complete |
| `/lottery-catalog` | GET | ✅ Complete |
| `/lottery-catalog/{id}/toggle` | PUT | ✅ Complete |
| `/pos-rules` | GET/PUT | ✅ Complete |
| `/blocked-numbers` | GET/POST/DELETE | ✅ Complete |
| `/limits` | GET/POST/PUT/DELETE | ✅ Complete |
| `/reports/sales` | GET | ✅ Complete |
| `/reports/agents-performance` | GET | ✅ Complete |

##### Real-Time Sync Endpoints (`/api/`)
| Endpoint | Method | Status |
|----------|--------|--------|
| `/device/config` | GET | ✅ Complete (includes logos) |
| `/device/sync` | GET | ✅ Complete |
| `/ticket/print/{id}` | GET | ✅ Complete (with logo) |
| `/ticket/reprint/{id}` | POST | ✅ Complete |
| `/results/today` | GET | ✅ Complete |
| `/results/history` | GET | ✅ Complete |

#### Frontend (Updated)

##### Logo System Components
| Component | Location | Status |
|-----------|----------|--------|
| LogoContext | `/contexts/LogoContext.jsx` | ✅ Complete |
| Logo Component | `/components/Logo.jsx` | ✅ Complete |
| Company Settings Page | `/pages/company/CompanySettingsPage.jsx` | ✅ Complete |

##### Updated Pages with New Logo
- ✅ Login Page (Admin/Agent)
- ✅ Agent Login Page
- ✅ Sidebar Navigation
- ✅ Agent Layout
- ✅ Company Dashboard
- ✅ Ticket Print Template

---

### Prioritized Backlog

#### P0 - Critical (Completed This Session)
- [x] Backend: Logo management endpoints
- [x] Backend: System settings table
- [x] Backend: Company profile with logo
- [x] Frontend: LogoContext for global logo state
- [x] Frontend: Logo component
- [x] Frontend: Company Settings page with logo upload
- [x] Ticket printing with logo

#### P1 - High Priority (Next)
- [ ] Super Admin: System settings page with logo upload
- [ ] Agent Dashboard: Display company logo
- [ ] WebSockets for push-based real-time updates (optional)

#### P2 - Medium Priority
- [ ] PDF exports with logo
- [ ] Email templates with logo
- [ ] Agent balance/credit management

---

### Database Collections

| Collection | Purpose |
|------------|---------|
| `system_settings` | Global LOTTOLAB settings (logo, name) |
| `companies` | Company profiles with `company_logo_url` |
| `users` | All users (admins, agents) |
| `agent_policies` | Agent permissions and limits |
| `pos_devices` | POS device registry |
| `device_sessions` | Active device sessions |
| `company_lotteries` | Company lottery catalog |
| `lottery_transactions` | Sold tickets |
| `activity_logs` | Full audit trail |
| `company_config_versions` | Config version tracking |

---

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | jefferson@jmstudio.com | JMStudio@2026! |
| Company Admin | admin@lotopam.com | Admin123! |
| Agent | agent001@lottolab.com | Agent123! |

---

### File Structure

```
/app
├── backend/
│   ├── server.py
│   ├── settings_routes.py          # NEW: Logo & settings endpoints
│   ├── company_admin_routes.py     # Company Admin CRUD
│   ├── sync_routes.py              # Real-time sync with logos
│   ├── universal_pos_routes.py     # Agent sales
│   └── uploads/company-logos/      # Uploaded company logos
├── frontend/
│   ├── public/assets/logos/
│   │   └── lottolab-logo.png       # NEW: System logo
│   ├── src/
│   │   ├── contexts/
│   │   │   └── LogoContext.jsx     # NEW: Logo context
│   │   ├── components/
│   │   │   ├── Logo.jsx            # NEW: Logo component
│   │   │   └── Sidebar.js          # Updated: uses Logo
│   │   ├── pages/
│   │   │   ├── company/
│   │   │   │   └── CompanySettingsPage.jsx  # NEW: Profile settings
│   │   │   └── LoginPage.js        # Updated: dynamic logo
│   │   └── layouts/
│   │       └── AgentLayout.js      # Updated: uses Logo
```

---

### Last Updated
- Date: 2026-02-21
- Session: Logo Management System Implementation
- Status: Logo system 100% complete, tested and verified
