"""
Financial Routes API Tests - LOTTOLAB
Tests for: Agent Balance, Ticket Check, Ticket Payout, Financial Summary
New Features: POST /api/tickets/check, POST /api/tickets/payout, 
GET /api/agent/balance, GET /api/company/agent-balances, etc.
"""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://lotto-server.preview.emergentagent.com')

# Test credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin123!"
AGENT_EMAIL = "agent001@lotopam.com"
AGENT_PASSWORD = "Agent123!"


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
        return None
    
    @staticmethod
    def get_company_admin_token():
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COMPANY_ADMIN_EMAIL, "password": COMPANY_ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    @staticmethod
    def get_agent_token():
        response = requests.post(
            f"{BASE_URL}/api/auth/agent/login",
            json={"email": AGENT_EMAIL, "password": AGENT_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        return None


# ============ AGENT BALANCE TESTS ============

class TestAgentBalance:
    """Test agent balance endpoints"""
    
    @pytest.fixture
    def agent_token(self):
        token = TestAuthentication.get_agent_token()
        if not token:
            pytest.skip("Agent authentication failed")
        return token
    
    @pytest.fixture
    def company_admin_token(self):
        token = TestAuthentication.get_company_admin_token()
        if not token:
            pytest.skip("Company admin authentication failed")
        return token
    
    def test_get_agent_balance(self, agent_token):
        """GET /api/agent/balance - Agent's own balance"""
        response = requests.get(
            f"{BASE_URL}/api/agent/balance",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "agent_id" in data, "Missing agent_id"
        assert "agent_name" in data, "Missing agent_name"
        assert "company_id" in data, "Missing company_id"
        assert "credit_limit" in data, "Missing credit_limit"
        assert "current_balance" in data, "Missing current_balance"
        assert "available_balance" in data, "Missing available_balance"
        assert "total_sales" in data, "Missing total_sales"
        assert "total_payouts" in data, "Missing total_payouts"
        assert "total_winnings" in data, "Missing total_winnings"
        
        # Values should be numeric
        assert isinstance(data["credit_limit"], (int, float)), "credit_limit should be numeric"
        assert isinstance(data["current_balance"], (int, float)), "current_balance should be numeric"
        assert isinstance(data["available_balance"], (int, float)), "available_balance should be numeric"
        
        print(f"✓ Agent balance: credit_limit={data['credit_limit']}, current={data['current_balance']}, available={data['available_balance']}")
    
    def test_get_company_agent_balances(self, company_admin_token):
        """GET /api/company/agent-balances - All agents' balances for company"""
        response = requests.get(
            f"{BASE_URL}/api/company/agent-balances",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list), "Response should be a list"
        
        # If there are balances, verify structure
        if len(data) > 0:
            balance = data[0]
            assert "agent_id" in balance, "Missing agent_id"
            assert "credit_limit" in balance, "Missing credit_limit"
            assert "current_balance" in balance, "Missing current_balance"
            assert "available_balance" in balance, "Missing available_balance"
            print(f"✓ Found {len(data)} agent balances")
        else:
            print("✓ No agent balances yet (expected if no sales)")
    
    def test_adjust_agent_balance_add_credit(self, company_admin_token, agent_token):
        """PUT /api/company/agent-balances/{agent_id}/adjust - Add credit"""
        # First get agent info to get agent_id
        response = requests.get(
            f"{BASE_URL}/api/agent/balance",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200
        agent_id = response.json()["agent_id"]
        original_limit = response.json()["credit_limit"]
        
        # Adjust - add credit
        adjust_response = requests.put(
            f"{BASE_URL}/api/company/agent-balances/{agent_id}/adjust",
            json={
                "agent_id": agent_id,
                "adjustment_type": "CREDIT_ADD",
                "amount": 1000.0,
                "reason": "Test credit increase"
            },
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert adjust_response.status_code == 200, f"Failed: {adjust_response.text}"
        data = adjust_response.json()
        assert "message" in data, "Missing message"
        assert "balance" in data, "Missing balance"
        
        new_limit = data["balance"]["credit_limit"]
        assert new_limit == original_limit + 1000.0, f"Credit limit should increase by 1000"
        print(f"✓ Credit added: {original_limit} -> {new_limit}")
        
        # Revert the change
        requests.put(
            f"{BASE_URL}/api/company/agent-balances/{agent_id}/adjust",
            json={
                "agent_id": agent_id,
                "adjustment_type": "CREDIT_REMOVE",
                "amount": 1000.0,
                "reason": "Reverting test credit"
            },
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )


# ============ TICKET CHECK TESTS ============

class TestTicketCheck:
    """Test ticket check endpoint"""
    
    @pytest.fixture
    def agent_token(self):
        token = TestAuthentication.get_agent_token()
        if not token:
            pytest.skip("Agent authentication failed")
        return token
    
    @pytest.fixture
    def company_admin_token(self):
        token = TestAuthentication.get_company_admin_token()
        if not token:
            pytest.skip("Company admin authentication failed")
        return token
    
    def test_check_ticket_not_found(self, company_admin_token):
        """POST /api/tickets/check - Ticket not found"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/check",
            json={"ticket_code": "INVALID-TICKET-CODE"},
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 404, f"Should return 404: {response.text}"
        data = response.json()
        assert "detail" in data
        print(f"✓ Ticket not found: {data['detail']}")
    
    def test_check_ticket_endpoint_exists(self, company_admin_token):
        """POST /api/tickets/check - Endpoint exists and accepts requests"""
        # Test with a properly formatted but non-existent code
        response = requests.post(
            f"{BASE_URL}/api/tickets/check",
            json={"ticket_code": "TKT-TEST-0000"},
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        # Should be 404 (not found) not 500 (server error) or 422 (validation)
        assert response.status_code in [404], f"Unexpected status: {response.status_code} - {response.text}"
        print("✓ Ticket check endpoint working correctly")


# ============ TICKET PAYOUT TESTS ============

class TestTicketPayout:
    """Test ticket payout endpoint"""
    
    @pytest.fixture
    def company_admin_token(self):
        token = TestAuthentication.get_company_admin_token()
        if not token:
            pytest.skip("Company admin authentication failed")
        return token
    
    def test_payout_ticket_not_found(self, company_admin_token):
        """POST /api/tickets/payout - Ticket not found"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/payout",
            json={
                "ticket_id": "tkt_nonexistent",
                "payout_method": "CASH"
            },
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 404, f"Should return 404: {response.text}"
        print("✓ Payout for non-existent ticket properly rejected")
    
    def test_payout_endpoint_exists(self, company_admin_token):
        """POST /api/tickets/payout - Endpoint exists and validates"""
        response = requests.post(
            f"{BASE_URL}/api/tickets/payout",
            json={
                "ticket_id": "tkt_invalid_123",
                "payout_method": "CASH",
                "notes": "Test payout"
            },
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        # Should be 404 (not found) not 500 (server error) 
        assert response.status_code in [404], f"Unexpected status: {response.status_code} - {response.text}"
        print("✓ Ticket payout endpoint working correctly")


# ============ COMPANY FINANCIAL ENDPOINTS TESTS ============

class TestCompanyFinancials:
    """Test company-level financial endpoints"""
    
    @pytest.fixture
    def company_admin_token(self):
        token = TestAuthentication.get_company_admin_token()
        if not token:
            pytest.skip("Company admin authentication failed")
        return token
    
    def test_get_company_payouts(self, company_admin_token):
        """GET /api/company/payouts - Get payout history"""
        response = requests.get(
            f"{BASE_URL}/api/company/payouts",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list), "Response should be a list"
        
        # If there are payouts, verify structure
        if len(data) > 0:
            payout = data[0]
            assert "payout_id" in payout, "Missing payout_id"
            assert "ticket_id" in payout, "Missing ticket_id"
            assert "payout_amount" in payout, "Missing payout_amount"
            print(f"✓ Found {len(data)} payouts")
        else:
            print("✓ No payouts yet (expected)")
    
    def test_get_winning_tickets(self, company_admin_token):
        """GET /api/company/winning-tickets - Get all winning tickets"""
        response = requests.get(
            f"{BASE_URL}/api/company/winning-tickets",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list), "Response should be a list"
        
        # If there are winning tickets, verify structure
        if len(data) > 0:
            ticket = data[0]
            assert "ticket_id" in ticket, "Missing ticket_id"
            assert "status" in ticket, "Missing status"
            assert ticket["status"] in ["WINNER", "PAID"], f"Unexpected status: {ticket['status']}"
            print(f"✓ Found {len(data)} winning tickets")
        else:
            print("✓ No winning tickets yet (expected)")
    
    def test_get_financial_summary_today(self, company_admin_token):
        """GET /api/company/financial-summary?period=today"""
        response = requests.get(
            f"{BASE_URL}/api/company/financial-summary?period=today",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "period" in data, "Missing period"
        assert "start_date" in data, "Missing start_date"
        assert "total_tickets" in data, "Missing total_tickets"
        assert "total_sales" in data, "Missing total_sales"
        assert "total_payouts" in data, "Missing total_payouts"
        assert "net_revenue" in data, "Missing net_revenue"
        
        print(f"✓ Financial summary: tickets={data['total_tickets']}, sales={data['total_sales']}, net={data['net_revenue']}")
    
    def test_get_financial_summary_week(self, company_admin_token):
        """GET /api/company/financial-summary?period=week"""
        response = requests.get(
            f"{BASE_URL}/api/company/financial-summary?period=week",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["period"] == "week"
        print(f"✓ Weekly summary retrieved successfully")
    
    def test_get_financial_summary_month(self, company_admin_token):
        """GET /api/company/financial-summary?period=month"""
        response = requests.get(
            f"{BASE_URL}/api/company/financial-summary?period=month",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["period"] == "month"
        print(f"✓ Monthly summary retrieved successfully")


# ============ LOTTERY SELL WITH BALANCE DEDUCTION TESTS ============

class TestLotterySellBalanceDeduction:
    """Test agent balance is deducted on ticket sales"""
    
    @pytest.fixture
    def agent_token(self):
        token = TestAuthentication.get_agent_token()
        if not token:
            pytest.skip("Agent authentication failed")
        return token
    
    def test_get_balance_before_sale(self, agent_token):
        """Verify agent balance can be retrieved before sale"""
        response = requests.get(
            f"{BASE_URL}/api/agent/balance",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        print(f"✓ Agent balance before any sale: available={data['available_balance']}, current={data['current_balance']}")
        return data
    
    def test_sell_lottery_validates_balance(self, agent_token):
        """POST /api/lottery/sell - Check if balance validation works"""
        # First get available lotteries
        config_response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        if config_response.status_code != 200:
            pytest.skip("Could not get device config")
        
        config = config_response.json()
        enabled_lotteries = config.get("enabled_lotteries", [])
        
        if not enabled_lotteries:
            pytest.skip("No enabled lotteries for testing")
        
        lottery = enabled_lotteries[0]
        lottery_id = lottery.get("lottery_id")
        
        # Try to sell with an impossibly high amount to trigger balance check
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/lottery/sell",
            json={
                "lottery_id": lottery_id,
                "draw_date": today,
                "draw_name": "MIDI",
                "plays": [
                    {"numbers": "123", "bet_type": "BORLETTE", "amount": 999999999.0}
                ]
            },
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        # Should fail with 400 due to insufficient balance
        # OR could fail with 400 for other validation reasons (draw closed, etc.)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ Balance/validation check working: {response.json().get('detail', 'Error')}")


# ============ AUTHORIZATION TESTS ============

class TestAuthorization:
    """Test authorization restrictions"""
    
    @pytest.fixture
    def agent_token(self):
        token = TestAuthentication.get_agent_token()
        if not token:
            pytest.skip("Agent authentication failed")
        return token
    
    def test_agent_cannot_access_company_balances(self, agent_token):
        """Agent should not access company-level balance list"""
        response = requests.get(
            f"{BASE_URL}/api/company/agent-balances",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        # Agent is not admin, should be 403
        assert response.status_code == 403, f"Should be forbidden: {response.status_code}"
        print("✓ Agent correctly blocked from company-level endpoint")
    
    def test_agent_cannot_access_company_payouts(self, agent_token):
        """Agent should not access payout history"""
        response = requests.get(
            f"{BASE_URL}/api/company/payouts",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 403, f"Should be forbidden: {response.status_code}"
        print("✓ Agent correctly blocked from payouts endpoint")
    
    def test_agent_cannot_access_winning_tickets(self, agent_token):
        """Agent should not access winning tickets list"""
        response = requests.get(
            f"{BASE_URL}/api/company/winning-tickets",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 403, f"Should be forbidden: {response.status_code}"
        print("✓ Agent correctly blocked from winning tickets endpoint")
    
    def test_agent_cannot_access_financial_summary(self, agent_token):
        """Agent should not access financial summary"""
        response = requests.get(
            f"{BASE_URL}/api/company/financial-summary",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 403, f"Should be forbidden: {response.status_code}"
        print("✓ Agent correctly blocked from financial summary endpoint")
    
    def test_unauthenticated_requests_rejected(self):
        """Unauthenticated requests should be rejected"""
        endpoints = [
            "/api/agent/balance",
            "/api/company/agent-balances",
            "/api/company/payouts",
            "/api/company/winning-tickets",
            "/api/company/financial-summary"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], f"{endpoint}: Expected 401/403, got {response.status_code}"
        
        print("✓ All endpoints properly require authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
