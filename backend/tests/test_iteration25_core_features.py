"""
Iteration 25 - Core Features Backend Tests
Tests for:
1. Health check endpoint
2. Super Admin login with admin@lottolab.com / 123456
3. Dashboard stats API
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vendeur-checkout.preview.emergentagent.com').rstrip('/')

# Test credentials
SUPER_ADMIN = {
    "email": "admin@lottolab.com",
    "password": "123456"
}

COMPANY_ADMIN = {
    "email": "admin@lotopam.com", 
    "password": "Admin123!"
}


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def super_admin_token(api_client):
    """Get Super Admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Super Admin authentication failed: {response.status_code}")


@pytest.fixture
def company_admin_token(api_client):
    """Get Company Admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Company Admin authentication failed: {response.status_code}")


class TestHealthCheck:
    """Test API health check endpoint"""
    
    def test_health_endpoint_returns_200(self, api_client):
        """Health endpoint should return 200 OK"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
    def test_health_endpoint_returns_healthy_status(self, api_client):
        """Health endpoint should return healthy status"""
        response = api_client.get(f"{BASE_URL}/api/health")
        data = response.json()
        assert data.get("status") == "healthy"
        
    def test_health_endpoint_database_connected(self, api_client):
        """Health endpoint should show database connected"""
        response = api_client.get(f"{BASE_URL}/api/health")
        data = response.json()
        assert data.get("database") == "connected"
        
    def test_health_endpoint_permissions_ok(self, api_client):
        """Health endpoint should show permissions ok"""
        response = api_client.get(f"{BASE_URL}/api/health")
        data = response.json()
        assert data.get("permissions") == "ok"
        
    def test_health_endpoint_has_version(self, api_client):
        """Health endpoint should return version"""
        response = api_client.get(f"{BASE_URL}/api/health")
        data = response.json()
        assert "version" in data
        assert data.get("version") is not None
        
    def test_health_endpoint_has_timestamp(self, api_client):
        """Health endpoint should return timestamp"""
        response = api_client.get(f"{BASE_URL}/api/health")
        data = response.json()
        assert "timestamp" in data


class TestSuperAdminLogin:
    """Test Super Admin login with admin@lottolab.com"""
    
    def test_login_returns_200(self, api_client):
        """Login should return 200 OK"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert response.status_code == 200
        
    def test_login_returns_token(self, api_client):
        """Login should return a valid token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        data = response.json()
        assert "token" in data
        assert data.get("token") is not None
        assert len(data.get("token", "")) > 0
        
    def test_login_returns_user_data(self, api_client):
        """Login should return user data"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        data = response.json()
        assert "user" in data
        user = data.get("user")
        assert user is not None
        
    def test_login_returns_super_admin_role(self, api_client):
        """Login should return SUPER_ADMIN role"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        data = response.json()
        user = data.get("user")
        assert user.get("role") == "SUPER_ADMIN"
        
    def test_login_returns_correct_email(self, api_client):
        """Login should return correct email"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        data = response.json()
        user = data.get("user")
        assert user.get("email") == SUPER_ADMIN["email"]
        
    def test_login_returns_redirect_path(self, api_client):
        """Login should return redirect path to super dashboard"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        data = response.json()
        assert "redirect_path" in data
        assert data.get("redirect_path") == "/super/dashboard"
        
    def test_login_invalid_credentials_returns_401(self, api_client):
        """Login with invalid credentials should return 401"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestCompanyAdminLogin:
    """Test Company Admin login"""
    
    def test_company_admin_login_returns_200(self, api_client):
        """Company Admin login should return 200 OK"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN)
        assert response.status_code == 200
        
    def test_company_admin_returns_company_admin_role(self, api_client):
        """Login should return COMPANY_ADMIN role"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN)
        data = response.json()
        user = data.get("user")
        assert user.get("role") == "COMPANY_ADMIN"
        
    def test_company_admin_returns_company_dashboard_redirect(self, api_client):
        """Company Admin login should redirect to company dashboard"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN)
        data = response.json()
        assert data.get("redirect_path") == "/company/dashboard"


class TestDashboardStatsAPI:
    """Test Dashboard Stats API endpoints"""
    
    def test_super_admin_can_access_saas_dashboard_stats(self, api_client, super_admin_token):
        """Super Admin should access SaaS dashboard stats"""
        api_client.headers.update({"Authorization": f"Bearer {super_admin_token}"})
        response = api_client.get(f"{BASE_URL}/api/saas/dashboard-stats")
        assert response.status_code == 200
        
    def test_dashboard_stats_returns_total_companies(self, api_client, super_admin_token):
        """Dashboard stats should return total companies count"""
        api_client.headers.update({"Authorization": f"Bearer {super_admin_token}"})
        response = api_client.get(f"{BASE_URL}/api/saas/dashboard-stats")
        data = response.json()
        assert "total_companies" in data
        assert isinstance(data.get("total_companies"), int)
        
    def test_dashboard_stats_returns_active_companies(self, api_client, super_admin_token):
        """Dashboard stats should return active companies count"""
        api_client.headers.update({"Authorization": f"Bearer {super_admin_token}"})
        response = api_client.get(f"{BASE_URL}/api/saas/dashboard-stats")
        data = response.json()
        assert "active_companies" in data
        assert isinstance(data.get("active_companies"), int)
        
    def test_dashboard_stats_returns_total_agents(self, api_client, super_admin_token):
        """Dashboard stats should return total agents count"""
        api_client.headers.update({"Authorization": f"Bearer {super_admin_token}"})
        response = api_client.get(f"{BASE_URL}/api/saas/dashboard-stats")
        data = response.json()
        assert "total_agents" in data
        assert isinstance(data.get("total_agents"), int)
        
    def test_dashboard_stats_returns_tickets_today(self, api_client, super_admin_token):
        """Dashboard stats should return tickets today count"""
        api_client.headers.update({"Authorization": f"Bearer {super_admin_token}"})
        response = api_client.get(f"{BASE_URL}/api/saas/dashboard-stats")
        data = response.json()
        assert "tickets_today" in data
        assert isinstance(data.get("tickets_today"), int)


class TestCompaniesListAPI:
    """Test Companies List API"""
    
    def test_super_admin_can_list_companies(self, api_client, super_admin_token):
        """Super Admin should be able to list companies"""
        api_client.headers.update({"Authorization": f"Bearer {super_admin_token}"})
        response = api_client.get(f"{BASE_URL}/api/saas/companies")
        assert response.status_code == 200
        
    def test_companies_list_returns_array(self, api_client, super_admin_token):
        """Companies list should return an array"""
        api_client.headers.update({"Authorization": f"Bearer {super_admin_token}"})
        response = api_client.get(f"{BASE_URL}/api/saas/companies")
        data = response.json()
        assert isinstance(data, list)
        
    def test_companies_have_required_fields(self, api_client, super_admin_token):
        """Each company should have required fields"""
        api_client.headers.update({"Authorization": f"Bearer {super_admin_token}"})
        response = api_client.get(f"{BASE_URL}/api/saas/companies")
        data = response.json()
        if len(data) > 0:
            company = data[0]
            assert "company_id" in company
            assert "name" in company
            assert "status" in company
            assert "created_at" in company


class TestUnauthorizedAccess:
    """Test unauthorized access to protected endpoints"""
    
    def test_dashboard_stats_requires_auth(self, api_client):
        """Dashboard stats should require authentication"""
        response = api_client.get(f"{BASE_URL}/api/saas/dashboard-stats")
        assert response.status_code in [401, 403]
        
    def test_companies_list_requires_auth(self, api_client):
        """Companies list should require authentication"""
        response = api_client.get(f"{BASE_URL}/api/saas/companies")
        assert response.status_code in [401, 403]
