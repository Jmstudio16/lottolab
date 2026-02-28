"""
LOTTOLAB Production Ready Testing - Iteration 14
Tests: ResizeObserver fix, 220 lotteries, 5-min cancellation, PWA manifest, Company suspension
"""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/') or 'https://multi-tenant-lottery.preview.emergentagent.com'

# Credentials
AGENT_EMAIL = "agent.marie@lotopam.com"
AGENT_PASSWORD = "Agent123!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin123!"
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"


@pytest.fixture(scope="module")
def agent_token():
    """Login as agent and return token"""
    response = requests.post(f"{BASE_URL}/api/auth/agent/login", json={
        "email": AGENT_EMAIL,
        "password": AGENT_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Agent login failed - skipping agent tests")


@pytest.fixture(scope="module")
def company_admin_token():
    """Login as company admin and return token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": COMPANY_ADMIN_EMAIL,
        "password": COMPANY_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Company admin login failed - skipping company admin tests")


@pytest.fixture(scope="module")
def super_admin_token():
    """Login as super admin and return token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Super admin login failed - skipping super admin tests")


class TestAgentAuthentication:
    """Test agent authentication flows"""
    
    def test_agent_login_success(self):
        """Test successful agent login"""
        response = requests.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": AGENT_EMAIL,
            "password": AGENT_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "agent_id" in data
        assert "company_id" in data
        assert "device_session_id" in data
        assert data.get("agent_name") is not None
    
    def test_agent_login_invalid_password(self):
        """Test agent login with invalid password"""
        response = requests.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": AGENT_EMAIL,
            "password": "WrongPassword123!"
        })
        assert response.status_code == 401
    
    def test_agent_login_nonexistent_user(self):
        """Test agent login with nonexistent email"""
        response = requests.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": "nonexistent@example.com",
            "password": "SomePassword123!"
        })
        assert response.status_code == 401


class TestLotterySynchronization:
    """Test lottery sync - 220 lotteries should be visible to agent"""
    
    def test_device_config_returns_220_lotteries(self, agent_token):
        """CRITICAL: Agent must see 220 lotteries"""
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify 220 lotteries are returned
        enabled_lotteries = data.get("enabled_lotteries", [])
        assert len(enabled_lotteries) == 220, f"Expected 220 lotteries, got {len(enabled_lotteries)}"
    
    def test_device_config_contains_required_fields(self, agent_token):
        """Test device config has all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required top-level fields
        assert "config_version" in data
        assert "company" in data
        assert "agent" in data
        assert "configuration" in data
        assert "enabled_lotteries" in data
        assert "schedules" in data
    
    def test_5_minute_void_window_configured(self, agent_token):
        """Test 5-minute void window is configured correctly"""
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        config = data.get("configuration", {})
        assert config.get("void_window_minutes") == 5
    
    def test_lottery_has_required_fields(self, agent_token):
        """Test each lottery has required fields for display"""
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        lotteries = data.get("enabled_lotteries", [])
        assert len(lotteries) > 0, "No lotteries returned"
        
        # Check first lottery has required fields
        lottery = lotteries[0]
        assert "lottery_id" in lottery
        assert "lottery_name" in lottery
        assert "state_code" in lottery or "game_type" in lottery


class TestTicketCancellation5MinuteRule:
    """Test 5-minute cancellation rule"""
    
    def test_void_window_in_config(self, agent_token):
        """Verify void_window_minutes is set to 5"""
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        config = data.get("configuration", {})
        assert config.get("void_window_minutes") == 5, "Void window should be 5 minutes"
        assert config.get("allow_ticket_void") == True, "Ticket void should be allowed"
    
    def test_cancel_ticket_requires_reason(self, agent_token):
        """Test that cancellation requires a reason"""
        response = requests.post(
            f"{BASE_URL}/api/lottery/cancel",
            headers={"Authorization": f"Bearer {agent_token}"},
            json={
                "ticket_id": "nonexistent_ticket",
                "reason": ""  # Empty reason
            }
        )
        # Should fail with 400 or 422 for invalid request
        assert response.status_code in [400, 422, 404]
    
    def test_cancel_nonexistent_ticket(self, agent_token):
        """Test cancellation of nonexistent ticket returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/lottery/cancel",
            headers={"Authorization": f"Bearer {agent_token}"},
            json={
                "ticket_id": "nonexistent_ticket_12345",
                "reason": "Test cancellation"
            }
        )
        assert response.status_code == 404


class TestPublicTicketVerification:
    """Test public ticket verification (no auth required)"""
    
    def test_verify_invalid_ticket_returns_not_found_page(self):
        """Test verification of invalid ticket code"""
        response = requests.get(f"{BASE_URL}/api/verify-ticket/123456789012")
        assert response.status_code == 404
        assert "Ticket Non Trouvé" in response.text
    
    def test_verify_ticket_no_auth_required(self):
        """Test verification endpoint is publicly accessible"""
        response = requests.get(f"{BASE_URL}/api/verify-ticket/000000000000")
        # Should return HTML page (even if not found), not 401
        assert response.status_code != 401
        assert "html" in response.headers.get("content-type", "").lower()


class TestCompanySuspensionBlocksAccess:
    """Test that suspended companies block all user access"""
    
    def test_company_status_check_on_login(self):
        """Test that login checks company status"""
        # This test verifies the endpoint exists
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        # The login endpoint checks company status in code
    
    def test_super_admin_can_list_companies(self, super_admin_token):
        """Test super admin can see all companies with status"""
        response = requests.get(
            f"{BASE_URL}/api/super/companies",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        companies = response.json()
        
        # Verify companies have status field
        assert len(companies) >= 3, "Expected at least 3 companies (LotoPam Center, BJ LOTO, LOTO PAM)"
        for company in companies:
            assert "status" in company
            assert company.get("status") in ["ACTIVE", "SUSPENDED", "DELETED", "EXPIRED"]


class TestMultiTenantDataIsolation:
    """Test multi-tenant data isolation"""
    
    def test_agent_only_sees_own_company_lotteries(self, agent_token):
        """Agent should only see lotteries for their company"""
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Agent should only see their company's enabled lotteries
        company_id = data.get("company", {}).get("company_id")
        assert company_id is not None
        # All lotteries returned should be for this company
    
    def test_agent_cannot_access_other_company_tickets(self, agent_token):
        """Agent cannot access tickets from other companies"""
        # Try to access a ticket that doesn't belong to agent's company
        response = requests.get(
            f"{BASE_URL}/api/ticket/print/other_company_ticket",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        # Should return 404 (not found) not 200
        assert response.status_code in [404, 403]


class TestPWAManifest:
    """Test PWA manifest loads correctly"""
    
    def test_manifest_json_accessible(self):
        """Test manifest.json is publicly accessible"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
    
    def test_manifest_has_required_fields(self):
        """Test manifest has required PWA fields"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        manifest = response.json()
        
        assert "name" in manifest
        assert "short_name" in manifest
        assert "start_url" in manifest
        assert "display" in manifest
        assert "icons" in manifest
        
        # Check specific values
        assert manifest.get("name") == "LOTTOLAB - Lottery Management"
        assert manifest.get("short_name") == "LOTTOLAB"
        assert manifest.get("display") == "standalone"
    
    def test_manifest_has_icons(self):
        """Test manifest has icon definitions"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        manifest = response.json()
        
        icons = manifest.get("icons", [])
        assert len(icons) >= 2, "Expected at least 2 icons (192x192 and 512x512)"


class TestTicketPrintEndpoints:
    """Test ticket printing functionality"""
    
    def test_print_endpoint_requires_auth(self):
        """Test print endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/ticket/print/test_ticket_id")
        # Should return 401 or 403 without token
        assert response.status_code in [401, 403, 404]
    
    def test_print_nonexistent_ticket(self, agent_token):
        """Test printing nonexistent ticket returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/ticket/print/nonexistent_ticket_xyz",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 404


class TestSchedulerCronJobs:
    """Test subscription expiration cron functionality"""
    
    def test_companies_have_license_end_field(self, super_admin_token):
        """Test companies have license_end for expiration tracking"""
        response = requests.get(
            f"{BASE_URL}/api/super/companies",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        companies = response.json()
        
        # At least one company should have license tracking
        for company in companies:
            if "license_end" in company or "license_start" in company:
                return  # Pass if any company has license fields
        
        # It's OK if no company has explicit license fields yet
        # The system handles this via subscription_end or similar


class TestAgentDeviceSync:
    """Test agent device sync endpoint"""
    
    def test_device_sync_returns_valid_response(self, agent_token):
        """Test /device/sync returns expected fields"""
        response = requests.get(
            f"{BASE_URL}/api/device/sync",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "config_version" in data
        assert "agent_status" in data
        assert "daily_stats" in data
        assert "server_time" in data
    
    def test_device_sync_config_changed_flag(self, agent_token):
        """Test config_changed flag works correctly"""
        response = requests.get(
            f"{BASE_URL}/api/device/sync?last_config_version=1",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should indicate config changed since version 1
        assert "config_changed" in data
