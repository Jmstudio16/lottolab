"""
Backend tests for Iteration 20 - Vendeur Pages Corrections
Tests:
1. GET /api/vendeur/mes-tickets - returns vendeur tickets
2. GET /api/vendeur/profile - returns complete profile info (company, succursale, supervisor, device, commission)
3. POST /api/vendeur/profile/photo - photo upload
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from request
VENDEUR_EMAIL = "agent.marie@lotopam.com"
VENDEUR_PASSWORD = "Agent123!"
EXPECTED_COMPANY = "LotoPam Center"


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
    pytest.skip(f"Vendeur authentication failed: {response.text}")


@pytest.fixture
def authenticated_client(api_client, vendeur_token):
    """Session with vendeur auth header"""
    api_client.headers.update({"Authorization": f"Bearer {vendeur_token}"})
    return api_client


class TestVendeurLogin:
    """Test vendeur login"""
    
    def test_vendeur_login_success(self, api_client):
        """Test vendeur can login with provided credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDEUR_EMAIL,
            "password": VENDEUR_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == VENDEUR_EMAIL
        assert data["user"]["role"] in ["AGENT_POS", "VENDEUR"]
        assert data["user"]["status"] == "ACTIVE"


class TestVendeurMesTickets:
    """Test GET /api/vendeur/mes-tickets endpoint"""
    
    def test_mes_tickets_returns_list(self, authenticated_client):
        """Test mes-tickets returns ticket list"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/mes-tickets")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
    
    def test_mes_tickets_ticket_structure(self, authenticated_client):
        """Test ticket structure contains required fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/mes-tickets?limit=5")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            ticket = data[0]
            # Required fields
            assert "ticket_id" in ticket, "ticket_id missing"
            assert "ticket_code" in ticket, "ticket_code missing"
            assert "lottery_name" in ticket, "lottery_name missing"
            assert "total_amount" in ticket, "total_amount missing"
            assert "status" in ticket, "status missing"
            assert "plays" in ticket, "plays missing"
            assert "created_at" in ticket, "created_at missing"
    
    def test_mes_tickets_with_status_filter(self, authenticated_client):
        """Test mes-tickets with status filter"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/mes-tickets?status=PENDING")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestVendeurProfile:
    """Test GET /api/vendeur/profile endpoint - complete profile info"""
    
    def test_profile_returns_vendeur_info(self, authenticated_client):
        """Test profile returns vendeur information"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/profile")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "vendeur" in data, "vendeur section missing"
        vendeur = data["vendeur"]
        assert "user_id" in vendeur
        assert "name" in vendeur
        assert "email" in vendeur
        assert vendeur["email"] == VENDEUR_EMAIL
        assert "status" in vendeur
        assert "commission_rate" in vendeur
    
    def test_profile_returns_company_info(self, authenticated_client):
        """Test profile returns company information"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/profile")
        assert response.status_code == 200
        data = response.json()
        
        assert "company" in data, "company section missing"
        company = data["company"]
        assert "company_id" in company
        assert "name" in company
        assert company["name"] == EXPECTED_COMPANY, f"Expected {EXPECTED_COMPANY}, got {company['name']}"
        # logo_url can be null or string
        assert "logo_url" in company
    
    def test_profile_returns_succursale_info(self, authenticated_client):
        """Test profile returns succursale (branch) information"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/profile")
        assert response.status_code == 200
        data = response.json()
        
        assert "succursale" in data, "succursale section missing"
        succursale = data["succursale"]
        assert "succursale_id" in succursale
        assert "name" in succursale
    
    def test_profile_returns_supervisor_info(self, authenticated_client):
        """Test profile returns supervisor information"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/profile")
        assert response.status_code == 200
        data = response.json()
        
        assert "supervisor" in data, "supervisor section missing"
        supervisor = data["supervisor"]
        assert "name" in supervisor
        # telephone can be null
        assert "telephone" in supervisor
    
    def test_profile_returns_device_info(self, authenticated_client):
        """Test profile returns device information"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/profile")
        assert response.status_code == 200
        data = response.json()
        
        assert "device" in data, "device section missing"
        device = data["device"]
        assert "device_id" in device
        # device_name and status can be null
        assert "device_name" in device
        assert "status" in device
    
    def test_profile_commission_rate_numeric(self, authenticated_client):
        """Test commission_rate is a numeric value"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/profile")
        assert response.status_code == 200
        data = response.json()
        
        vendeur = data.get("vendeur", {})
        commission_rate = vendeur.get("commission_rate")
        assert isinstance(commission_rate, (int, float)), f"commission_rate should be numeric, got {type(commission_rate)}"
        assert commission_rate >= 0 and commission_rate <= 100, f"commission_rate should be 0-100, got {commission_rate}"


class TestVendeurProfilePhotoUpload:
    """Test POST /api/vendeur/profile/photo endpoint"""
    
    def test_photo_upload_success(self, authenticated_client):
        """Test photo upload works"""
        # Create a minimal valid PNG (1x1 pixel)
        import base64
        png_1x1 = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
        
        files = {"file": ("test_photo.png", png_1x1, "image/png")}
        # Remove Content-Type for multipart
        headers = {"Authorization": authenticated_client.headers["Authorization"]}
        
        response = requests.post(
            f"{BASE_URL}/api/vendeur/profile/photo",
            files=files,
            headers=headers
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "photo_url" in data
        assert data["photo_url"].startswith("/uploads/")
    
    def test_photo_upload_invalid_type(self, authenticated_client):
        """Test photo upload rejects non-image files"""
        files = {"file": ("test.txt", b"not an image", "text/plain")}
        headers = {"Authorization": authenticated_client.headers["Authorization"]}
        
        response = requests.post(
            f"{BASE_URL}/api/vendeur/profile/photo",
            files=files,
            headers=headers
        )
        assert response.status_code == 400, f"Should reject non-image: {response.text}"


class TestVendeurStats:
    """Test vendeur stats endpoint (used by Mes Ventes page)"""
    
    def test_stats_returns_data(self, authenticated_client):
        """Test stats endpoint returns statistics"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/stats?period=today")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "period" in data
        assert "stats" in data
        stats = data["stats"]
        assert "total_tickets" in stats
        assert "total_sales" in stats
        assert "commission" in stats
        assert "commission_rate" in stats
    
    def test_stats_period_month(self, authenticated_client):
        """Test stats for month period"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/stats?period=month")
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "month"
    
    def test_stats_returns_lottery_breakdown(self, authenticated_client):
        """Test stats returns sales by lottery"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/stats?period=all")
        assert response.status_code == 200
        data = response.json()
        
        assert "by_lottery" in data
        assert isinstance(data["by_lottery"], list)


class TestVendeurDashboard:
    """Test vendeur dashboard endpoint"""
    
    def test_dashboard_returns_stats(self, authenticated_client):
        """Test dashboard returns stats with commission info"""
        response = authenticated_client.get(f"{BASE_URL}/api/vendeur/dashboard")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "stats" in data
        stats = data["stats"]
        assert "ventes_jour" in stats
        assert "ventes_mois" in stats
        assert "commissions" in stats
        assert "commission_rate" in stats
