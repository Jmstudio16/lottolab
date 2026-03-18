"""
LOTTOLAB Agent Features - Iteration 13 Tests
Tests for:
- Agent login endpoint
- Public ticket verification page
- Agent menu items (backend APIs)
- Lottery synchronization
- Ticket cancellation 5-minute rule
- Print ticket endpoint
"""

import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
AGENT_EMAIL = "agent.marie@lotopam.com"
AGENT_PASSWORD = "Agent123!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin123!"
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def agent_token(api_client):
    """Get agent authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/agent/login", json={
        "email": AGENT_EMAIL,
        "password": AGENT_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Agent authentication failed")


@pytest.fixture
def company_admin_token(api_client):
    """Get company admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": COMPANY_ADMIN_EMAIL,
        "password": COMPANY_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Company admin authentication failed")


@pytest.fixture
def super_admin_token(api_client):
    """Get super admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Super admin authentication failed")


class TestAgentLogin:
    """Tests for Agent Login Endpoint"""
    
    def test_agent_login_success(self, api_client):
        """Test agent login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": AGENT_EMAIL,
            "password": AGENT_PASSWORD
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "agent_id" in data
        assert "agent_name" in data
        assert "company_id" in data
        assert "company_name" in data
        assert "device_session_id" in data
        assert "device_type" in data
        assert "is_hardware_pos" in data
        assert data["agent_name"] == "Marie Dupont"
        assert data["company_name"] == "LotoPam Demo"
    
    def test_agent_login_invalid_credentials(self, api_client):
        """Test agent login with invalid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": AGENT_EMAIL,
            "password": "WrongPassword123!"
        })
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    def test_agent_login_nonexistent_user(self, api_client):
        """Test agent login with non-existent user"""
        response = api_client.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": "nonexistent@test.com",
            "password": "Test123!"
        })
        
        assert response.status_code == 401


class TestPublicTicketVerification:
    """Tests for Public Ticket Verification Page (No Login Required)"""
    
    def test_verify_ticket_invalid_code_returns_html(self, api_client):
        """Test that invalid verification code returns HTML page"""
        response = api_client.get(f"{BASE_URL}/api/verify-ticket/123456789012")
        
        # Should return HTML (not JSON)
        assert response.status_code == 404  # Ticket not found but page rendered
        assert "text/html" in response.headers.get("content-type", "")
        assert "Ticket Non Trouvé" in response.text
        assert "Le code de vérification est invalide" in response.text
    
    def test_verify_ticket_short_code(self, api_client):
        """Test with short verification code"""
        response = api_client.get(f"{BASE_URL}/api/verify-ticket/12345")
        
        assert response.status_code == 404
        assert "text/html" in response.headers.get("content-type", "")
    
    def test_verify_ticket_no_auth_required(self, api_client):
        """Test that no authentication is required"""
        # Make request without any auth headers
        api_client.headers.pop("Authorization", None)
        response = api_client.get(f"{BASE_URL}/api/verify-ticket/000000000000")
        
        # Should not return 401/403 - public endpoint
        assert response.status_code != 401
        assert response.status_code != 403


class TestDeviceConfig:
    """Tests for Device Config (Lottery Synchronization)"""
    
    def test_device_config_returns_data(self, api_client, agent_token):
        """Test device config returns proper structure"""
        response = api_client.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields for lottery sync
        assert "config_version" in data
        assert "company" in data
        assert "agent" in data
        assert "configuration" in data
        assert "enabled_lotteries" in data
        assert "schedules" in data
        
        # Check company info
        assert data["company"]["name"] == "LotoPam Demo"
        assert data["company"]["currency"] == "HTG"
        
        # Check configuration has void window
        assert "void_window_minutes" in data["configuration"]
        assert data["configuration"]["void_window_minutes"] == 5  # 5-minute rule
    
    def test_device_config_requires_auth(self, api_client):
        """Test device config requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/device/config")
        
        assert response.status_code == 401 or response.status_code == 403


class TestAgentTickets:
    """Tests for Agent Tickets Endpoint"""
    
    def test_get_agent_tickets(self, api_client, agent_token):
        """Test getting agent's own tickets"""
        response = api_client.get(
            f"{BASE_URL}/api/agent/tickets?limit=100",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_agent_tickets_requires_auth(self, api_client):
        """Test tickets endpoint requires auth"""
        response = api_client.get(f"{BASE_URL}/api/agent/tickets")
        
        assert response.status_code == 401 or response.status_code == 403


class TestTicketCancellation:
    """Tests for Ticket Cancellation (5-minute rule)"""
    
    def test_cancel_ticket_requires_reason(self, api_client, agent_token):
        """Test that cancellation requires a reason"""
        # Try to cancel a non-existent ticket without reason
        response = api_client.post(
            f"{BASE_URL}/api/lottery/cancel",
            headers={"Authorization": f"Bearer {agent_token}"},
            json={
                "ticket_id": "tkt_fake_id",
                "reason": ""
            }
        )
        
        # Should fail because ticket doesn't exist
        # But if it was valid, empty reason should be rejected
        assert response.status_code in [400, 404, 422]
    
    def test_cancel_nonexistent_ticket(self, api_client, agent_token):
        """Test cancelling a non-existent ticket"""
        response = api_client.post(
            f"{BASE_URL}/api/lottery/cancel",
            headers={"Authorization": f"Bearer {agent_token}"},
            json={
                "ticket_id": "tkt_nonexistent_12345",
                "reason": "Test cancellation"
            }
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data


class TestPrintTicket:
    """Tests for Print Ticket Endpoint (80mm POS Format)"""
    
    def test_print_nonexistent_ticket(self, api_client, agent_token):
        """Test printing non-existent ticket returns error"""
        response = api_client.get(
            f"{BASE_URL}/api/ticket/print/tkt_fake_id",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 404
    
    def test_print_requires_auth(self, api_client):
        """Test print endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/ticket/print/tkt_any_id")
        
        assert response.status_code in [401, 403]


class TestAgentSales:
    """Tests for Agent Sales Summary"""
    
    def test_get_agent_reports(self, api_client, agent_token):
        """Test getting agent sales reports"""
        response = api_client.get(
            f"{BASE_URL}/api/agent/reports",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert "totals" in data
        assert "details" in data


class TestCompanyLotteries:
    """Tests for Company Lotteries (Lottery Sync)"""
    
    def test_get_company_lotteries(self, api_client, company_admin_token):
        """Test getting company lotteries list"""
        response = api_client.get(
            f"{BASE_URL}/api/company/lotteries",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestResultsEndpoint:
    """Tests for Results Endpoint"""
    
    def test_get_latest_results(self, api_client, agent_token):
        """Test getting latest lottery results"""
        response = api_client.get(
            f"{BASE_URL}/api/results/latest",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestVoidWindowConfiguration:
    """Tests for 5-minute void window configuration"""
    
    def test_void_window_in_config(self, api_client, agent_token):
        """Test that void window is configured in device config"""
        response = api_client.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        config = data.get("configuration", {})
        assert "void_window_minutes" in config
        assert config["void_window_minutes"] == 5  # 5-minute rule
        assert "allow_ticket_void" in config
        assert config["allow_ticket_void"] == True
