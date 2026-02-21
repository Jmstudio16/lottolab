# LOTTOLAB - Lottery SaaS Platform
## Product Requirements Document (PRD)

### Overview
LOTTOLAB is a full-stack, multi-tenant Lottery SaaS platform with strict RBAC hierarchy for managing lottery operations, agents, POS devices, and ticket sales.

---

## Core Architecture

### Technology Stack
- **Backend**: FastAPI (Python), MongoDB (motor async driver)
- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Authentication**: JWT-based with role-based access control
- **Database**: MongoDB with collections for users, companies, lotteries, schedules, results, tickets, etc.

### RBAC Hierarchy (FINAL - Implemented)
1. **SUPER_ADMIN**: Absolute master control
   - Manages global lottery catalog (155 lotteries: 50 US states × 3 game types + 5 Haiti games)
   - Controls global schedules (draw times, open/close windows)
   - Enters official results (auto-verified)
   - Manages all companies (suspend, reactivate, change subscription)
   - Views all agents, POS devices, vendors, tickets globally
   - Views and manages all device sessions globally
   - Access to platform-wide statistics

2. **COMPANY_ADMIN**: Operational manager
   - **READ-ONLY access** to global lottery catalog, schedules, and results
   - Manages company branches (Succursales)
   - Manages agents and company users
   - Manages POS devices (with IMEI)
   - Manages vendors
   - Manages device sessions for company agents
   - Sets agent device permissions (ANY_DEVICE or POS_ONLY)
   - Configures company settings

3. **AGENT_POS**: Universal Terminal Access (NEW - IMPLEMENTED)
   - Access from ANY device (POS, Computer, Phone, Tablet, Browser)
   - Sells lottery tickets
   - Views own tickets and sales
   - Views lottery results
   - Generates personal reports
   - Real-time sync every 5 seconds

4. **AUDITOR_READONLY**: View-only access

---

## Implemented Features (February 2026)

### ✅ Universal Agent Terminal System (NEW - COMPLETED)

#### Authentication
- [x] Universal login endpoint `POST /api/auth/agent/login`
- [x] Supports both Hardware POS (with IMEI header) and Universal devices
- [x] Automatic device type detection (POS, COMPUTER, PHONE, TABLET, BROWSER)
- [x] Device session tracking in `device_sessions` collection

#### Real-Time Synchronization
- [x] `GET /api/device/config` - Load all config on startup
- [x] `GET /api/device/sync` - Poll every 5 seconds for updates
- [x] Returns: latest results, daily stats, balance, config updates

#### Lottery Sales Engine
- [x] `POST /api/lottery/sell` - Process ticket sales
- [x] Validates game status, cutoff times, betting limits
- [x] Records device_session_id, pos_device_id, device_type
- [x] QR code generation for tickets

#### Ticket Management
- [x] `POST /api/lottery/cancel` - Cancel tickets within void window
- [x] `GET /api/agent/tickets` - View agent's tickets
- [x] `GET /api/ticket/print/{ticket_id}` - Printable HTML ticket

#### Results & Reports
- [x] `GET /api/results/latest` - Latest lottery results
- [x] `GET /api/agent/reports` - Agent sales reports

#### Frontend Pages
- [x] `/agent/login` - Universal agent login page
- [x] `/agent/dashboard` - Dashboard with stats and quick actions
- [x] `/agent/new-ticket` - New ticket/sale creation
- [x] `/agent/tickets` - Tickets list with filters
- [x] `/agent/results` - Lottery results view
- [x] `/agent/reports` - Sales reports

### ✅ Device Session Management (NEW - COMPLETED)

#### Company Admin
- [x] `GET /api/company/device-sessions` - View company device sessions
- [x] `PUT /api/company/device-sessions/{id}/block` - Block session
- [x] `PUT /api/company/device-sessions/{id}/unblock` - Unblock session
- [x] `PUT /api/company/agents/{id}/device-permission` - Set agent permissions

#### Super Admin
- [x] `GET /api/super/all-device-sessions` - View all sessions globally
- [x] `GET /api/super/device-sessions/stats` - Session statistics
- [x] `PUT /api/super/device-sessions/{id}/block` - Block any session
- [x] `PUT /api/super/device-sessions/{id}/unblock` - Unblock any session

### ✅ Super Admin Portal
- [x] Dashboard with platform stats
- [x] Global Lottery Catalog (155 lotteries seeded)
- [x] Global Schedules management
- [x] Global Results entry
- [x] Company management
- [x] User management
- [x] Plans & Licenses
- [x] Activity logs
- [x] Platform settings

### ✅ Company Admin Portal
- [x] Dashboard with company stats
- [x] Branches (Succursales) management
- [x] Agents management
- [x] POS Devices management
- [x] Lottery Catalog (view enabled lotteries)
- [x] Schedules (READ-ONLY view)
- [x] Results (READ-ONLY view)
- [x] Tickets management
- [x] Configuration module
- [x] Statistics module
- [x] Daily Reports

---

## API Structure

### Universal Agent Terminal Routes (`/api/`)
- `POST /auth/agent/login` - Universal agent login
- `GET /device/config` - Device configuration
- `GET /device/sync` - Real-time sync
- `POST /lottery/sell` - Sell ticket
- `POST /lottery/cancel` - Cancel ticket
- `GET /agent/tickets` - Agent's tickets
- `GET /agent/reports` - Agent's reports
- `GET /results/latest` - Latest results
- `GET /ticket/print/{id}` - Print ticket

### Super Admin Routes (`/api/super/*`)
- All lottery catalog CRUD
- All schedule CRUD
- All result CRUD
- All device session management
- Company management

### Company Admin Routes (`/api/company/*`)
- Device session management
- Agent permission management
- Branch/Vendor/Configuration management
- Read-only access to global data

---

## Database Collections

### Core Collections
- `users` - All users with roles
- `companies` - Company/tenant information
- `global_lotteries` - Master lottery catalog
- `global_schedules` - Global draw schedules
- `global_results` - Official lottery results

### Agent/Device Collections (NEW)
- `device_sessions` - All device sessions (POS, Browser, Phone, etc.)
- `agent_permissions` - Agent device permissions
- `lottery_transactions` - All ticket sales with device tracking
- `pos_devices` - Registered POS hardware devices

### Company Collections
- `branches` - Company branches
- `agents` - Agent profiles
- `vendors` - Vendor registry
- `prime_configs` - Payout configurations
- `company_configurations` - Company settings
- `blocked_numbers` - Blocked numbers
- `sales_limits` - Sales limits

---

## Test Credentials

- **Super Admin**: jefferson@jmstudio.com / JMStudio@2026!
- **Company Admin**: admin@lotopam.com / Admin123!
- **Agent**: agent001@lotopam.com / Agent123!

---

## Changelog

### 2026-02-21 (Latest)
- **MAJOR: Implemented Universal Agent Terminal System**
  - Created `universal_pos_routes.py` with all POS endpoints
  - Universal authentication (IMEI for POS, fingerprint for browsers)
  - Real-time sync every 5 seconds
  - Lottery sales engine with QR code generation
  - Ticket printing system (80mm thermal + standard)
  - Complete agent frontend with responsive layout
- **Added Device Session Management**
  - Company Admin can view/block/unblock sessions
  - Company Admin can set agent device permissions
  - Super Admin has global device session oversight
  - Session statistics endpoint

### 2026-02-21 (Earlier)
- Implemented complete RBAC refactoring
- Super Admin now controls global lottery catalog, schedules, and results
- Company Admin demoted to operational role with read-only access
- Seeded 155 lotteries (50 US states × 3 game types + 5 Haiti games)

---

## Roadmap

### P0 - Completed ✅
- [x] Universal Agent Terminal System
- [x] Device session management
- [x] Real-time synchronization

### P1 - Next Priorities
- [ ] Hardware POS IMEI activation flow testing
- [ ] Company Admin UI for device session management
- [ ] Super Admin UI for global device oversight
- [ ] Automatic result verification with ticket matching

### P2 - Future Features
- [ ] QR code ticket verification scanner
- [ ] Advanced reporting with charts
- [ ] Thermal printer direct integration
- [ ] Mobile app for agents

### P3 - Enhancements
- [ ] Email/SMS notifications
- [ ] Webhook integrations
- [ ] API documentation (Swagger/OpenAPI)
