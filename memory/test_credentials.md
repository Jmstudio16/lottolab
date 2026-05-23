# LOTTOLAB PRO – Test Credentials

These credentials are used by the testing agents and integration test scripts.

## Web app login

### Production (https://lottolab.tech)

| Role           | Email                     | Password         |
|----------------|---------------------------|------------------|
| Super Admin    | jefferson@jmstudio.com    | JMStudio@2026!   |
| Backup Admin   | admin@lottolab.tech       | LottoLab@2026!   |

Other accounts (companies, agents) must be created from the Super Admin dashboard.

### Preview (https://seller-commission-ui.preview.emergentagent.com)

| Role           | Email                     | Password         |
|----------------|---------------------------|------------------|
| Super Admin    | jefferson@jmstudio.com    | JMStudio@2026!   |
| Backup Admin   | admin@lottolab.tech       | LottoLab@2026!   |

⚠️ The preview database was reset on 2026-05-22. To create test companies / vendors, log in as Super Admin and create them from the dashboard.

## Self-healing super admin
At every backend startup, `server.py::initialize_super_admin_if_empty()` verifies
the two canonical super-admin accounts and upserts them with the correct
password+role+status. **Super Admin credentials can never be lost** even after
a database wipe.

## Emergency recovery endpoints

```bash
# Reset/recreate the primary super admin (idempotent)
curl -X POST "https://lottolab.tech/api/init/create-super-admin?secret_key=LOTTOLAB_INIT_2026"

# DANGEROUS: wipe ALL companies, agents, tickets, transactions; preserve super admins + lottery catalog
curl -X POST "https://lottolab.tech/api/init/reset-system?secret_key=LOTTOLAB_INIT_2026&confirm=RESET_LOTTOLAB_NOW"
```

## Backend pytest env (/app/backend/tests/.env.test)

All variables (SUPER_ADMIN_EMAIL, COMPANY_ADMIN_PASSWORD, VENDOR_EMAIL, etc.)
are auto-loaded by `conftest.py`. Override per run via:

```bash
SUPER_ADMIN_PASSWORD="..." pytest backend/tests/test_iteration56_features.py
```
