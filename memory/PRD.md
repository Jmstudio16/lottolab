# LOTTOLAB - Multi-Tenant Lottery SaaS Platform

## Product Overview
LOTTOLAB is a production-ready, multi-tenant lottery management SaaS platform with STRICT Role-Based Access Control (RBAC) separating Company Admin and Agent roles completely.

## RBAC Architecture

### Role Hierarchy
```
SUPER_ADMIN     → Platform-wide administration
COMPANY_ADMIN   → Company-level FULL control
COMPANY_MANAGER → Company operations management  
AUDITOR_READONLY → View-only access
AGENT_POS       → LIMITED access (POS only)
```

### Access Matrix

| Feature | Company Admin | Company Manager | Auditor | Agent |
|---------|--------------|-----------------|---------|-------|
| Dashboard | ✅ | ✅ | ✅ | ❌ |
| Agents CRUD | ✅ | ✅ | ❌ | ❌ |
| POS Devices CRUD | ✅ | ✅ | ❌ | ❌ |
| Lottery Catalog | ✅ | ✅ | ❌ | ❌ |
| Schedules CRUD | ✅ | ✅ | ❌ | ❌ |
| Results CRUD | ✅ | ✅ | ❌ | ❌ |
| ALL Tickets | ✅ | ✅ | ✅ | ❌ |
| Reports (ALL) | ✅ | ✅ | ✅ | ❌ |
| Company Users | ✅ | ❌ | ❌ | ❌ |
| Activity Logs | ✅ | ❌ | ✅ | ❌ |
| Settings | ✅ | ❌ | ❌ | ❌ |
| POS Terminal | ❌ | ❌ | ❌ | ✅ |
| My Tickets | ❌ | ❌ | ❌ | ✅ |
| My Sales | ❌ | ❌ | ❌ | ✅ |

## Company Admin Portal (FULL ACCESS)

### Sidebar Menu
- Dashboard
- Agents
- POS Devices
- Lottery Catalog
- Schedules
- Results
- Tickets (ALL)
- Reports (ALL)
- Company Users
- Activity Logs
- Settings

### Permissions
- Create/Edit/Delete Agents
- Assign POS devices to agents
- Enable/disable lotteries
- Manage schedules
- Create/view results
- View ALL company tickets
- View ALL sales reports
- Manage company staff
- Configure company settings

## Agent Portal (LIMITED ACCESS)

### Sidebar Menu
- POS Terminal
- My Tickets
- My Sales
- Logout

### Permissions
- ✅ Login
- ✅ Access POS terminal
- ✅ Sell tickets
- ✅ View ONLY own tickets
- ✅ View ONLY own sales summary
- ❌ Create agents
- ❌ Create POS devices
- ❌ Modify schedules
- ❌ Modify results
- ❌ Access company settings
- ❌ Access company reports
- ❌ Access company users
- ❌ Access other agents data

## API Endpoints

### Company Routes (Admin/Manager only)
```
/api/company/agents         - Agents CRUD
/api/company/pos-devices    - POS devices CRUD
/api/company/schedules      - Schedules CRUD
/api/company/tickets        - ALL company tickets
/api/company/results        - Results CRUD
/api/company/reports        - Company reports
/api/company/users          - Company staff CRUD
/api/company/activity-logs  - Audit logs
/api/company/settings       - Company config
```

### Agent Routes (Agent only)
```
/api/agent/profile          - Agent's own profile
/api/agent/my-tickets       - Agent's own tickets ONLY
/api/agent/my-sales         - Agent's own sales ONLY
/api/agent/pos/lotteries    - Open lotteries
/api/agent/pos/sell         - Sell ticket
/api/agent/pos/daily-summary - Agent's daily stats
```

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | jefferson@jmstudio.com | JMStudio@2026! |
| Company Admin | admin@lotopam.com | Admin123! |
| Agent | testagent001@lotopam.com | Test123! |

## RBAC Validation Results
- ✅ Agent cannot access /company/* routes (403 Forbidden)
- ✅ Agent automatically redirected to /agent/pos
- ✅ Agent sees limited menu (POS Terminal, My Tickets, My Sales)
- ✅ Agent can only view own tickets
- ✅ Company Admin has full access to all company features
- ✅ Ticket sale by agent works correctly
- ✅ Multi-tenant isolation maintained

---
*Last Updated: February 21, 2026*
