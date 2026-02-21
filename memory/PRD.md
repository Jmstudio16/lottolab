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
   - Access to platform-wide statistics

2. **COMPANY_ADMIN**: Operational manager (DEMOTED from previous role)
   - **READ-ONLY access** to global lottery catalog, schedules, and results
   - Manages company branches (Succursales)
   - Manages agents and company users
   - Manages POS devices (with IMEI)
   - Manages vendors
   - Configures company settings:
     - Prime/Payout table (bet types and payout formulas)
     - Betting limits (min/max per ticket, per number, per agent)
     - Agent commission percentages
     - Marriage betting configuration
     - Receipt customization
   - Views statistics (agent control, blocked numbers, limits, winning tickets, audit logs)
   - Generates daily reports

3. **AGENT_POS**: Limited POS terminal access
   - Can only sell tickets
   - Views own tickets and sales
   - Cannot access Company Admin features

4. **AUDITOR_READONLY**: View-only access (implemented but limited scope)

---

## Implemented Features (February 2026)

### Super Admin Portal
- [x] Dashboard with platform stats (companies, agents, POS, tickets, sales)
- [x] Global Lottery Catalog (155 lotteries seeded)
- [x] Global Schedules management (CRUD)
- [x] Global Results entry (CRUD, auto-verified)
- [x] Company management (view, suspend, reactivate)
- [x] User management
- [x] Plans & Licenses
- [x] Activity logs
- [x] Platform settings
- [x] Seed lottery catalog endpoint

### Company Admin Portal
- [x] Dashboard with company stats
- [x] Branches (Succursales) management (CRUD)
- [x] Agents management (CRUD)
- [x] POS Devices management (CRUD with IMEI)
- [x] Lottery Catalog (view enabled lotteries)
- [x] Schedules (READ-ONLY view of global schedules)
- [x] Results (READ-ONLY view of global results)
- [x] Tickets management
- [x] Configuration module:
  - [x] General settings (stop sales, void window, auto-print)
  - [x] Prime/Payout table (editable payouts per bet type)
  - [x] Betting limits
  - [x] Marriage configuration
  - [x] Receipt customization
- [x] Statistics module:
  - [x] Agent control (performance by agent)
  - [x] Blocked numbers
  - [x] Sales limits
  - [x] Winning tickets
  - [x] Audit logs (traçabilité)
- [x] Daily Reports (generate and view)
- [x] Company users management
- [x] Activity logs
- [x] Company settings

### Agent POS Portal
- [x] POS terminal interface
- [x] Ticket selling
- [x] View own tickets
- [x] View own sales

---

## API Structure

### Super Admin Routes (`/api/super/*`)
- `GET/POST/PUT/DELETE /lottery-catalog` - Global lottery management
- `GET/POST/PUT/DELETE /global-schedules` - Global schedule management
- `GET/POST/PUT/DELETE /global-results` - Global results management
- `GET/PUT /companies-enhanced` - Enhanced company management
- `GET /all-agents` - View all agents globally
- `GET /all-pos-devices` - View all POS devices globally
- `GET /all-vendors` - View all vendors globally
- `GET /all-tickets` - View all tickets globally
- `GET /platform-stats` - Platform statistics
- `POST /seed-lottery-catalog` - Seed lottery data

### Company Admin Routes (`/api/company/*`)
- `GET /schedules` - READ-ONLY global schedules
- `GET /results` - READ-ONLY global results
- `GET/POST/PUT/DELETE /branches` - Branch management
- `GET/POST/PUT/DELETE /vendors` - Vendor management
- `GET/POST/PUT /prime-configs` - Payout configuration
- `GET/PUT /configuration` - Company configuration
- `GET/PUT /lottery-availability` - Enable/disable lotteries
- `GET/POST/DELETE /blocked-numbers` - Number blocking
- `GET/POST/DELETE /sales-limits` - Sales limits
- `GET /statistics/agent-control` - Agent statistics
- `GET /statistics/tickets-by-agent` - Tickets per agent
- `GET /statistics/winning-tickets` - Winning ticket stats
- `GET /statistics/tracability` - Audit logs
- `GET/POST/PUT /elimination-requests` - Elimination requests
- `GET/POST /daily-reports` - Daily reports

### Agent Routes (`/api/agent/*`)
- `GET /pos` - POS terminal
- `GET /my-tickets` - Own tickets
- `GET /my-sales` - Own sales

---

## Database Collections

- `users` - All users (Super Admin, Company Admin, Agents)
- `companies` - Company/tenant information
- `global_lotteries` - Master lottery catalog
- `global_schedules` - Global draw schedules
- `global_results` - Official lottery results
- `lotteries` - Legacy lottery collection
- `branches` - Company branches
- `agents` - Agent profiles
- `pos_devices` - POS device registry
- `vendors` - Vendor registry
- `tickets` - All tickets sold
- `prime_configs` - Payout configurations per company
- `company_configurations` - Company settings
- `company_lotteries` - Lottery availability per company
- `blocked_numbers` - Blocked numbers per company
- `sales_limits` - Sales limits per company
- `elimination_requests` - Ticket/number elimination requests
- `daily_reports` - Generated daily reports
- `activity_logs` - Audit trail

---

## Test Credentials

- **Super Admin**: jefferson@jmstudio.com / JMStudio@2026!
- **Company Admin**: admin@lotopam.com / Admin123!
- **Agent**: agent001@lotopam.com / Agent123!

---

## Changelog

### 2026-02-21
- Implemented complete RBAC refactoring:
  - Super Admin now controls global lottery catalog, schedules, and results
  - Company Admin demoted to operational role with read-only access to global data
- Seeded 155 lotteries (50 US states × 3 game types + 5 Haiti games)
- Implemented new Company Admin modules:
  - Branches (Succursales)
  - Vendors
  - Configuration (Primes, Limits, Marriage, Receipt)
  - Statistics (Agent control, Blocked numbers, Limits, Winning tickets, Audit)
  - Daily Reports
- Made Schedules and Results pages read-only for Company Admin
- Updated sidebar navigation for both Super Admin and Company Admin

### 2026-02-20
- Initial Company Admin portal MVP
- Agent/Company Admin RBAC separation
- Fixed Agents page crash
- Fixed Select component issues

---

## Roadmap

### P1 - Next Priorities
- [ ] Implement POS device IMEI validation
- [ ] Add vendor assignment to POS devices
- [ ] Implement automatic result verification with ticket matching
- [ ] Add thermal printer integration

### P2 - Future Features
- [ ] QR code ticket verification
- [ ] Advanced reporting with charts
- [ ] Multi-currency support
- [ ] Mobile responsive POS interface

### P3 - Enhancements
- [ ] Email notifications
- [ ] SMS notifications (Twilio)
- [ ] Webhook integrations
- [ ] API documentation (Swagger/OpenAPI)
