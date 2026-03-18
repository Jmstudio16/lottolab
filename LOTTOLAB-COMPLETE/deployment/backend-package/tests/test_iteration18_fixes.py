"""
Test Iteration 18 - Bug Fixes Testing
Focus:
1. Company Admin can view tickets sold by vendeurs (lottery_transactions collection)
2. Succursale suspend/activate endpoints
3. Super Admin Global Schedules endpoint
4. Vendeur blocked if succursale is suspended
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin123!"


@pytest.fixture
def super_admin_token():
    """Login as Super Admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Super Admin login failed: {response.status_code}")


@pytest.fixture
def company_admin_token():
    """Login as Company Admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": COMPANY_ADMIN_EMAIL,
        "password": COMPANY_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Company Admin login failed: {response.status_code}")


class TestCompanyTicketsEndpoint:
    """Test Company Admin can view vendeur tickets (from lottery_transactions)"""
    
    def test_get_company_tickets_success(self, company_admin_token):
        """GET /api/company/tickets should return tickets from lottery_transactions"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/tickets", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Company tickets endpoint returned {len(data)} tickets")
    
    def test_get_company_tickets_with_filters(self, company_admin_token):
        """GET /api/company/tickets with filters"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/tickets?status=ACTIVE", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Filtered tickets endpoint returned {len(data)} tickets")
    
    def test_get_single_ticket_404(self, company_admin_token):
        """GET /api/company/tickets/{ticket_id} should return 404 for non-existent ticket"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/tickets/nonexistent_ticket_123", headers=headers)
        
        # Should be 404 since ticket doesn't exist
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent ticket returns 404")


class TestSuccursaleSuspendActivate:
    """Test Succursale suspend/activate endpoints"""
    
    def test_get_succursales_list(self, company_admin_token):
        """GET /api/company/succursales should work"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/succursales", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} succursales")
        return data
    
    def test_succursale_suspend_endpoint_exists(self, company_admin_token):
        """PUT /api/company/succursales/{id}/suspend should exist"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # First get succursales
        succursales = requests.get(f"{BASE_URL}/api/company/succursales", headers=headers).json()
        
        if not succursales:
            pytest.skip("No succursales to test suspension")
        
        # Try to suspend an active succursale
        active_succs = [s for s in succursales if s.get("status") == "ACTIVE"]
        if not active_succs:
            pytest.skip("No active succursales to test")
        
        succ_id = active_succs[0]["succursale_id"]
        response = requests.put(
            f"{BASE_URL}/api/company/succursales/{succ_id}/suspend",
            headers=headers
        )
        
        # Should be 200 or 400 (already suspended)
        assert response.status_code in [200, 400], f"Got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            print(f"✓ Succursale suspended: {data}")
            
            # Now reactivate it
            activate_response = requests.put(
                f"{BASE_URL}/api/company/succursales/{succ_id}/activate",
                headers=headers
            )
            assert activate_response.status_code == 200, f"Failed to reactivate: {activate_response.text}"
            print(f"✓ Succursale reactivated: {activate_response.json()}")
        else:
            print(f"✓ Succursale already suspended or error: {response.json()}")
    
    def test_succursale_activate_endpoint_exists(self, company_admin_token):
        """PUT /api/company/succursales/{id}/activate should exist"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Get succursales
        succursales = requests.get(f"{BASE_URL}/api/company/succursales", headers=headers).json()
        
        if not succursales:
            pytest.skip("No succursales")
        
        # Find a suspended succursale
        suspended_succs = [s for s in succursales if s.get("status") == "SUSPENDED"]
        
        if not suspended_succs:
            # Test that activate returns 400 for non-suspended
            active_succs = [s for s in succursales if s.get("status") == "ACTIVE"]
            if active_succs:
                succ_id = active_succs[0]["succursale_id"]
                response = requests.put(
                    f"{BASE_URL}/api/company/succursales/{succ_id}/activate",
                    headers=headers
                )
                # Should return 400 because it's not suspended
                assert response.status_code == 400, f"Expected 400, got {response.status_code}"
                print("✓ Activate on non-suspended returns 400 as expected")
            else:
                pytest.skip("No succursales to test")
        else:
            succ_id = suspended_succs[0]["succursale_id"]
            response = requests.put(
                f"{BASE_URL}/api/company/succursales/{succ_id}/activate",
                headers=headers
            )
            assert response.status_code == 200, f"Failed: {response.text}"
            print(f"✓ Activated suspended succursale")


class TestSuperAdminGlobalSchedules:
    """Test Super Admin Global Schedules endpoint"""
    
    def test_global_schedules_endpoint(self, super_admin_token):
        """GET /api/saas/global-schedules should work for Super Admin"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/saas/global-schedules", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return a list of schedules"
        print(f"✓ Global schedules returned {len(data)} schedules")
    
    def test_master_lotteries_endpoint(self, super_admin_token):
        """GET /api/saas/master-lotteries should work for Super Admin"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return a list of lotteries"
        print(f"✓ Master lotteries returned {len(data)} lotteries")
    
    def test_lottery_catalog_frontend_bug(self, super_admin_token):
        """BUG: Frontend calls /api/saas/lottery-catalog which doesn't exist
        Should be /api/saas/master-lotteries or need new endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # This endpoint doesn't exist - frontend bug
        response = requests.get(f"{BASE_URL}/api/saas/lottery-catalog", headers=headers)
        
        # Document that this returns 404
        assert response.status_code == 404, f"Expected 404 (known bug), got {response.status_code}"
        print("✓ Confirmed BUG: /api/saas/lottery-catalog returns 404")
        print("  FIX NEEDED: SuperGlobalSchedulesPage.js calls wrong endpoint")
        print("  Should be /api/saas/master-lotteries")


class TestVendeurSuspendedBlockCheck:
    """Test that vendeur is blocked if succursale is suspended"""
    
    def test_vendeur_login_active_succursale(self, company_admin_token):
        """Vendeur can login when succursale is active"""
        # Get vendeur credentials (jean@gmail.com / Jeff.1995)
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "jean@gmail.com",
            "password": "Jeff.1995"
        })
        
        if response.status_code == 200:
            print("✓ Vendeur login successful (succursale active)")
        elif response.status_code == 401:
            pytest.skip("Vendeur credentials invalid or account issue")
        elif response.status_code == 403:
            # Check if due to suspension
            error = response.json().get("detail", "")
            if "suspendu" in error.lower() or "suspended" in error.lower():
                print(f"✓ Vendeur blocked due to suspension: {error}")
            else:
                pytest.fail(f"Unexpected 403: {error}")
        else:
            pytest.skip(f"Vendeur login returned {response.status_code}: {response.text}")


class TestSuccursaleUpdateEndpoint:
    """Test PUT /api/company/succursales/{id} for editing"""
    
    def test_update_succursale(self, company_admin_token):
        """Test updating a succursale"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Get succursales
        response = requests.get(f"{BASE_URL}/api/company/succursales", headers=headers)
        succursales = response.json()
        
        if not succursales:
            pytest.skip("No succursales to update")
        
        succ = succursales[0]
        succ_id = succ["succursale_id"]
        
        # Try to update the message field
        update_data = {
            "message": f"Test message updated at {__import__('datetime').datetime.now().isoformat()}"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/company/succursales/{succ_id}",
            headers=headers,
            json=update_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Succursale updated successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
