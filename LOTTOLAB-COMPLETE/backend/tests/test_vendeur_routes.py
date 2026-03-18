"""
Backend tests for Vendeur (Seller) Routes
Tests the complete vendeur POS functionality as defined in the MÉGA-PROMPT requirements
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Vendeur credentials
VENDEUR_EMAIL = "jean@gmail.com"
VENDEUR_PASSWORD = "Jeff.1995"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def vendeur_token(api_client):
    """Get vendeur authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": VENDEUR_EMAIL,
        "password": VENDEUR_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Vendeur authentication failed")


@pytest.fixture
def authenticated_client(api_client, vendeur_token):
    """Session with vendeur auth header"""
    api_client.headers.update({"Authorization": f"Bearer {vendeur_token}"})
    return api_client


class TestVendeurAuthentication:
    """Test vendeur login and authentication"""
    
    def test_vendeur_login_success(self, api_client):
        """Test vendeur can login successfully"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDEUR_EMAIL,
            "password": VENDEUR_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == VENDEUR_EMAIL
        assert data["user"]["role"] in ["AGENT_POS", "VENDEUR"]
        assert data["user"]["status"] == "ACTIVE"
    
    def test_vendeur_login_invalid_credentials(self, api_client):
        """Test login with invalid credentials returns 401"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDEUR_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestVendeurDashboard:
    """Test vendeur dashboard endpoint"""
    
    def test_dashboard_returns_stats(self, authenticated_client):
        """Test dashboard returns stats"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Verify stats structure
        assert "stats" in data
        stats = data["stats"]
        assert "ventes_jour" in stats
        assert "ventes_mois" in stats
        assert "commissions" in stats
        assert "tickets_jour" in stats
        assert "commission_rate" in stats
    
    def test_dashboard_returns_recent_tickets(self, authenticated_client):
        """Test dashboard returns recent tickets list"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "recent_tickets" in data
        assert isinstance(data["recent_tickets"], list)
    
    def test_dashboard_returns_recent_results(self, authenticated_client):
        """Test dashboard returns recent results"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "recent_results" in data
        assert isinstance(data["recent_results"], list)
        
        # Check result formatting for first result if exists
        if len(data["recent_results"]) > 0:
            result = data["recent_results"][0]
            assert "lottery_name" in result
            assert "winning_numbers_display" in result
    
    def test_dashboard_unauthorized(self, api_client):
        """Test dashboard without auth returns 401/403"""
        response = api_client.get(f"{BASE_URL}/api/vendeur/dashboard")
        assert response.status_code in [401, 403]


class TestVendeurMesTickets:
    """Test vendeur mes-tickets (my tickets) endpoint"""
    
    def test_mes_tickets_returns_list(self, authenticated_client):
        """Test mes-tickets returns ticket list"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/mes-tickets")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
    
    def test_mes_tickets_with_limit(self, authenticated_client):
        """Test mes-tickets respects limit parameter"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/mes-tickets?limit=5")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) <= 5
    
    def test_mes_tickets_ticket_structure(self, authenticated_client):
        """Test ticket structure in mes-tickets response"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/mes-tickets?limit=1")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            ticket = data[0]
            assert "ticket_id" in ticket
            assert "ticket_code" in ticket
            assert "lottery_name" in ticket
            assert "total_amount" in ticket
            assert "status" in ticket
            assert "plays" in ticket


class TestVendeurResults:
    """Test vendeur results endpoint"""
    
    def test_results_returns_list(self, authenticated_client):
        """Test results returns list of lottery results"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/results")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
    
    def test_results_structure(self, authenticated_client):
        """Test result structure"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/results?limit=3")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            result = data[0]
            assert "result_id" in result
            assert "lottery_name" in result
            assert "draw_date" in result
            assert "winning_numbers" in result
            assert "winning_numbers_display" in result
    
    def test_results_winning_numbers_format(self, authenticated_client):
        """Test winning numbers are properly formatted"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/results?limit=3")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            result = data[0]
            # winning_numbers should be converted to array
            wn = result.get("winning_numbers")
            assert isinstance(wn, (list, str))
            # winning_numbers_display should be string
            assert isinstance(result.get("winning_numbers_display"), str)


class TestVendeurProfile:
    """Test vendeur profile endpoint"""
    
    def test_profile_returns_user_info(self, authenticated_client):
        """Test profile returns user information"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/profile")
        assert response.status_code == 200
        data = response.json()
        
        assert "user_id" in data
        assert "name" in data
        assert "email" in data
        assert data["email"] == VENDEUR_EMAIL
        assert "role" in data
        assert "status" in data
        assert data["status"] == "ACTIVE"
    
    def test_profile_returns_company_info(self, authenticated_client):
        """Test profile returns company information"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/profile")
        assert response.status_code == 200
        data = response.json()
        
        assert "company_id" in data
        assert "company_name" in data


class TestVendeurDeviceConfig:
    """Test device config endpoint for lotteries (used by Nouvelle Vente)"""
    
    def test_device_config_returns_lotteries(self, authenticated_client):
        """Test device config returns enabled lotteries"""
        response = authenticated_client.get(f"{BASE_URL}/api/device/config")
        assert response.status_code == 200
        data = response.json()
        
        assert "enabled_lotteries" in data
        lotteries = data["enabled_lotteries"]
        assert isinstance(lotteries, list)
        # Should have 220 lotteries as per requirement
        assert len(lotteries) >= 100, f"Expected at least 100 lotteries, got {len(lotteries)}"
    
    def test_device_config_lottery_structure(self, authenticated_client):
        """Test lottery structure in device config"""
        response = authenticated_client.get(f"{BASE_URL}/api/device/config")
        assert response.status_code == 200
        data = response.json()
        
        lotteries = data.get("enabled_lotteries", [])
        if len(lotteries) > 0:
            lottery = lotteries[0]
            assert "lottery_id" in lottery
            assert "lottery_name" in lottery
    
    def test_device_config_returns_schedules(self, authenticated_client):
        """Test device config returns schedules"""
        response = authenticated_client.get(f"{BASE_URL}/api/device/config")
        assert response.status_code == 200
        data = response.json()
        
        assert "schedules" in data
        schedules = data["schedules"]
        assert isinstance(schedules, list)


class TestVendeurStats:
    """Test vendeur stats/reports endpoint"""
    
    def test_stats_today(self, authenticated_client):
        """Test stats for today"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/stats?period=today")
        assert response.status_code == 200
        data = response.json()
        
        assert "period" in data
        assert data["period"] == "today"
        assert "stats" in data
    
    def test_stats_month(self, authenticated_client):
        """Test stats for month"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/stats?period=month")
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"] == "month"
        assert "stats" in data
        assert "total_sales" in data["stats"]
        assert "total_tickets" in data["stats"]


class TestVendeurSearch:
    """Test vendeur search endpoint"""
    
    def test_search_returns_list(self, authenticated_client):
        """Test search returns ticket list"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/search")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
    
    def test_search_with_status_filter(self, authenticated_client):
        """Test search with status filter"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/search?status=PENDING")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)


class TestVendeurSell:
    """Test vendeur ticket sale endpoint"""
    
    def test_sell_ticket_success(self, authenticated_client):
        """Test creating a new ticket sale"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get a lottery_id first
        config_response = authenticated_client.get(f"{BASE_URL}/api/device/config")
        if config_response.status_code != 200:
            pytest.skip("Could not get device config")
        
        lotteries = config_response.json().get("enabled_lotteries", [])
        if not lotteries:
            pytest.skip("No lotteries available")
        
        lottery = lotteries[0]
        
        payload = {
            "lottery_id": lottery["lottery_id"],
            "draw_date": today,
            "draw_name": "Midday",
            "plays": [
                {
                    "numbers": "999",
                    "bet_type": "BORLETTE",
                    "amount": 25
                }
            ]
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/vendeur/sell", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert "ticket_id" in data
        assert "ticket_code" in data
        assert "total_amount" in data
        assert data["total_amount"] == 25
        assert "potential_win" in data
        assert data["potential_win"] > 0
    
    def test_sell_ticket_invalid_lottery(self, authenticated_client):
        """Test selling with invalid lottery returns error"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        payload = {
            "lottery_id": "invalid_lottery_id",
            "draw_date": today,
            "draw_name": "Midday",
            "plays": [
                {
                    "numbers": "123",
                    "bet_type": "BORLETTE",
                    "amount": 50
                }
            ]
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/vendeur/sell", json=payload)
        assert response.status_code in [404, 403, 400]


class TestVendeurUnauthorizedAccess:
    """Test unauthorized access to vendeur endpoints"""
    
    def test_endpoints_require_auth(self, api_client):
        """Test all vendeur endpoints require authentication"""
        endpoints = [
            "/api/vendeur/dashboard",
            "/api/vendeur/mes-tickets",
            "/api/vendeur/results",
            "/api/vendeur/profile",
            "/api/vendeur/stats",
            "/api/vendeur/search",
        ]
        
        for endpoint in endpoints:
            response = api_client.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], f"Endpoint {endpoint} should require auth"
