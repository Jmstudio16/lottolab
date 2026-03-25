"""
Test suite for Language Switcher and Bet Limits features
- Tests /api/device/config returns min_bet_amount
- Tests /api/company/profile allows modifying min_bet_amount
"""
import pytest
import requests
import os

BASE_URL = "http://localhost:8001"

# Test credentials
VENDEUR_CREDS = {"email": "vendeur@lotopam.com", "password": "Vendeur123!"}
COMPANY_ADMIN_CREDS = {"email": "admin@lotopam.com", "password": "Admin123!"}
SUPERVISOR_CREDS = {"email": "supervisor@lotopam.com", "password": "Supervisor123!"}


class TestAuthentication:
    """Test login for all roles"""
    
    def test_vendeur_login(self):
        """Test vendeur can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR_CREDS)
        assert response.status_code == 200, f"Vendeur login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        print(f"✓ Vendeur login successful, role: {data.get('user', {}).get('role')}")
        return data["token"]
    
    def test_company_admin_login(self):
        """Test company admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN_CREDS)
        assert response.status_code == 200, f"Company Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        print(f"✓ Company Admin login successful, role: {data.get('user', {}).get('role')}")
        return data["token"]
    
    def test_supervisor_login(self):
        """Test supervisor can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERVISOR_CREDS)
        assert response.status_code == 200, f"Supervisor login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        print(f"✓ Supervisor login successful, role: {data.get('user', {}).get('role')}")
        return data["token"]


class TestDeviceConfig:
    """Test /api/device/config endpoint returns min_bet_amount"""
    
    @pytest.fixture
    def vendeur_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR_CREDS)
        if response.status_code != 200:
            pytest.skip("Vendeur login failed")
        return response.json()["token"]
    
    def test_device_config_returns_min_bet_amount(self, vendeur_token):
        """Verify /api/device/config returns min_bet_amount = 1.0 (default)"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/device/config", headers=headers)
        
        assert response.status_code == 200, f"Device config failed: {response.text}"
        data = response.json()
        
        # Check configuration object exists
        assert "configuration" in data, "No 'configuration' in response"
        config = data["configuration"]
        
        # Check min_bet_amount exists and is correct
        assert "min_bet_amount" in config, "No 'min_bet_amount' in configuration"
        min_bet = config["min_bet_amount"]
        assert min_bet == 1.0 or min_bet == 1, f"Expected min_bet_amount=1.0, got {min_bet}"
        
        print(f"✓ /api/device/config returns min_bet_amount = {min_bet}")
        print(f"✓ Configuration: {config}")
        
    def test_device_config_returns_max_bet_amount(self, vendeur_token):
        """Verify /api/device/config returns max_bet_amount"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/device/config", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        config = data.get("configuration", {})
        
        assert "max_bet_amount" in config, "No 'max_bet_amount' in configuration"
        max_bet = config["max_bet_amount"]
        assert max_bet > 0, f"max_bet_amount should be positive, got {max_bet}"
        
        print(f"✓ /api/device/config returns max_bet_amount = {max_bet}")


class TestCompanyProfile:
    """Test /api/company/profile endpoint for min_bet_amount configuration"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip("Company Admin login failed")
        return response.json()["token"]
    
    def test_company_profile_get(self, admin_token):
        """Verify /api/company/profile returns min_bet_amount"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/profile", headers=headers)
        
        assert response.status_code == 200, f"Company profile GET failed: {response.text}"
        data = response.json()
        
        # Check min_bet_amount exists
        assert "min_bet_amount" in data, f"No 'min_bet_amount' in profile response. Keys: {data.keys()}"
        min_bet = data["min_bet_amount"]
        print(f"✓ Company profile returns min_bet_amount = {min_bet}")
        
        # Check max_bet_amount exists
        assert "max_bet_amount" in data, "No 'max_bet_amount' in profile response"
        max_bet = data["max_bet_amount"]
        print(f"✓ Company profile returns max_bet_amount = {max_bet}")
        
    def test_company_profile_update_min_bet(self, admin_token):
        """Verify Company Admin can update min_bet_amount"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get current value
        get_response = requests.get(f"{BASE_URL}/api/company/profile", headers=headers)
        assert get_response.status_code == 200
        original_min_bet = get_response.json().get("min_bet_amount", 1.0)
        
        # Update to a new value
        new_min_bet = 5.0
        update_response = requests.put(
            f"{BASE_URL}/api/company/profile",
            headers=headers,
            json={"min_bet_amount": new_min_bet}
        )
        
        assert update_response.status_code == 200, f"Profile update failed: {update_response.text}"
        print(f"✓ Company profile update successful")
        
        # Verify the update
        verify_response = requests.get(f"{BASE_URL}/api/company/profile", headers=headers)
        assert verify_response.status_code == 200
        updated_min_bet = verify_response.json().get("min_bet_amount")
        assert updated_min_bet == new_min_bet, f"Expected {new_min_bet}, got {updated_min_bet}"
        print(f"✓ min_bet_amount updated from {original_min_bet} to {updated_min_bet}")
        
        # Restore original value
        restore_response = requests.put(
            f"{BASE_URL}/api/company/profile",
            headers=headers,
            json={"min_bet_amount": original_min_bet}
        )
        assert restore_response.status_code == 200
        print(f"✓ Restored min_bet_amount to {original_min_bet}")


class TestVendeurCannotAccessCompanyProfile:
    """Verify vendeur cannot access company admin routes"""
    
    @pytest.fixture
    def vendeur_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR_CREDS)
        if response.status_code != 200:
            pytest.skip("Vendeur login failed")
        return response.json()["token"]
    
    def test_vendeur_cannot_access_company_profile(self, vendeur_token):
        """Vendeur should get 403 when accessing /api/company/profile"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/company/profile", headers=headers)
        
        # Should be 403 Forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Vendeur correctly denied access to /api/company/profile")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
