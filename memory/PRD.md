# LOTTOLAB SaaS Enterprise - Product Requirements Document

## Overview
LOTTOLAB is a multi-tenant lottery management SaaS platform designed for the Haitian market. The platform enables companies to manage lottery operations with strict data isolation, subscription-based access, and hierarchical user management.

## Core Architecture

### Multi-Tenant Design
- **Strict Data Isolation**: All business data filtered by `company_id`
- **Centralized Master Data**: `master_lotteries` and `global_schedules` managed by Super Admin
- **Hierarchical Roles**: Super Admin > Company Admin > Manager > Supervisor > Agent

### Authentication & Authorization
- **Email-based Login**: All users authenticate via unique email + password
- **JWT Token Authentication**: Secure token-based API access
- **Company Status Middleware**: Blocks access for suspended/expired/deleted companies

## Key Features Implemented

### 1. SaaS Company Lifecycle (✅ Complete)
- **Create Company**: Full-featured form with admin setup and lottery sync
- **Suspend Company**: Blocks all users immediately (403 on login/API)
- **Activate Company**: Reactivates company admin (others stay suspended for security)
- **Soft Delete Company**: status=DELETED, preserves all data, visible in archives
- **Restore Company**: Recovers deleted company with new subscription

### 2. Automatic Subscription Management (✅ Complete)
- **Daily Cron Job**: Runs at 00:00 UTC via APScheduler
- **Automatic Expiration**: Companies with expired subscriptions → status=EXPIRED
- **User Blocking**: All users of expired company are suspended
- **Notifications**: Super Admin receives notifications for expired subscriptions
- **Expiring Soon Alerts**: Companies expiring within 7 days are flagged

### 3. Subscription Counter (✅ Complete)
- **Company Admin Dashboard**: Shows remaining days with visual progress bar
- **Color Coding**: Green (>15 days), Yellow (5-15 days), Red (<5 days)
- **Expiration Alerts**: Critical warning banner when near expiration

### 4. Staff Permissions & RBAC (✅ Complete)
- **Role-Based Access Control**: Permissions defined per role
- **Staff Management CRUD**: Create, suspend, activate, delete staff members
- **Login Blocking**: Suspended staff cannot log in
- **Permission Levels**: COMPANY_ADMIN(100) > COMPANY_MANAGER(80) > AUDITOR(40) > BRANCH_USER(20)

### 5. Edit Company Modal (✅ Complete)
- **Modifiable Fields**: Name, Email, Plan, Commission, Subscription End Date, Status
- **Automatic User Sync**: Status changes cascade to all company users
- **Activity Logging**: All modifications are logged with before/after values

## Database Collections

### Core Collections
| Collection | Purpose |
|-----------|---------|
| `companies` | SaaS tenant companies with subscription data |
| `users` | All users (admins, managers, agents, staff) |
| `succursales` | Branch/location management |
| `master_lotteries` | 220 global lottery definitions |
| `company_lotteries` | Company-specific lottery enablement |
| `global_schedules` | Lottery draw schedules |
| `tickets` | Sales transactions |

### System Collections
| Collection | Purpose |
|-----------|---------|
| `activity_logs` | Audit trail for all actions |
| `cron_logs` | Scheduled job execution history |
| `admin_notifications` | Super Admin alerts |

## API Endpoints

### SaaS Management (`/api/saas/`)
- `GET /companies` - List all companies with stats
- `GET /companies/{id}` - Company details with agents/succursales
- `POST /companies/full-create` - Create company + admin + sync lotteries
- `PUT /companies/{id}` - Update company (name, email, plan, status, etc.)
- `PUT /companies/{id}/suspend` - Suspend company
- `PUT /companies/{id}/activate` - Activate company
- `DELETE /companies/{id}` - Soft delete company
- `GET /archived-companies` - List deleted companies
- `PUT /companies/{id}/restore` - Restore deleted company
- `PUT /companies/{id}/extend-license` - Extend subscription
- `GET /my-subscription` - Company admin subscription status
- `GET /cron-logs` - Cron job execution history

### Staff Management (`/api/company/staff/`)
- `GET /` - List company staff
- `POST /` - Create staff member
- `PUT /{id}/suspend` - Suspend staff
- `PUT /{id}/activate` - Activate staff
- `DELETE /{id}` - Delete staff
- `GET /permissions` - Current user permissions
- `GET /roles` - Available staff roles

## User Credentials (Test)
| Role | Email | Password |
|------|-------|----------|
| Super Admin | jefferson@jmstudio.com | JMStudio@2026! |
| Company Admin | admin@lotopam.com | Admin123! |
| Staff Manager | manager@lotopam.com | Manager123! |

## Test Results (Iteration 12)
- **Backend**: 96% (24/25 tests passed)
- **Frontend**: 100% (16/16 tests passed)
- **Regression**: 100% (3/3 specs passed)

## Upcoming Tasks (Prioritized)

### P0 - Critical
- [x] Cron job automatic subscription expiration
- [x] Soft delete company
- [x] Real suspension blocking all users
- [x] Edit company with subscription dates
- [x] Subscription counter on dashboard
- [x] Staff permissions RBAC

### P1 - High Priority
- [ ] Winner Detection & Automatic Payout System
- [ ] Centralized Activity Logs Dashboard
- [ ] SMS/Email Notifications for subscriptions

### P2 - Medium Priority
- [ ] Resume LOTO PAM public platform (Keno, Raffle)
- [ ] Complete i18n translations
- [ ] Professional animations and theming

## Technology Stack
- **Backend**: FastAPI, Motor (MongoDB async), APScheduler
- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Database**: MongoDB
- **Auth**: JWT with bcrypt password hashing

---
Last Updated: 2026-02-28
Version: 2.0.0 (SaaS Enterprise Refactor Complete)
