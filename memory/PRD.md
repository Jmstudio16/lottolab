# LOTTOLAB - Enterprise Lottery SaaS Platform
## Product Requirements Document (PRD)

### Overview
LOTTOLAB is a production-ready, enterprise-grade multi-tenant Lottery SaaS platform with hierarchical RBAC model (SUPER_ADMIN, COMPANY_ADMIN, AGENT_POS). The system supports real-time synchronization between admin configurations and agent devices, financial tracking, fraud detection, and complete audit trails.

**Status**: ✅ **PRODUCTION READY** (100% Score)
**Last Audit**: 2026-02-22
**Technical Checklist**: /app/TECHNICAL_CONFIRMATION_CHECKLIST.md

---

## Production Readiness Summary

### Pre-Launch Checklist: 7/7 ✅

| Item | Status | File |
|------|--------|------|
| Rate Limiting | ✅ | `rate_limiter.py` |
| Auto Winning Detection | ✅ | `super_admin_global_routes.py` |
| Backup Strategy | ✅ | `backup_mongodb.sh` |
| Anti-Fraud Monitoring | ✅ | `fraud_detection.py` |
| PM2 Configuration | ✅ | `ecosystem.config.js` |
| Nginx + SSL | ✅ | `nginx.conf` |
| Database Indexes | ✅ | 8 unique + 15 performance |

---

## Database State

| Collection | Count |
|------------|-------|
| Companies | 1 |
| Users | 3 |
| Agents | 1 |
| Global Lotteries | 155 |
| Global Schedules | 13 |
| Activity Logs | 333 |

### Active Accounts
| Email | Role |
|-------|------|
| jefferson@jmstudio.com | SUPER_ADMIN |
| admin@lotopam.com | COMPANY_ADMIN |
| agent001@lottolab.com | AGENT_POS |

---

## Core Architecture

### Multi-Tenant Hierarchy
```
SUPER_ADMIN → Creates Companies → Manages Global Catalog → Publishes Results
    ↓
COMPANY_ADMIN → Creates Branches → Creates Agents → Activates Lotteries
    ↓
AGENT_POS → Syncs Config → Sells Tickets → Processes Payouts
```

### Real-Time Synchronization
```
Config Change → config_version++ → Agent polls /api/device/sync → Reload
```

### Financial Lifecycle
```
Ticket Sale → Balance Deducted → Result Published → Auto-Check → Payout
```

---

## Security Features

### Rate Limiting
- Login: 10/minute per IP
- Ticket Sales: 120/minute per IP
- Device Sync: 60/minute per IP

### Anti-Fraud Detection
- High sales volume alerts
- Rapid consecutive sales detection
- Void rate monitoring
- Repeated number pattern detection
- Suspicious win rate alerts

### Authentication
- JWT with required secret key
- Bcrypt password hashing
- Role-based route protection

---

## Deployment Files

| File | Purpose |
|------|---------|
| `ecosystem.config.js` | PM2 process manager |
| `nginx.conf` | Production web server |
| `backup_mongodb.sh` | Automated backups |
| `create_super_admin.py` | Admin creation |
| `audit_production.py` | System audit |
| `cleanup_production.py` | Test data removal |

---

## API Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/auth/login` | 10/minute |
| `/api/lottery/sell` | 120/minute |
| `/api/tickets/check` | 60/minute |
| `/api/tickets/payout` | 30/minute |
| `/api/device/sync` | 60/minute |

---

## Hostinger Deployment Commands

```bash
# 1. Generate JWT Key
python -c "import secrets; print(secrets.token_urlsafe(64))"

# 2. Install & Start
pip install -r requirements.txt
pm2 start ecosystem.config.js

# 3. Configure Nginx
sudo cp nginx.conf /etc/nginx/sites-available/lottolab
sudo certbot --nginx -d lottolab.com

# 4. Setup Backups
crontab -e
# Add: 0 2 * * * /var/www/lottolab/backend/backup_mongodb.sh

# 5. Create Admin
python create_super_admin.py
```

---

## Last Updated
- **Date**: 2026-02-22
- **Session**: Enterprise Production Preparation
- **Status**: ✅ 100% Production Ready
- **Score**: 7/7 technical items complete
