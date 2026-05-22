# LOTTOLAB PRO – Test Credentials

These credentials are used by the testing agents and integration test scripts.

## Web app login (https://seller-commission-ui.preview.emergentagent.com/login)

| Role           | Email                     | Password         |
|----------------|---------------------------|------------------|
| Super Admin    | jefferson@jmstudio.com    | JMStudio@2026!   |
| Company Admin  | admin@lotopam.com         | LotoPAM2026!     |
| Supervisor     | supervisor@lotopam.com    | super123         |
| Vendor (POS)   | vendeur@lotopam.com       | vendor123        |

## Backend pytest env (/app/backend/tests/.env.test)

The backend test suite is configured via `os.environ` (loaded automatically by `conftest.py`).
The same credentials above are exported under variable names like `SUPER_ADMIN_EMAIL`,
`COMPANY_ADMIN_PASSWORD`, `VENDOR_EMAIL`, etc.

You can override any variable by exporting it in your shell before running pytest:

```bash
SUPER_ADMIN_PASSWORD="..." pytest backend/tests/test_iteration56_features.py
```
