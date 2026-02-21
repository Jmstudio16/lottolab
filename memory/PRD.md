# LOTTOLAB - Multi-Tenant Lottery SaaS Platform

## Product Overview
LOTTOLAB is a production-ready, multi-tenant lottery management SaaS platform designed for managing lottery sales across multiple companies. Inspired by PeopleHub HRMS UI design with a professional dark mode theme featuring gold and blue accents.

## Core Architecture
- **Frontend**: React with Tailwind CSS, shadcn/ui components
- **Backend**: FastAPI with MongoDB (motor async driver)
- **Authentication**: JWT-based with role-based access control
- **Multi-tenancy**: Strict `company_id` isolation on all data operations

## User Roles (RBAC)
1. **SUPER_ADMIN**: Platform-wide administration
2. **COMPANY_ADMIN**: Company-level full control
3. **COMPANY_MANAGER**: Company operations management
4. **AUDITOR_READONLY**: View-only access
5. **AGENT_POS**: Point of sale operations

## Implemented Features

### Phase 1: Super Admin Portal ✅
- **Dashboard**: Platform statistics overview
- **Companies**: Full CRUD for tenant companies
- **Users**: Manage all platform users
- **Plans**: Subscription plan management
- **Activity Logs**: Platform-wide audit trail
- **Global Settings**: System configuration

### Phase 2: Company Admin Portal ✅ (Implemented Feb 21, 2026)
| Module | Status | Description |
|--------|--------|-------------|
| Dashboard | ✅ | Company KPIs: tickets today, sales, agents, open lotteries |
| Agents | ✅ | Full CRUD with login credentials, status toggle |
| POS Devices | ✅ | CRUD with IMEI validation, agent assignment, activate/block |
| Lottery Catalog | ✅ | Enable/disable lotteries for company |
| Schedules | ✅ | CRUD for lottery open/close/draw times by day |
| Results | ✅ | Create and view winning numbers |
| Tickets | ✅ | View filtered list (agent, status, date range) |
| Reports | ✅ | Sales summary by period (today/week/month) |
| Company Users | ✅ | CRUD for Manager/Auditor roles |
| Activity Logs | ✅ | Company-scoped audit trail with filters |
| Settings | ✅ | Timezone, currency, sales parameters, receipt config |

### Phase 3: POS Interface (Existing)
- Agent login
- Lottery selection
- Ticket creation
- Receipt printing

## API Endpoints

### Company Routes (`/api/company/*`)
```
GET/POST/PUT/DELETE /pos-devices      - POS device management
PUT /pos-devices/{id}/activate|block  - Device status
PUT /pos-devices/{id}/assign/{agent}  - Agent assignment

GET/POST/PUT/DELETE /agents           - Agent management
GET/POST/PUT/DELETE /schedules        - Schedule management
GET/POST /tickets                     - Ticket listing
GET/POST/DELETE /results              - Results management
GET /reports/summary                  - Sales reports
GET/POST/PUT/DELETE /users            - Company staff
GET /activity-logs                    - Audit logs
GET/PUT /settings                     - Company config
```

## Database Collections
- `companies`, `users`, `agents`, `pos_devices`
- `lotteries`, `company_lotteries`, `schedules`
- `tickets`, `results`, `activity_logs`, `company_settings`

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | jefferson@jmstudio.com | JMStudio@2026! |
| Company Admin | admin@lotopam.com | Admin123! |
| Agent | agent001@lotopam.com | Agent123! |

## Testing Status
- **Backend**: 100% (31/31 tests passed)
- **Frontend**: All 9 Company Admin pages loading without errors
- **P0 Bug (Agents page crash)**: FIXED

## Future Tasks (Backlog)
1. Advanced Reports (custom date ranges, export to PDF/Excel)
2. Automated ticket verification with results
3. Support for all 50 US states
4. Thermal printer integration
5. Mobile-responsive POS optimization
6. Real-time notifications
7. Agent commission tracking

---
*Last Updated: February 21, 2026*
