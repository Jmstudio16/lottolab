"""
SaaS Billing module tests — Super Admin only.
Endpoints under /api/super/billing/*
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://seller-commission-ui.preview.emergentagent.com").rstrip("/")
SUPER_EMAIL = "jefferson@jmstudio.com"
SUPER_PASS = "JMStudio@2026!"
COMPANY_EMAIL = "admin@lotopam.com"
COMPANY_PASS = "LotoPAM2026!"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def super_token():
    return _login(SUPER_EMAIL, SUPER_PASS)


@pytest.fixture(scope="module")
def company_token():
    try:
        return _login(COMPANY_EMAIL, COMPANY_PASS)
    except AssertionError:
        pytest.skip("Company admin login failed - cannot run 403 test")


@pytest.fixture(scope="module")
def super_headers(super_token):
    return {"Authorization": f"Bearer {super_token}"}


# --- 1. Summary endpoint ---
class TestSummary:
    def test_summary_ok(self, super_headers):
        r = requests.get(f"{BASE_URL}/api/super/billing/summary", headers=super_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "active_companies" in data
        assert "online_agents_now" in data
        assert "invoices" in data
        for k in ("pending", "paid", "overdue", "cancelled"):
            assert k in data["invoices"]
            assert "count" in data["invoices"][k]
            assert "total" in data["invoices"][k]

    def test_summary_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/super/billing/summary", timeout=30)
        assert r.status_code in (401, 403)

    def test_summary_forbidden_for_company_admin(self, company_token):
        r = requests.get(
            f"{BASE_URL}/api/super/billing/summary",
            headers={"Authorization": f"Bearer {company_token}"}, timeout=30
        )
        assert r.status_code == 403, f"Expected 403 got {r.status_code}: {r.text}"


# --- 2. Companies listing ---
class TestCompanies:
    def test_list_companies_default_month(self, super_headers):
        r = requests.get(f"{BASE_URL}/api/super/billing/companies", headers=super_headers, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "companies" in data and "period" in data
        assert isinstance(data["companies"], list)
        if data["companies"]:
            c = data["companies"][0]
            for k in ("company_id", "name", "counters", "projected_amount", "billing_mode",
                      "counting_method", "rate_per_agent"):
                assert k in c, f"Missing key {k}: {c}"
            for ck in ("agents_active", "agents_online_now", "agents_monthly_active", "agents_monthly_sellers"):
                assert ck in c["counters"], f"Missing counter {ck}"

    def test_list_companies_specific_month(self, super_headers):
        r = requests.get(f"{BASE_URL}/api/super/billing/companies?month=2026-01",
                         headers=super_headers, timeout=60)
        assert r.status_code == 200
        assert r.json()["period"] == "2026-01"

    def test_invalid_month_format(self, super_headers):
        r = requests.get(f"{BASE_URL}/api/super/billing/companies?month=BAD",
                         headers=super_headers, timeout=30)
        assert r.status_code == 400


# --- 3. Config get/update ---
class TestConfig:
    def test_get_and_update_config(self, super_headers):
        # Pick the first company
        comp = requests.get(f"{BASE_URL}/api/super/billing/companies",
                            headers=super_headers, timeout=60).json()["companies"]
        if not comp:
            pytest.skip("No active companies")
        cid = comp[0]["company_id"]

        # GET config
        r = requests.get(f"{BASE_URL}/api/super/billing/company/{cid}/config",
                         headers=super_headers, timeout=30)
        assert r.status_code == 200
        cfg = r.json()
        for k in ("billing_mode", "rate_per_agent", "counting_method", "currency"):
            assert k in cfg

        # PUT config: set rate=750, counting=active
        payload = {
            "billing_mode": "fixed_per_agent",
            "rate_per_agent": 750.0,
            "counting_method": "active",
            "percentage_rate": 0.02,
            "tiers": [],
            "currency": "HTG",
            "notes": "TEST_billing_config"
        }
        r = requests.put(f"{BASE_URL}/api/super/billing/company/{cid}/config",
                         json=payload, headers=super_headers, timeout=30)
        assert r.status_code == 200, r.text
        saved = r.json()
        assert saved["rate_per_agent"] == 750.0
        assert saved["counting_method"] == "active"
        assert saved["billing_mode"] == "fixed_per_agent"

        # GET again to confirm persistence
        r2 = requests.get(f"{BASE_URL}/api/super/billing/company/{cid}/config",
                          headers=super_headers, timeout=30)
        assert r2.status_code == 200
        cfg2 = r2.json()
        assert cfg2["rate_per_agent"] == 750.0
        assert cfg2["counting_method"] == "active"

        # Verify it shows in the /companies listing
        listing = requests.get(f"{BASE_URL}/api/super/billing/companies",
                               headers=super_headers, timeout=60).json()
        target = next((c for c in listing["companies"] if c["company_id"] == cid), None)
        assert target is not None
        assert target["rate_per_agent"] == 750.0
        assert target["counting_method"] == "active"

    def test_config_nonexistent_company(self, super_headers):
        payload = {"billing_mode": "fixed_per_agent", "rate_per_agent": 1.0,
                   "counting_method": "active", "percentage_rate": 0.02,
                   "tiers": [], "currency": "HTG", "notes": ""}
        r = requests.put(f"{BASE_URL}/api/super/billing/company/NOPE_xxx/config",
                         json=payload, headers=super_headers, timeout=30)
        assert r.status_code == 404


# --- 4. Invoice generation and listing ---
class TestInvoices:
    MONTH = "2025-12"

    def test_generate_invoices(self, super_headers):
        r = requests.post(
            f"{BASE_URL}/api/super/billing/generate-invoices?month={self.MONTH}",
            headers=super_headers, timeout=120
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("created", "updated", "skipped_existing", "total", "period"):
            assert k in data
        assert data["period"] == self.MONTH
        assert data["total"] >= 0

    def test_generate_force(self, super_headers):
        r = requests.post(
            f"{BASE_URL}/api/super/billing/generate-invoices?month={self.MONTH}&force=true",
            headers=super_headers, timeout=120
        )
        assert r.status_code == 200, r.text

    def test_list_invoices(self, super_headers):
        r = requests.get(f"{BASE_URL}/api/super/billing/invoices?month={self.MONTH}",
                         headers=super_headers, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "invoices" in data and "count" in data
        if data["invoices"]:
            inv = data["invoices"][0]
            for k in ("invoice_id", "company_id", "period_label", "amount_due",
                      "status", "currency", "billable_agents", "counters"):
                assert k in inv, f"Missing {k}"

    def test_update_status_paid_and_pdf(self, super_headers):
        r = requests.get(f"{BASE_URL}/api/super/billing/invoices?month={self.MONTH}",
                         headers=super_headers, timeout=60)
        invoices = r.json().get("invoices", [])
        if not invoices:
            pytest.skip("No invoices generated for this period")
        inv_id = invoices[0]["invoice_id"]

        # Update status -> paid
        upd = requests.put(
            f"{BASE_URL}/api/super/billing/invoices/{inv_id}/status",
            json={"status": "paid", "payment_method": "TEST_cash", "payment_reference": "TEST_ref"},
            headers=super_headers, timeout=30
        )
        assert upd.status_code == 200, upd.text
        assert upd.json()["status"] == "paid"

        # GET single invoice to confirm
        g = requests.get(f"{BASE_URL}/api/super/billing/invoices/{inv_id}",
                         headers=super_headers, timeout=30)
        assert g.status_code == 200
        assert g.json()["status"] == "paid"

        # PDF
        pdf = requests.get(f"{BASE_URL}/api/super/billing/invoices/{inv_id}/pdf",
                           headers=super_headers, timeout=60)
        assert pdf.status_code == 200, pdf.text[:300]
        assert pdf.headers.get("content-type", "").startswith("application/pdf")
        assert len(pdf.content) > 500  # has actual bytes
        assert pdf.content[:4] == b"%PDF"

        # Reset to pending so suite is idempotent
        requests.put(
            f"{BASE_URL}/api/super/billing/invoices/{inv_id}/status",
            json={"status": "pending"}, headers=super_headers, timeout=30
        )

    def test_invalid_status(self, super_headers):
        r = requests.put(
            f"{BASE_URL}/api/super/billing/invoices/dummy/status",
            json={"status": "bogus"}, headers=super_headers, timeout=30
        )
        # 422 from pydantic pattern
        assert r.status_code in (404, 422)

    def test_get_invoice_404(self, super_headers):
        r = requests.get(f"{BASE_URL}/api/super/billing/invoices/NOPE_xxx",
                         headers=super_headers, timeout=30)
        assert r.status_code == 404


# --- 5. 403 on company admin ---
class TestAuthZ:
    def test_generate_forbidden(self, company_token):
        r = requests.post(
            f"{BASE_URL}/api/super/billing/generate-invoices",
            headers={"Authorization": f"Bearer {company_token}"}, timeout=30
        )
        assert r.status_code == 403

    def test_companies_forbidden(self, company_token):
        r = requests.get(
            f"{BASE_URL}/api/super/billing/companies",
            headers={"Authorization": f"Bearer {company_token}"}, timeout=30
        )
        assert r.status_code == 403
