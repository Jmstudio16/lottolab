"""
LOTTOLAB - Phase 2 Financial Management Tests
==============================================
Tests for:
1. Dashboard financier - Stats temps réel
2. Ouverture/Fermeture de caisse
3. Historique des caisses
4. Gestion crédit/avance agents
5. Génération de rapport de réconciliation
6. Permissions RBAC
"""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://seller-commission-ui.preview.emergentagent.com')

# Test credentials from review request
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin@2026!"


class TestAuthentication:
    """Helper class to get auth tokens"""
    
    @staticmethod
    def get_super_admin_token():
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        print(f"Super admin login failed: {response.status_code} - {response.text}")
        return None
    
    @staticmethod
    def get_company_admin_token():
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COMPANY_ADMIN_EMAIL, "password": COMPANY_ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        print(f"Company admin login failed: {response.status_code} - {response.text}")
        return None


# ============ HEALTH CHECK ============

class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """GET /api/health - API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ API healthy: {data}")


# ============ AUTHENTICATION TESTS ============

class TestAuthenticationFlow:
    """Test authentication for financial endpoints"""
    
    def test_super_admin_login(self):
        """Super admin can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Super admin login successful: {data['user'].get('email')}")
    
    def test_company_admin_login(self):
        """Company admin can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COMPANY_ADMIN_EMAIL, "password": COMPANY_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Company admin login successful: {data['user'].get('email')}")


# ============ FINANCIAL DASHBOARD STATS ============

class TestFinancialDashboardStats:
    """Test /api/financial/dashboard/stats endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        token = TestAuthentication.get_company_admin_token()
        if not token:
            pytest.skip("Company admin authentication failed")
        return token
    
    def test_get_dashboard_stats(self, admin_token):
        """GET /api/financial/dashboard/stats - Returns real-time stats"""
        response = requests.get(
            f"{BASE_URL}/api/financial/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "today" in data, "Missing 'today' stats"
        assert "month" in data, "Missing 'month' stats"
        assert "operations" in data, "Missing 'operations' stats"
        assert "generated_at" in data, "Missing 'generated_at'"
        
        # Verify today stats structure
        today = data["today"]
        assert "sales" in today, "Missing today.sales"
        assert "tickets" in today, "Missing today.tickets"
        assert "payouts" in today, "Missing today.payouts"
        assert "profit" in today, "Missing today.profit"
        
        # Verify month stats structure
        month = data["month"]
        assert "sales" in month, "Missing month.sales"
        assert "tickets" in month, "Missing month.tickets"
        assert "payouts" in month, "Missing month.payouts"
        assert "profit" in month, "Missing month.profit"
        
        # Verify operations structure
        ops = data["operations"]
        assert "open_registers" in ops, "Missing operations.open_registers"
        assert "pending_payouts_amount" in ops, "Missing operations.pending_payouts_amount"
        assert "outstanding_advances" in ops, "Missing operations.outstanding_advances"
        
        print(f"✓ Dashboard stats: today_sales={today['sales']}, month_sales={month['sales']}, open_registers={ops['open_registers']}")
    
    def test_dashboard_stats_requires_auth(self):
        """Dashboard stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/financial/dashboard/stats")
        assert response.status_code in [401, 403], f"Should require auth: {response.status_code}"
        print("✓ Dashboard stats properly requires authentication")


# ============ CASH REGISTER TESTS ============

class TestCashRegister:
    """Test cash register open/close endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        token = TestAuthentication.get_company_admin_token()
        if not token:
            pytest.skip("Company admin authentication failed")
        return token
    
    def test_get_current_register(self, admin_token):
        """GET /api/financial/cash-register/current - Get current register status"""
        response = requests.get(
            f"{BASE_URL}/api/financial/cash-register/current",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "is_open" in data, "Missing 'is_open' field"
        assert isinstance(data["is_open"], bool), "is_open should be boolean"
        
        if data["is_open"]:
            assert "register" in data, "Missing 'register' when open"
            register = data["register"]
            assert "register_id" in register, "Missing register_id"
            assert "opening_balance" in register, "Missing opening_balance"
            print(f"✓ Register is OPEN: {register['register_id']}")
        else:
            print("✓ No register currently open")
    
    def test_open_cash_register(self, admin_token):
        """POST /api/financial/cash-register/open - Open a cash register"""
        # First check if already open
        current = requests.get(
            f"{BASE_URL}/api/financial/cash-register/current",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if current.status_code == 200 and current.json().get("is_open"):
            # Close it first
            register = current.json()["register"]
            expected = register.get("expected_balance", register.get("opening_balance", 0))
            requests.post(
                f"{BASE_URL}/api/financial/cash-register/close",
                json={
                    "closing_balance": expected,
                    "cash_counted": expected,
                    "notes": "Auto-close for testing"
                },
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        # Now open a new register
        response = requests.post(
            f"{BASE_URL}/api/financial/cash-register/open",
            json={
                "opening_balance": 5000.0,
                "notes": "Test opening"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to open: {response.text}"
        data = response.json()
        
        assert "message" in data, "Missing message"
        assert "register_id" in data, "Missing register_id"
        assert "opening_balance" in data, "Missing opening_balance"
        assert data["opening_balance"] == 5000.0, "Opening balance mismatch"
        
        print(f"✓ Cash register opened: {data['register_id']} with balance {data['opening_balance']} HTG")
        
        return data["register_id"]
    
    def test_close_cash_register(self, admin_token):
        """POST /api/financial/cash-register/close - Close with variance calculation"""
        # First ensure a register is open
        current = requests.get(
            f"{BASE_URL}/api/financial/cash-register/current",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if current.status_code != 200 or not current.json().get("is_open"):
            # Open one first
            requests.post(
                f"{BASE_URL}/api/financial/cash-register/open",
                json={"opening_balance": 5000.0},
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            current = requests.get(
                f"{BASE_URL}/api/financial/cash-register/current",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        register = current.json()["register"]
        expected_balance = register.get("expected_balance", register.get("opening_balance", 5000))
        
        # Close with a small variance to test variance calculation
        cash_counted = expected_balance + 50  # Surplus of 50 HTG
        
        response = requests.post(
            f"{BASE_URL}/api/financial/cash-register/close",
            json={
                "closing_balance": cash_counted,
                "cash_counted": cash_counted,
                "notes": "Test closing with surplus"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to close: {response.text}"
        data = response.json()
        
        assert "message" in data, "Missing message"
        assert "register_id" in data, "Missing register_id"
        assert "summary" in data, "Missing summary"
        
        summary = data["summary"]
        assert "variance" in summary, "Missing variance in summary"
        assert "variance_type" in summary, "Missing variance_type"
        assert "expected_balance" in summary, "Missing expected_balance"
        
        print(f"✓ Cash register closed: variance={summary['variance']} ({summary['variance_type']})")
    
    def test_get_register_history(self, admin_token):
        """GET /api/financial/cash-register/history - Get register history"""
        response = requests.get(
            f"{BASE_URL}/api/financial/cash-register/history?limit=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            register = data[0]
            assert "register_id" in register, "Missing register_id"
            assert "date" in register, "Missing date"
            assert "status" in register, "Missing status"
            assert "opening_balance" in register, "Missing opening_balance"
            print(f"✓ Found {len(data)} registers in history")
        else:
            print("✓ No register history yet")
    
    def test_cannot_open_duplicate_register(self, admin_token):
        """Cannot open a second register on same day"""
        # First ensure a register is open
        current = requests.get(
            f"{BASE_URL}/api/financial/cash-register/current",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if current.status_code != 200 or not current.json().get("is_open"):
            # Open one first
            requests.post(
                f"{BASE_URL}/api/financial/cash-register/open",
                json={"opening_balance": 5000.0},
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        # Try to open another
        response = requests.post(
            f"{BASE_URL}/api/financial/cash-register/open",
            json={"opening_balance": 10000.0},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 400, f"Should fail with 400: {response.status_code}"
        print("✓ Duplicate register correctly rejected")


# ============ AGENT BALANCES TESTS ============

class TestAgentBalances:
    """Test agent balance management endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        token = TestAuthentication.get_company_admin_token()
        if not token:
            pytest.skip("Company admin authentication failed")
        return token
    
    def test_get_all_agents_balances(self, admin_token):
        """GET /api/financial/agents/balances - List all agents with balances"""
        response = requests.get(
            f"{BASE_URL}/api/financial/agents/balances",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            agent = data[0]
            assert "agent_id" in agent, "Missing agent_id"
            assert "name" in agent, "Missing name"
            assert "credit_limit" in agent, "Missing credit_limit"
            assert "available_balance" in agent, "Missing available_balance"
            assert "outstanding_advances" in agent, "Missing outstanding_advances"
            print(f"✓ Found {len(data)} agents with balances")
            return data
        else:
            print("✓ No agents found (may need to create test agents)")
            return []
    
    def test_create_agent_transaction(self, admin_token):
        """POST /api/financial/agent/transaction - Create credit/debit transaction"""
        # First get an agent
        agents_response = requests.get(
            f"{BASE_URL}/api/financial/agents/balances",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if agents_response.status_code != 200:
            pytest.skip("Could not get agents list")
        
        agents = agents_response.json()
        if len(agents) == 0:
            pytest.skip("No agents available for testing")
        
        agent = agents[0]
        agent_id = agent["agent_id"]
        original_balance = agent["available_balance"]
        
        # Create a CREDIT transaction
        response = requests.post(
            f"{BASE_URL}/api/financial/agent/transaction",
            json={
                "agent_id": agent_id,
                "amount": 1000.0,
                "transaction_type": "CREDIT",
                "notes": "Test credit transaction"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data, "Missing message"
        assert "transaction_id" in data, "Missing transaction_id"
        assert "new_available_balance" in data, "Missing new_available_balance"
        
        # Verify balance increased
        assert data["new_available_balance"] == original_balance + 1000.0, "Balance should increase by 1000"
        
        print(f"✓ Credit transaction created: {data['transaction_id']}, new balance: {data['new_available_balance']}")
        
        # Revert with DEBIT
        requests.post(
            f"{BASE_URL}/api/financial/agent/transaction",
            json={
                "agent_id": agent_id,
                "amount": 1000.0,
                "transaction_type": "DEBIT",
                "notes": "Reverting test credit"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_create_advance_transaction(self, admin_token):
        """POST /api/financial/agent/transaction - Create advance transaction"""
        agents_response = requests.get(
            f"{BASE_URL}/api/financial/agents/balances",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if agents_response.status_code != 200:
            pytest.skip("Could not get agents list")
        
        agents = agents_response.json()
        if len(agents) == 0:
            pytest.skip("No agents available for testing")
        
        agent = agents[0]
        agent_id = agent["agent_id"]
        
        # Create an ADVANCE transaction
        response = requests.post(
            f"{BASE_URL}/api/financial/agent/transaction",
            json={
                "agent_id": agent_id,
                "amount": 500.0,
                "transaction_type": "ADVANCE",
                "notes": "Test advance"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "outstanding_advances" in data, "Missing outstanding_advances"
        print(f"✓ Advance created: outstanding_advances={data['outstanding_advances']}")
        
        # Repay the advance
        requests.post(
            f"{BASE_URL}/api/financial/agent/transaction",
            json={
                "agent_id": agent_id,
                "amount": 500.0,
                "transaction_type": "REPAYMENT",
                "notes": "Repaying test advance"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_invalid_transaction_type_rejected(self, admin_token):
        """Invalid transaction type should be rejected"""
        agents_response = requests.get(
            f"{BASE_URL}/api/financial/agents/balances",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if agents_response.status_code != 200:
            pytest.skip("Could not get agents list")
        
        agents = agents_response.json()
        if len(agents) == 0:
            pytest.skip("No agents available for testing")
        
        agent_id = agents[0]["agent_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/financial/agent/transaction",
            json={
                "agent_id": agent_id,
                "amount": 100.0,
                "transaction_type": "INVALID_TYPE",
                "notes": "Should fail"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 400, f"Should reject invalid type: {response.status_code}"
        print("✓ Invalid transaction type correctly rejected")


# ============ RECONCILIATION TESTS ============

class TestReconciliation:
    """Test reconciliation report generation"""
    
    @pytest.fixture
    def admin_token(self):
        token = TestAuthentication.get_company_admin_token()
        if not token:
            pytest.skip("Company admin authentication failed")
        return token
    
    def test_generate_reconciliation_report(self, admin_token):
        """POST /api/financial/reconciliation/generate - Generate report"""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/financial/reconciliation/generate",
            json={"date": today},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "report_id" in data, "Missing report_id"
        assert "date" in data, "Missing date"
        assert "system_totals" in data, "Missing system_totals"
        assert "register_totals" in data, "Missing register_totals"
        assert "anomalies" in data, "Missing anomalies"
        assert "status" in data, "Missing status"
        
        print(f"✓ Reconciliation report generated: {data['report_id']}, status={data['status']}, anomalies={len(data['anomalies'])}")
    
    def test_get_reconciliation_reports(self, admin_token):
        """GET /api/financial/reconciliation/reports - Get reports list"""
        response = requests.get(
            f"{BASE_URL}/api/financial/reconciliation/reports?limit=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            report = data[0]
            assert "report_id" in report, "Missing report_id"
            assert "date" in report, "Missing date"
            assert "status" in report, "Missing status"
            print(f"✓ Found {len(data)} reconciliation reports")
        else:
            print("✓ No reconciliation reports yet")


# ============ DAILY SUMMARY TESTS ============

class TestDailySummary:
    """Test daily financial summary endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        token = TestAuthentication.get_company_admin_token()
        if not token:
            pytest.skip("Company admin authentication failed")
        return token
    
    def test_get_daily_summary(self, admin_token):
        """GET /api/financial/reports/daily-summary - Get daily summary"""
        response = requests.get(
            f"{BASE_URL}/api/financial/reports/daily-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "date" in data, "Missing date"
        assert "sales" in data, "Missing sales"
        assert "payouts" in data, "Missing payouts"
        assert "profit" in data, "Missing profit"
        
        print(f"✓ Daily summary: date={data['date']}, sales={data['sales']['total']}, profit={data['profit']['gross']}")
    
    def test_get_daily_summary_specific_date(self, admin_token):
        """GET /api/financial/reports/daily-summary?date=YYYY-MM-DD"""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/financial/reports/daily-summary?date={today}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["date"] == today
        print(f"✓ Daily summary for {today} retrieved")


# ============ RBAC PERMISSION TESTS ============

class TestRBACPermissions:
    """Test RBAC permissions for financial endpoints"""
    
    def test_unauthenticated_access_denied(self):
        """Unauthenticated requests should be denied"""
        endpoints = [
            "/api/financial/dashboard/stats",
            "/api/financial/cash-register/current",
            "/api/financial/cash-register/history",
            "/api/financial/agents/balances",
            "/api/financial/reconciliation/reports"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], f"{endpoint}: Expected 401/403, got {response.status_code}"
        
        print("✓ All financial endpoints require authentication")
    
    def test_admin_can_access_all_endpoints(self):
        """Admin can access all financial endpoints"""
        token = TestAuthentication.get_company_admin_token()
        if not token:
            pytest.skip("Company admin authentication failed")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        endpoints = [
            "/api/financial/dashboard/stats",
            "/api/financial/cash-register/current",
            "/api/financial/cash-register/history",
            "/api/financial/agents/balances",
            "/api/financial/reconciliation/reports",
            "/api/financial/reports/daily-summary"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            assert response.status_code == 200, f"{endpoint}: Expected 200, got {response.status_code} - {response.text}"
        
        print("✓ Admin can access all financial endpoints")


# ============ CLEANUP ============

class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def admin_token(self):
        token = TestAuthentication.get_company_admin_token()
        if not token:
            pytest.skip("Company admin authentication failed")
        return token
    
    def test_close_any_open_register(self, admin_token):
        """Close any open register from testing"""
        current = requests.get(
            f"{BASE_URL}/api/financial/cash-register/current",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if current.status_code == 200 and current.json().get("is_open"):
            register = current.json()["register"]
            expected = register.get("expected_balance", register.get("opening_balance", 0))
            
            response = requests.post(
                f"{BASE_URL}/api/financial/cash-register/close",
                json={
                    "closing_balance": expected,
                    "cash_counted": expected,
                    "notes": "Cleanup after testing"
                },
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            
            if response.status_code == 200:
                print("✓ Cleaned up open register")
            else:
                print(f"⚠ Could not close register: {response.text}")
        else:
            print("✓ No open register to clean up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
