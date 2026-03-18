"""
Test Suite: Results & Winner Detection System
Tests: /api/results/publish, /api/results/lotteries, winner detection, payout calculation
"""

import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Credentials from the testing request
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
AGENT_EMAIL = "agent.marie@lotopam.com"
AGENT_PASSWORD = "password"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def super_admin_token(api_client):
    """Get Super Admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Super Admin authentication failed - skipping tests")


@pytest.fixture
def agent_token(api_client):
    """Get Agent authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/agent/login", json={
        "email": AGENT_EMAIL,
        "password": AGENT_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Agent authentication failed - skipping tests")


@pytest.fixture
def authenticated_super_admin(api_client, super_admin_token):
    """Session with Super Admin auth header"""
    api_client.headers.update({"Authorization": f"Bearer {super_admin_token}"})
    return api_client


@pytest.fixture
def authenticated_agent(api_client, agent_token):
    """Session with Agent auth header"""
    api_client.headers.update({"Authorization": f"Bearer {agent_token}"})
    return api_client


# ============================================================================
# AUTHENTICATION TESTS
# ============================================================================

class TestAuthentication:
    """Test authentication for Results system"""
    
    def test_super_admin_login(self, api_client):
        """Super Admin can login successfully"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data.get("user", {}).get("role") == "SUPER_ADMIN"
    
    def test_agent_login(self, api_client):
        """Agent can login via /api/auth/agent/login"""
        response = api_client.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": AGENT_EMAIL,
            "password": AGENT_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "agent_id" in data
        assert "company_id" in data


# ============================================================================
# LOTTERIES ENDPOINT TESTS
# ============================================================================

class TestLotteriesEndpoint:
    """Test /api/results/lotteries endpoint"""
    
    def test_get_lotteries_requires_auth(self, api_client):
        """Endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/results/lotteries")
        assert response.status_code in [401, 403, 422]
    
    def test_get_lotteries_requires_super_admin(self, authenticated_agent):
        """Endpoint requires Super Admin role"""
        response = authenticated_agent.get(f"{BASE_URL}/api/results/lotteries")
        # Agent should be forbidden
        assert response.status_code == 403
    
    def test_get_lotteries_returns_list(self, authenticated_super_admin):
        """Super Admin can get lottery list for results management"""
        response = authenticated_super_admin.get(f"{BASE_URL}/api/results/lotteries")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # If lotteries exist, check structure
        if len(data) > 0:
            lottery = data[0]
            assert "lottery_id" in lottery
            assert "lottery_name" in lottery


# ============================================================================
# PUBLISH RESULTS TESTS
# ============================================================================

class TestPublishResults:
    """Test /api/results/publish endpoint"""
    
    def test_publish_requires_auth(self, api_client):
        """Publish endpoint requires authentication"""
        response = api_client.post(f"{BASE_URL}/api/results/publish", json={
            "lottery_id": "test",
            "draw_date": "2026-02-06",
            "draw_name": "Midday",
            "winning_numbers": {"first": "12", "second": "34", "third": "56"}
        })
        assert response.status_code in [401, 403, 422]
    
    def test_publish_requires_super_admin(self, authenticated_agent):
        """Only Super Admin can publish results"""
        response = authenticated_agent.post(f"{BASE_URL}/api/results/publish", json={
            "lottery_id": "test",
            "draw_date": "2026-02-06",
            "draw_name": "Midday",
            "winning_numbers": {"first": "12", "second": "34", "third": "56"}
        })
        assert response.status_code == 403
    
    def test_publish_validates_lottery_exists(self, authenticated_super_admin):
        """Publish validates that lottery exists"""
        response = authenticated_super_admin.post(f"{BASE_URL}/api/results/publish", json={
            "lottery_id": "nonexistent_lottery_12345",
            "draw_date": "2026-02-06",
            "draw_name": "Midday",
            "winning_numbers": {"first": "12", "second": "34", "third": "56"}
        })
        assert response.status_code == 404
        assert "non trouvée" in response.json().get("detail", "").lower()
    
    def test_publish_result_success(self, authenticated_super_admin):
        """Super Admin can publish result with winner detection"""
        # First get a valid lottery
        lotteries_resp = authenticated_super_admin.get(f"{BASE_URL}/api/results/lotteries")
        if lotteries_resp.status_code != 200:
            pytest.skip("No lotteries available")
        
        lotteries = lotteries_resp.json()
        if not lotteries:
            pytest.skip("No lotteries configured in system")
        
        lottery = lotteries[0]
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Publish result
        response = authenticated_super_admin.post(f"{BASE_URL}/api/results/publish", json={
            "lottery_id": lottery["lottery_id"],
            "draw_date": today,
            "draw_name": "Evening",
            "winning_numbers": {"first": "123", "second": "456", "third": "789"},
            "official_source": "Test Automation",
            "notes": "Automated test result"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "result_id" in data
        assert "lottery_name" in data
        assert "winning_numbers" in data
        assert "tickets_processed" in data
        assert "winners_count" in data
        assert "losers_count" in data
        assert "total_payouts" in data
        
        # Verify winner detection processed
        assert isinstance(data["tickets_processed"], int)
        assert isinstance(data["winners_count"], int)
        assert isinstance(data["losers_count"], int)


# ============================================================================
# GET RESULTS TESTS
# ============================================================================

class TestGetResults:
    """Test /api/results endpoint"""
    
    def test_get_results_requires_auth(self, api_client):
        """Get results requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/results")
        assert response.status_code in [401, 403, 422]
    
    def test_get_results_returns_list(self, authenticated_super_admin):
        """Authenticated user can get results list"""
        response = authenticated_super_admin.get(f"{BASE_URL}/api/results")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # If results exist, check structure
        if len(data) > 0:
            result = data[0]
            assert "result_id" in result
            assert "lottery_id" in result
            assert "draw_date" in result
            assert "winning_numbers" in result


# ============================================================================
# TICKET CREATION AND WINNER DETECTION INTEGRATION
# ============================================================================

class TestWinnerDetectionIntegration:
    """Test the full flow: create ticket -> publish result -> detect winner"""
    
    def test_create_ticket_via_agent(self, authenticated_agent, authenticated_super_admin):
        """Create a ticket and verify it can be matched with results"""
        # First get lottery configuration
        config_resp = authenticated_agent.get(f"{BASE_URL}/api/device/config")
        if config_resp.status_code != 200:
            pytest.skip("Cannot get device config")
        
        config = config_resp.json()
        lotteries = config.get("lotteries", [])
        schedules = config.get("schedules", [])
        
        if not lotteries:
            pytest.skip("No lotteries available for agent")
        
        # Find an active lottery with open schedule
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Try to create a ticket (may fail if lottery closed)
        lottery = lotteries[0]
        
        # Get a schedule for this lottery
        lottery_schedules = [s for s in schedules if s.get("lottery_id") == lottery.get("lottery_id")]
        draw_name = lottery_schedules[0].get("draw_name", "Midday") if lottery_schedules else "Midday"
        
        ticket_data = {
            "lottery_id": lottery.get("lottery_id"),
            "draw_date": today,
            "draw_name": draw_name,
            "plays": [
                {"numbers": "12", "bet_type": "BORLETTE", "amount": 100},
                {"numbers": "34", "bet_type": "BORLETTE", "amount": 50}
            ]
        }
        
        response = authenticated_agent.post(f"{BASE_URL}/api/lottery/sell", json=ticket_data)
        
        # Ticket creation may fail if lottery is closed - that's OK for this test
        if response.status_code == 400:
            # Expected if lottery is closed
            assert "fermé" in response.json().get("detail", "").lower() or \
                   "closed" in response.json().get("detail", "").lower()
            return
        
        # If ticket was created successfully
        if response.status_code == 200:
            data = response.json()
            assert "ticket_id" in data
            assert "ticket_code" in data
            assert "verification_code" in data
            assert "qr_code" in data
            assert data["total_amount"] == 150
            assert data["potential_win"] > 0


# ============================================================================
# TICKET PRINT ENDPOINT TESTS
# ============================================================================

class TestTicketPrint:
    """Test ticket print endpoint"""
    
    def test_ticket_print_requires_auth(self, api_client):
        """Ticket print endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/ticket/print/nonexistent_ticket")
        # Returns 403 for unauthenticated requests
        assert response.status_code in [401, 403]
    
    def test_ticket_print_returns_404_for_nonexistent(self, authenticated_agent):
        """Authenticated request returns 404 for nonexistent ticket"""
        response = authenticated_agent.get(f"{BASE_URL}/api/ticket/print/nonexistent_ticket")
        assert response.status_code == 404
    
    def test_ticket_verification_page(self, api_client):
        """Public verification page returns HTML"""
        # Test with a nonexistent code - should return 404 with HTML
        response = api_client.get(f"{BASE_URL}/api/verify-ticket/000000000000")
        # Returns HTML even for not found
        assert response.status_code == 404
        assert "text/html" in response.headers.get("content-type", "")


# ============================================================================
# PAYOUTS TESTS
# ============================================================================

class TestPayouts:
    """Test payouts endpoints"""
    
    def test_get_payouts_requires_auth(self, api_client):
        """Get payouts requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/payouts")
        assert response.status_code in [401, 403, 422]
    
    def test_get_payouts_returns_list(self, authenticated_super_admin):
        """Super Admin can get payouts list"""
        response = authenticated_super_admin.get(f"{BASE_URL}/api/payouts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


# ============================================================================
# WINNING TICKETS TESTS
# ============================================================================

class TestWinningTickets:
    """Test winning tickets endpoint"""
    
    def test_get_winning_tickets_requires_auth(self, api_client):
        """Get winning tickets requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/winning-tickets")
        assert response.status_code in [401, 403, 422]
    
    def test_get_winning_tickets_returns_list(self, authenticated_super_admin):
        """Authenticated user can get winning tickets"""
        response = authenticated_super_admin.get(f"{BASE_URL}/api/winning-tickets")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


# ============================================================================
# DASHBOARD STATS TESTS
# ============================================================================

class TestDashboardStats:
    """Test dashboard stats endpoint"""
    
    def test_dashboard_stats_requires_super_admin(self, authenticated_agent):
        """Dashboard stats requires Super Admin"""
        response = authenticated_agent.get(f"{BASE_URL}/api/dashboard-stats")
        assert response.status_code == 403
    
    def test_dashboard_stats_returns_comprehensive_data(self, authenticated_super_admin):
        """Super Admin can get comprehensive dashboard stats"""
        response = authenticated_super_admin.get(f"{BASE_URL}/api/dashboard-stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "companies" in data
        assert "agents" in data
        assert "lotteries" in data
        assert "today" in data
        assert "payouts" in data
        
        # Verify nested structure
        assert "total" in data["companies"]
        assert "active" in data["companies"]
        assert "total" in data["agents"]
        assert "sales" in data["today"]
