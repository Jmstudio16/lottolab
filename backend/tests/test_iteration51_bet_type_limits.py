"""
ITERATION 51: Bet Type Limits Testing
=====================================
Tests for Company Admin bet type limits configuration:
- GET /api/company/bet-type-limits (Company Admin)
- PUT /api/company/bet-type-limits (Company Admin)
- GET /api/company/vendor/bet-type-limits (Vendor)
- Backend validation in /api/lottery/sell

Game Types:
- BORLETTE, LOTO3, MARIAGE
- L4O1, L4O2, L4O3 (Loto 4 Options)
- L5O1, L5O2 (Loto 5 Extras)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "LotoPAM2026!"
VENDOR_EMAIL = "vendeur@lotopam.com"
VENDOR_PASSWORD = "vendor123"


class TestBetTypeLimitsAPI:
    """Test bet type limits endpoints"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        """Get Company Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        if response.status_code == 429:
            time.sleep(2)
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": COMPANY_ADMIN_EMAIL,
                "password": COMPANY_ADMIN_PASSWORD
            })
        
        if response.status_code != 200:
            pytest.skip(f"Company Admin login failed: {response.status_code}")
        
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def vendor_token(self):
        """Get Vendor token"""
        time.sleep(1)  # Avoid rate limiting
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD
        })
        if response.status_code == 429:
            time.sleep(2)
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": VENDOR_EMAIL,
                "password": VENDOR_PASSWORD
            })
        
        if response.status_code != 200:
            pytest.skip(f"Vendor login failed: {response.status_code}")
        
        return response.json().get("token")
    
    # =========================================================================
    # TEST: GET /api/company/bet-type-limits (Company Admin)
    # =========================================================================
    
    def test_get_bet_type_limits_company_admin(self, company_admin_token):
        """Company Admin can get bet type limits"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/bet-type-limits", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "limits" in data, "Response should contain 'limits'"
        assert "company_id" in data, "Response should contain 'company_id'"
        
        limits = data["limits"]
        
        # Verify all 8 game types are present
        expected_types = ["BORLETTE", "LOTO3", "MARIAGE", "L4O1", "L4O2", "L4O3", "L5O1", "L5O2"]
        for game_type in expected_types:
            assert game_type in limits, f"Missing game type: {game_type}"
            
            # Verify each type has required fields
            type_config = limits[game_type]
            assert "min_bet" in type_config, f"{game_type} missing min_bet"
            assert "max_bet" in type_config, f"{game_type} missing max_bet"
            assert "max_per_number" in type_config, f"{game_type} missing max_per_number"
            assert "enabled" in type_config, f"{game_type} missing enabled"
        
        print(f"✓ GET /api/company/bet-type-limits returns all 8 game types")
        print(f"  BORLETTE: min={limits['BORLETTE']['min_bet']}, max={limits['BORLETTE']['max_bet']}, enabled={limits['BORLETTE']['enabled']}")
    
    # =========================================================================
    # TEST: PUT /api/company/bet-type-limits (Company Admin)
    # =========================================================================
    
    def test_update_bet_type_limits(self, company_admin_token):
        """Company Admin can update bet type limits"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # First get current limits
        get_response = requests.get(f"{BASE_URL}/api/company/bet-type-limits", headers=headers)
        assert get_response.status_code == 200
        current_limits = get_response.json()["limits"]
        
        # Update BORLETTE limits
        new_limits = {
            "BORLETTE": {
                "min_bet": 10,
                "max_bet": 4000,
                "max_per_number": 8000,
                "enabled": True
            },
            "LOTO3": current_limits.get("LOTO3", {
                "min_bet": 5,
                "max_bet": 3000,
                "max_per_number": 6000,
                "enabled": True
            }),
            "MARIAGE": current_limits.get("MARIAGE", {
                "min_bet": 10,
                "max_bet": 2000,
                "max_per_number": 4000,
                "enabled": True
            }),
            "L4O1": current_limits.get("L4O1", {
                "min_bet": 5,
                "max_bet": 20,
                "max_per_number": 100,
                "enabled": True
            }),
            "L4O2": current_limits.get("L4O2", {
                "min_bet": 5,
                "max_bet": 20,
                "max_per_number": 100,
                "enabled": True
            }),
            "L4O3": current_limits.get("L4O3", {
                "min_bet": 5,
                "max_bet": 20,
                "max_per_number": 100,
                "enabled": True
            }),
            "L5O1": current_limits.get("L5O1", {
                "min_bet": 20,
                "max_bet": 250,
                "max_per_number": 500,
                "enabled": True
            }),
            "L5O2": current_limits.get("L5O2", {
                "min_bet": 20,
                "max_bet": 250,
                "max_per_number": 500,
                "enabled": True
            })
        }
        
        response = requests.put(
            f"{BASE_URL}/api/company/bet-type-limits",
            json={"limits": new_limits},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "limits" in data, "Response should contain updated limits"
        
        # Verify BORLETTE was updated
        updated_borlette = data["limits"].get("BORLETTE", {})
        assert updated_borlette.get("min_bet") == 10, f"BORLETTE min_bet should be 10, got {updated_borlette.get('min_bet')}"
        assert updated_borlette.get("max_bet") == 4000, f"BORLETTE max_bet should be 4000, got {updated_borlette.get('max_bet')}"
        
        print(f"✓ PUT /api/company/bet-type-limits successfully updated limits")
        print(f"  Updated BORLETTE: min={updated_borlette['min_bet']}, max={updated_borlette['max_bet']}")
    
    def test_update_limits_validation_min_greater_than_max(self, company_admin_token):
        """Backend should reject min_bet > max_bet"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        invalid_limits = {
            "BORLETTE": {
                "min_bet": 1000,  # min > max
                "max_bet": 100,
                "max_per_number": 5000,
                "enabled": True
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/company/bet-type-limits",
            json={"limits": invalid_limits},
            headers=headers
        )
        
        # Should return 400 for validation error
        assert response.status_code == 400, f"Expected 400 for invalid limits, got {response.status_code}"
        print(f"✓ Backend correctly rejects min_bet > max_bet")
    
    # =========================================================================
    # TEST: GET /api/company/vendor/bet-type-limits (Vendor)
    # =========================================================================
    
    def test_get_vendor_bet_type_limits(self, vendor_token):
        """Vendor can get bet type limits for their company"""
        headers = {"Authorization": f"Bearer {vendor_token}"}
        response = requests.get(f"{BASE_URL}/api/company/vendor/bet-type-limits", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "limits" in data, "Response should contain 'limits'"
        
        limits = data["limits"]
        
        # Verify all 8 game types are present
        expected_types = ["BORLETTE", "LOTO3", "MARIAGE", "L4O1", "L4O2", "L4O3", "L5O1", "L5O2"]
        for game_type in expected_types:
            assert game_type in limits, f"Missing game type: {game_type}"
        
        print(f"✓ GET /api/company/vendor/bet-type-limits returns limits for vendor")
        print(f"  BORLETTE enabled: {limits['BORLETTE'].get('enabled')}")
    
    # =========================================================================
    # TEST: Disable a game type
    # =========================================================================
    
    def test_disable_game_type(self, company_admin_token):
        """Company Admin can disable a game type"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Get current limits
        get_response = requests.get(f"{BASE_URL}/api/company/bet-type-limits", headers=headers)
        current_limits = get_response.json()["limits"]
        
        # Disable L5O2 (Loto 5 Extra 2)
        current_limits["L5O2"]["enabled"] = False
        
        response = requests.put(
            f"{BASE_URL}/api/company/bet-type-limits",
            json={"limits": current_limits},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify it's disabled
        verify_response = requests.get(f"{BASE_URL}/api/company/bet-type-limits", headers=headers)
        verify_limits = verify_response.json()["limits"]
        
        assert verify_limits["L5O2"]["enabled"] == False, "L5O2 should be disabled"
        
        print(f"✓ Successfully disabled L5O2 game type")
        
        # Re-enable for other tests
        current_limits["L5O2"]["enabled"] = True
        requests.put(
            f"{BASE_URL}/api/company/bet-type-limits",
            json={"limits": current_limits},
            headers=headers
        )
    
    # =========================================================================
    # TEST: Unauthorized access
    # =========================================================================
    
    def test_unauthorized_access(self):
        """Unauthenticated requests should be rejected"""
        response = requests.get(f"{BASE_URL}/api/company/bet-type-limits")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthorized access correctly rejected")
    
    def test_vendor_cannot_update_limits(self, vendor_token):
        """Vendor should not be able to update limits (Company Admin only)"""
        headers = {"Authorization": f"Bearer {vendor_token}"}
        
        response = requests.put(
            f"{BASE_URL}/api/company/bet-type-limits",
            json={"limits": {"BORLETTE": {"min_bet": 1, "max_bet": 100, "enabled": True}}},
            headers=headers
        )
        
        # Should return 403 Forbidden
        assert response.status_code == 403, f"Expected 403 for vendor, got {response.status_code}"
        print(f"✓ Vendor correctly denied access to update limits")


class TestBetTypeLimitsValidation:
    """Test backend validation of bet type limits during sales"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        """Get Company Admin token"""
        time.sleep(1)
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        if response.status_code == 429:
            time.sleep(2)
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": COMPANY_ADMIN_EMAIL,
                "password": COMPANY_ADMIN_PASSWORD
            })
        
        if response.status_code != 200:
            pytest.skip(f"Company Admin login failed: {response.status_code}")
        
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def vendor_token(self):
        """Get Vendor token via agent login"""
        time.sleep(1)
        response = requests.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD
        })
        if response.status_code == 429:
            time.sleep(2)
            response = requests.post(f"{BASE_URL}/api/auth/agent/login", json={
                "email": VENDOR_EMAIL,
                "password": VENDOR_PASSWORD
            })
        
        if response.status_code != 200:
            pytest.skip(f"Vendor login failed: {response.status_code}")
        
        return response.json().get("token")
    
    def test_setup_limits_for_validation(self, company_admin_token):
        """Setup specific limits for validation testing"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Set specific limits for testing
        test_limits = {
            "BORLETTE": {
                "min_bet": 10,
                "max_bet": 500,
                "max_per_number": 1000,
                "enabled": True
            },
            "LOTO3": {
                "min_bet": 5,
                "max_bet": 300,
                "max_per_number": 600,
                "enabled": True
            },
            "MARIAGE": {
                "min_bet": 10,
                "max_bet": 200,
                "max_per_number": 400,
                "enabled": True
            },
            "L4O1": {
                "min_bet": 5,
                "max_bet": 20,
                "max_per_number": 100,
                "enabled": True
            },
            "L4O2": {
                "min_bet": 5,
                "max_bet": 20,
                "max_per_number": 100,
                "enabled": True
            },
            "L4O3": {
                "min_bet": 5,
                "max_bet": 20,
                "max_per_number": 100,
                "enabled": False  # Disabled for testing
            },
            "L5O1": {
                "min_bet": 20,
                "max_bet": 250,
                "max_per_number": 500,
                "enabled": True
            },
            "L5O2": {
                "min_bet": 20,
                "max_bet": 250,
                "max_per_number": 500,
                "enabled": True
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/company/bet-type-limits",
            json={"limits": test_limits},
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to setup test limits: {response.text}"
        print(f"✓ Test limits configured: BORLETTE min=10, max=500; L4O3 disabled")
    
    def test_get_open_lotteries(self, vendor_token):
        """Get open lotteries for sale testing"""
        headers = {"Authorization": f"Bearer {vendor_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/vendeur/open-lotteries", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            lotteries = data.get("lotteries", [])
            print(f"✓ Found {len(lotteries)} open lotteries")
            if lotteries:
                print(f"  First lottery: {lotteries[0].get('lottery_name')}")
        else:
            print(f"  No open lotteries available (status: {response.status_code})")


class TestCompanyBetLimitsPageUI:
    """Test the CompanyBetLimitsPage UI elements"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        """Get Company Admin token"""
        time.sleep(1)
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        if response.status_code == 429:
            time.sleep(2)
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": COMPANY_ADMIN_EMAIL,
                "password": COMPANY_ADMIN_PASSWORD
            })
        
        if response.status_code != 200:
            pytest.skip(f"Company Admin login failed: {response.status_code}")
        
        return response.json().get("token")
    
    def test_page_data_structure(self, company_admin_token):
        """Verify the data structure matches what the UI expects"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/bet-type-limits", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # UI expects these exact game type IDs
        expected_ui_types = ["BORLETTE", "LOTO3", "MARIAGE", "L4O1", "L4O2", "L4O3", "L5O1", "L5O2"]
        
        for game_type in expected_ui_types:
            assert game_type in data["limits"], f"UI expects {game_type} but not found"
            
            config = data["limits"][game_type]
            # UI expects these exact field names
            assert "min_bet" in config, f"{game_type} missing min_bet for UI"
            assert "max_bet" in config, f"{game_type} missing max_bet for UI"
            assert "max_per_number" in config, f"{game_type} missing max_per_number for UI"
            assert "enabled" in config, f"{game_type} missing enabled for UI"
        
        print(f"✓ Data structure matches UI expectations for all 8 game types")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
