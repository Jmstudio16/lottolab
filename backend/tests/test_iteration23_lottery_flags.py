"""
Test Iteration 23 Features:
- Super Admin lottery flags API
- Supervisor lottery flags API
- Company Admin POS serial check API
- Haiti lotteries renamed (without hours)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vendor-flags.preview.emergentagent.com')

# Test credentials
SUPER_ADMIN = {"email": "jefferson@jmstudio.com", "password": "JMStudio@2026!"}
SUPERVISOR = {"email": "supervisor@lotopam.com", "password": "Supervisor123!"}
COMPANY_ADMIN = {"email": "admin@lotopam.com", "password": "Admin123!"}
VENDEUR = {"email": "agent.marie@lotopam.com", "password": "Agent123!"}


@pytest.fixture
def super_admin_token():
    """Get Super Admin JWT token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Super Admin login failed: {response.text}")


@pytest.fixture
def supervisor_token():
    """Get Supervisor JWT token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERVISOR)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Supervisor login failed: {response.text}")


@pytest.fixture
def company_admin_token():
    """Get Company Admin JWT token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Company Admin login failed: {response.text}")


@pytest.fixture
def vendeur_token():
    """Get Vendeur JWT token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Vendeur login failed: {response.text}")


class TestSuperAdminLotteryFlags:
    """Test Super Admin lottery flags endpoints"""
    
    def test_get_lottery_flags_returns_234_lotteries(self, super_admin_token):
        """Test /api/super/lottery-flags returns 234 total lotteries"""
        response = requests.get(
            f"{BASE_URL}/api/super/lottery-flags",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        lotteries = response.json()
        assert isinstance(lotteries, list)
        assert len(lotteries) == 234
    
    def test_lottery_flags_has_14_haiti_220_usa(self, super_admin_token):
        """Test lottery flags returns 14 HAITI and 220 USA lotteries"""
        response = requests.get(
            f"{BASE_URL}/api/super/lottery-flags",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        lotteries = response.json()
        
        haiti_lotteries = [l for l in lotteries if l.get("flag_type") == "HAITI"]
        usa_lotteries = [l for l in lotteries if l.get("flag_type") != "HAITI"]
        
        assert len(haiti_lotteries) == 14
        assert len(usa_lotteries) == 220
    
    def test_haiti_lotteries_renamed_without_hours(self, super_admin_token):
        """Test Haiti lotteries have renamed names without hours (e.g., Tennessee Matin instead of Tennessee Matin 10h15)"""
        response = requests.get(
            f"{BASE_URL}/api/super/lottery-flags",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        lotteries = response.json()
        
        haiti_lotteries = [l for l in lotteries if l.get("flag_type") == "HAITI"]
        
        expected_names = [
            "Tennessee Matin",
            "Tennessee Midi", 
            "Tennessee Soir",
            "Texas Matin",
            "Texas Midi",
            "Texas Soir",
            "Texas Nuit",
            "Georgia Midi",
            "Georgia Soir",
            "Georgia Nuit",
            "Florida Midi",
            "Florida Soir",
            "New York Midi",
            "New York Soir"
        ]
        
        lottery_names = [l.get("lottery_name") for l in haiti_lotteries]
        
        for name in expected_names:
            assert name in lottery_names, f"Expected lottery name '{name}' not found"
        
        # Verify no hours in names
        import re
        for name in lottery_names:
            assert not re.search(r'\d{1,2}h\d{2}', name), f"Lottery name '{name}' should not contain hours"
    
    def test_lottery_flags_stats_returns_correct_counts(self, super_admin_token):
        """Test /api/super/lottery-flags/stats returns correct counts"""
        response = requests.get(
            f"{BASE_URL}/api/super/lottery-flags/stats",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        stats = response.json()
        
        assert stats.get("total") == 234
        assert stats.get("haiti") == 14
        assert stats.get("usa") == 220
        assert "active" in stats


class TestSupervisorLotteryFlags:
    """Test Supervisor lottery flags endpoints"""
    
    def test_get_lottery_flags_returns_lotteries(self, supervisor_token):
        """Test /api/supervisor/lottery-flags returns lotteries"""
        response = requests.get(
            f"{BASE_URL}/api/supervisor/lottery-flags",
            headers={"Authorization": f"Bearer {supervisor_token}"}
        )
        assert response.status_code == 200
        lotteries = response.json()
        assert isinstance(lotteries, list)
        assert len(lotteries) > 0
    
    def test_lottery_flags_structure(self, supervisor_token):
        """Test lottery flags response has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/supervisor/lottery-flags",
            headers={"Authorization": f"Bearer {supervisor_token}"}
        )
        assert response.status_code == 200
        lotteries = response.json()
        
        if len(lotteries) > 0:
            lottery = lotteries[0]
            assert "lottery_id" in lottery
            assert "lottery_name" in lottery
            assert "flag_type" in lottery
            assert "is_enabled" in lottery
    
    def test_lottery_flags_toggle(self, supervisor_token):
        """Test lottery toggle endpoint works"""
        # Get first lottery
        response = requests.get(
            f"{BASE_URL}/api/supervisor/lottery-flags",
            headers={"Authorization": f"Bearer {supervisor_token}"}
        )
        assert response.status_code == 200
        lotteries = response.json()
        
        if len(lotteries) > 0:
            lottery_id = lotteries[0].get("lottery_id")
            
            # Toggle
            toggle_response = requests.post(
                f"{BASE_URL}/api/supervisor/lottery-flags/toggle/{lottery_id}",
                headers={"Authorization": f"Bearer {supervisor_token}"}
            )
            assert toggle_response.status_code == 200
            toggle_data = toggle_response.json()
            
            assert "lottery_id" in toggle_data
            assert "is_enabled" in toggle_data


class TestCompanyAdminPOSSerial:
    """Test Company Admin POS serial check endpoint"""
    
    def test_check_pos_serial_available(self, company_admin_token):
        """Test /api/company/check-pos-serial/{serial} returns available for new serial"""
        import time
        unique_serial = f"TEST-{int(time.time())}"
        
        response = requests.get(
            f"{BASE_URL}/api/company/check-pos-serial/{unique_serial}",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        assert response.status_code == 200
        result = response.json()
        
        assert result.get("serial") == unique_serial
        assert result.get("available") == True
        assert "Disponible" in result.get("message", "")


class TestVendeurProfile:
    """Test Vendeur profile endpoint"""
    
    def test_vendeur_profile_has_device_info(self, vendeur_token):
        """Test /api/vendeur/profile returns device/POS info"""
        response = requests.get(
            f"{BASE_URL}/api/vendeur/profile",
            headers={"Authorization": f"Bearer {vendeur_token}"}
        )
        assert response.status_code == 200
        profile = response.json()
        
        assert "vendeur" in profile
        assert "company" in profile
        assert "device" in profile
        
        # Device should have pos_serial_number field
        assert "pos_serial_number" in profile.get("device", {})
    
    def test_vendeur_profile_has_commission_rate(self, vendeur_token):
        """Test /api/vendeur/profile returns commission rate"""
        response = requests.get(
            f"{BASE_URL}/api/vendeur/profile",
            headers={"Authorization": f"Bearer {vendeur_token}"}
        )
        assert response.status_code == 200
        profile = response.json()
        
        vendeur = profile.get("vendeur", {})
        assert "commission_rate" in vendeur


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
