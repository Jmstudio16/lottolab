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

#### 3. Company Admin Full Control
- Real-time visibility of all:
  - Tickets sold
  - Numbers/balls played
  - Voided tickets
  - Printed tickets
  - Agent activity
  - Device logins
  - Sales reports

---

### What's Been Implemented

#### Backend (100% Complete)

##### Company Admin CRUD Endpoints (`/api/company/`)
| Endpoint | Method | Status |
|----------|--------|--------|
| `/agents` | GET | ✅ Complete |
| `/agents` | POST | ✅ Complete |
| `/agents/{id}` | GET | ✅ Complete |
| `/agents/{id}` | PUT | ✅ Complete |
| `/agents/{id}/status` | PUT | ✅ Complete |
| `/pos-devices` | GET | ✅ Complete |
| `/pos-devices` | POST | ✅ Complete |
| `/pos-devices/{id}` | PUT | ✅ Complete |
| `/pos-devices/{id}/status` | PUT | ✅ Complete |
| `/pos-devices/{id}/assign-agent` | PUT | ✅ Complete |
| `/tickets` | GET | ✅ Complete |
| `/tickets/{id}` | GET | ✅ Complete |
| `/tickets/stats/summary` | GET | ✅ Complete |
| `/activity-logs` | GET | ✅ Complete |
| `/lottery-catalog` | GET | ✅ Complete |
| `/lottery-catalog/{id}/toggle` | PUT | ✅ Complete |
| `/pos-rules` | GET | ✅ Complete |
| `/pos-rules` | PUT | ✅ Complete |
| `/blocked-numbers` | GET/POST/DELETE | ✅ Complete |
| `/limits` | GET/POST/PUT/DELETE | ✅ Complete |
| `/reports/sales` | GET | ✅ Complete |
| `/reports/agents-performance` | GET | ✅ Complete |
| `/config-version` | GET | ✅ Complete |

##### Real-Time Sync Endpoints (`/api/`)
| Endpoint | Method | Status |
|----------|--------|--------|
| `/device/config` | GET | ✅ Complete |
| `/device/sync` | GET | ✅ Complete |
| `/ticket/print/{id}` | GET | ✅ Complete (HTML thermal/A4) |
| `/ticket/reprint/{id}` | POST | ✅ Complete |
| `/results/today` | GET | ✅ Complete |
| `/results/history` | GET | ✅ Complete |

##### Agent Endpoints (`/api/`)
| Endpoint | Method | Status |
|----------|--------|--------|
| `/auth/agent/login` | POST | ✅ Complete |
| `/lottery/sell` | POST | ✅ Complete |

#### Frontend
- Agent UI complete (login, dashboard, new ticket)
- Company Admin UI - Pending full implementation

---

### Prioritized Backlog

#### P0 - Critical (In Progress)
- [ ] Frontend: Company Admin pages connected to real backend endpoints
- [ ] Frontend: Agent CRUD page with full profile editing
- [ ] Frontend: POS Device management page
- [ ] Frontend: Tickets viewer with filters
- [ ] Frontend: Activity Logs viewer
- [ ] Frontend: Reports dashboard
- [ ] Frontend: Lottery Catalog toggle controls
- [ ] Frontend: Blocked Numbers management
- [ ] Frontend: Sales Limits management

#### P1 - High Priority
- [ ] WebSockets for push-based real-time updates (optional enhancement)
- [ ] Automated ticket verification using QR codes
- [ ] Dashboard KPIs and charts

#### P2 - Medium Priority
- [ ] Agent balance/credit management
- [ ] Winning ticket payout workflow
- [ ] Agent commission calculations

---

### Database Collections

| Collection | Purpose |
|------------|---------|
| `users` | All users (admins, agents) |
| `companies` | Company profiles |
| `agents` | Agent-specific data (deprecated, moving to users) |
| `agent_policies` | Agent permissions and limits |
| `pos_devices` | POS device registry |
| `device_sessions` | Active device sessions |
| `company_lotteries` | Company lottery catalog |
| `global_lotteries` | System-wide lotteries |
| `global_schedules` | Draw schedules |
| `global_results` | Lottery results |
| `lottery_transactions` | Sold tickets |
| `activity_logs` | Full audit trail |
| `blocked_numbers` | Blocked number list |
| `sales_limits` | Sales limits per lottery/agent |
| `company_pos_rules` | POS operational rules |
| `company_config_versions` | Config version tracking |
| `prime_configs` | Payout configurations |

---

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | jefferson@jmstudio.com | JMStudio@2026! |
| Company Admin | admin@lotopam.com | Admin123! |
| Agent | agent001@lottolab.com | Agent123! |

---

### API Documentation

Base URL: `${REACT_APP_BACKEND_URL}/api`

#### Authentication
All endpoints require JWT Bearer token in header:
```
Authorization: Bearer <token>
```

#### Real-Time Sync Flow
1. Agent logs in → receives token
2. Agent calls `GET /device/config` → gets full configuration
3. Every 5 seconds: Agent calls `GET /device/sync?last_config_version=N`
4. If `config_changed=true` → reload full config
5. Update local state with `latest_results`, `blocked_numbers`, `limits`

---

### Last Updated
- Date: 2026-02-21
- Session: Real-Time Sync Backend Implementation
- Status: Backend 100% complete, 33/33 tests passed
