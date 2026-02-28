# LOTTOLAB - Enterprise Lottery SaaS Platform
## Product Requirements Document (PRD)

### Overview
LOTTOLAB is a production-ready, enterprise-grade multi-tenant Lottery SaaS platform with hierarchical RBAC model (SUPER_ADMIN, COMPANY_ADMIN, BRANCH_SUPERVISOR, AGENT_POS). The system includes **LOTO PAM**, a public-facing online gaming platform.

**Status**: ✅ **PRODUCTION READY - ENTERPRISE SAAS**
**Last Update**: 2026-02-28
**Current Phase**: SaaS Enterprise Core Complete

---

## Architecture Overview

### Multi-Tenant Hierarchy
```
SUPER ADMIN (Platform Owner)
    ├── Controls 220 Master Lotteries (Global Source)
    ├── Controls Global Schedules
    ├── Manages Companies (License, Suspend, Activate)
    └── Views All Data Across Platform

COMPANY ADMIN (SaaS Client)
    ├── Sees only globally active lotteries
    ├── Cannot modify schedules (read-only)
    ├── Manages Succursales (Branches)
    └── Views only own company data

BRANCH SUPERVISOR
    ├── Manages agents in succursale
    └── Views branch reports

AGENT POS
    ├── Sells tickets
    └── Views own sales/results
```

---

## Implementation Status

### ✅ SaaS Enterprise Core - COMPLETE (2026-02-28)

#### 1. Centralized Lottery Catalog (220 Lotteries)
- [x] `master_lotteries` collection - single source of truth
- [x] `company_lotteries` pivot table for company access
- [x] Super Admin `is_active_global` control
- [x] Auto-disable for ALL companies when globally disabled
- [x] Company cannot enable if disabled by Super Admin

#### 2. Global Schedules (Super Admin Only)
- [x] `global_schedules` collection
- [x] Super Admin: full CRUD
- [x] Company Admin: READ ONLY
- [x] Agents: READ ONLY
- [x] Creation blocked for non-super-admin (403)

#### 3. Company Creation (Full Auto-Setup)
- [x] Full form: name, slogan, email, password, plan, timezone, currency, commission
- [x] Auto-create Company Admin user
- [x] Auto-create default configuration
- [x] Auto-link ALL 220 active lotteries
- [x] Activity logging

#### 4. License Management
- [x] Plans: Starter, Basic, Professional, Enterprise
- [x] `license_end` expiration date
- [x] Auto-expire check on login
- [x] Super Admin suspend/activate
- [x] Super Admin extend license

#### 5. Heartbeat Online System
- [x] `/heartbeat/company` - 30s ping
- [x] `/heartbeat/agent` - 30s ping
- [x] Auto-offline after 2 minutes
- [x] Super Admin online status dashboard

#### 6. Multi-Tenant Isolation
- [x] `company_id` on all business entities
- [x] Middleware guards for company access
- [x] Super Admin bypass (sees all)
- [x] Cross-company access blocked

### ✅ Company Admin Restructure - COMPLETE (2026-02-27)
- [x] **REMOVED** POS Devices menu
- [x] **REMOVED** Agents menu (standalone)
- [x] **NEW** Succursales management
- [x] Agents created ONLY within succursales
- [x] BRANCH_SUPERVISOR and BRANCH_USER roles
- [x] Delete agent/succursale with validation

### ✅ LOTO PAM Phase 1 & 2 - COMPLETE
- [x] Public user registration/login
- [x] Wallet system (MonCash/NatCash)
- [x] KYC verification flow
- [x] Lottery engine with winner detection
- [x] WebSocket notifications
- [x] Security (bet limits, account lockout)

---

## Key Technical Specs

### Database Collections
- `master_lotteries` - 220 global lotteries (source of truth)
- `company_lotteries` - Company access pivot (company_id + lottery_id)
- `global_schedules` - Draw schedules (Super Admin managed)
- `companies` - SaaS clients with license info
- `users` - All users with role and company_id
- `succursales` - Branches with supervisor
- `agent_policies` - Agent settings and limits

### Key API Routes
- `/api/saas/master-lotteries` - Central lottery management
- `/api/saas/global-schedules` - Schedule management
- `/api/saas/companies/full-create` - Company creation
- `/api/saas/online-status` - Online tracking
- `/api/company/succursales` - Branch management

---

## Seed Data
- 220 Master Lotteries (34 US states + Haiti + Dominican Republic)
- 10 Haiti PREMIUM lotteries with schedules
- 4 Plans (Starter, Basic, Professional, Enterprise)
- Demo Company: LotoPam Demo (admin@lotopam.com)

---

## Test Credentials
- **Super Admin**: jefferson@jmstudio.com / JMStudio@2026!
- **Company Admin**: admin@lotopam.com / Admin123!

---

## Remaining Tasks (Backlog)

### P0 - High Priority
- [ ] Company Users permissions fix (suspend/delete working)
- [ ] Tickets synchronization real-time validation
- [ ] Results & Winners automatic detection verification

### P1 - Medium Priority
- [ ] Phase 3: Keno engine with auto-draw
- [ ] Phase 3: Raffle/Tombola system
- [ ] Complete i18n translations

### P2 - Low Priority
- [ ] SMS/Email notifications
- [ ] QR code ticket verification
- [ ] PDF/CSV export reports
- [ ] Festive animations for lotopam.com
