"""
Universal POS Terminal API Tests
Tests agent login, device config, device sync, and lottery sales
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://lottery-control-hub.preview.emergentagent.com')

# Test credentials
AGENT_EMAIL = "agent001@lotopam.com"
AGENT_PASSWORD = "Agent123!"

class TestAgentAuthentication:
    """Test universal agent authentication endpoint"""
    
    def test_agent_login_without_imei_success(self):
        """Agent login without IMEI header (browser/computer device)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/agent/login",
            json={"email": AGENT_EMAIL, "password": AGENT_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "token" in data, "Missing token in response"
        assert "agent_id" in data, "Missing agent_id in response"
        assert "agent_name" in data, "Missing agent_name in response"
        assert "company_id" in data, "Missing company_id in response"
        assert "company_name" in data, "Missing company_name in response"
        assert "device_session_id" in data, "Missing device_session_id in response"
        assert "device_type" in data, "Missing device_type in response"
        assert "is_hardware_pos" in data, "Missing is_hardware_pos in response"
        
        # Verify values
        assert data["is_hardware_pos"] == False, "Should be browser device without IMEI"
        assert data["device_type"] in ["BROWSER", "COMPUTER", "PHONE", "TABLET"]
        assert len(data["token"]) > 0, "Token should not be empty"
        
    def test_agent_login_invalid_credentials(self):
        """Agent login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/agent/login",
            json={"email": AGENT_EMAIL, "password": "WrongPassword123!"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 401, f"Should return 401: {response.text}"
        
    def test_agent_login_non_agent_account(self):
        """Non-agent account should be rejected"""
        response = requests.post(
            f"{BASE_URL}/api/auth/agent/login",
            json={"email": "admin@lotopam.com", "password": "Admin123!"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 403, f"Should return 403 for non-agent: {response.text}"


class TestDeviceConfig:
    """Test device configuration endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/agent/login",
            json={"email": AGENT_EMAIL, "password": AGENT_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
        
    def test_get_device_config(self, auth_token):
        """Get device configuration for POS startup"""
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Config fetch failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "company" in data, "Missing company in response"
        assert "agent" in data, "Missing agent in response"
        assert "configuration" in data, "Missing configuration in response"
        assert "enabled_lotteries" in data, "Missing enabled_lotteries in response"
        assert "schedules" in data, "Missing schedules in response"
        assert "prime_configs" in data, "Missing prime_configs in response"
        assert "timestamp" in data, "Missing timestamp in response"
        assert "config_version" in data, "Missing config_version in response"
        
        # Verify company data
        company = data["company"]
        assert "company_id" in company
        assert "name" in company
        assert "currency" in company
        assert company["name"] == "LotoPam Center", "Company name should match"
        assert company["currency"] == "HTG", "Currency should be HTG"
        
        # Verify agent data
        agent = data["agent"]
        assert "agent_id" in agent
        assert "name" in agent
        
    def test_device_config_without_auth(self):
        """Device config should require authentication"""
        response = requests.get(f"{BASE_URL}/api/device/config")
        
        assert response.status_code in [401, 403], f"Should require auth: {response.text}"


class TestDeviceSync:
    """Test real-time sync endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/agent/login",
            json={"email": AGENT_EMAIL, "password": AGENT_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
        
    def test_get_device_sync(self, auth_token):
        """Get real-time sync data"""
        response = requests.get(
            f"{BASE_URL}/api/device/sync",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Sync failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "results" in data, "Missing results in response"
        assert "daily_stats" in data, "Missing daily_stats in response"
        assert "balance" in data, "Missing balance in response"
        assert "server_time" in data, "Missing server_time in response"
        
        # Verify daily_stats structure
        daily_stats = data["daily_stats"]
        assert "tickets" in daily_stats
        assert "sales" in daily_stats
        assert "wins" in daily_stats
        assert "net" in daily_stats
        
        # Verify balance structure
        balance = data["balance"]
        assert "credit" in balance
        assert "winnings" in balance


class TestAgentTickets:
    """Test agent tickets endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/agent/login",
            json={"email": AGENT_EMAIL, "password": AGENT_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
        
    def test_get_agent_tickets(self, auth_token):
        """Get agent's tickets"""
        response = requests.get(
            f"{BASE_URL}/api/agent/tickets?limit=10",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Tickets fetch failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Should return a list of tickets"


class TestLatestResults:
    """Test latest results endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/agent/login",
            json={"email": AGENT_EMAIL, "password": AGENT_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
        
    def test_get_latest_results(self, auth_token):
        """Get latest lottery results"""
        response = requests.get(
            f"{BASE_URL}/api/results/latest",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Results fetch failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Should return a list of results"


class TestAgentReports:
    """Test agent reports endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/agent/login",
            json={"email": AGENT_EMAIL, "password": AGENT_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
        
    def test_get_agent_reports(self, auth_token):
        """Get agent's sales reports"""
        response = requests.get(
            f"{BASE_URL}/api/agent/reports",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Reports fetch failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "period" in data, "Missing period in response"
        assert "details" in data, "Missing details in response"
        assert "totals" in data, "Missing totals in response"
        
        # Verify totals structure
        totals = data["totals"]
        assert "tickets_count" in totals
        assert "total_sales" in totals
        assert "net_revenue" in totals


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
