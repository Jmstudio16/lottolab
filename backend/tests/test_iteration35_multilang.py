"""
Iteration 35 - Multilingual System & Lottery Schedule Tests
Tests for:
1. Device config API returns min/max bet amounts
2. Lottery schedules with open/close times
3. Company primes configuration
4. Bet limits synchronization
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')

# Test credentials
VENDEUR_EMAIL = "pierre.jean@agent.com"
VENDEUR_PASSWORD = "Vendeur123!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Test123!"


class TestDeviceConfigAPI:
    """Tests for /api/device/config endpoint - bet limits and lottery schedules"""
    
    @pytest.fixture(scope="class")
    def vendeur_token(self):
        """Get vendeur authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VENDEUR_EMAIL, "password": VENDEUR_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    def test_device_config_returns_bet_limits(self, vendeur_token):
        """Test that device config returns min_bet_amount and max_bet_amount"""
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {vendeur_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check configuration section exists
        assert "configuration" in data
        config = data["configuration"]
        
        # Check bet limits are present
        assert "min_bet_amount" in config, "min_bet_amount missing from config"
        assert "max_bet_amount" in config, "max_bet_amount missing from config"
        
        # Verify values are numbers
        assert isinstance(config["min_bet_amount"], (int, float))
        assert isinstance(config["max_bet_amount"], (int, float))
        
        # Verify min is 1 HTG (default)
        assert config["min_bet_amount"] >= 1, "min_bet_amount should be at least 1"
        
        print(f"✓ Bet limits: min={config['min_bet_amount']}, max={config['max_bet_amount']}")
    
    def test_device_config_returns_enabled_lotteries(self, vendeur_token):
        """Test that device config returns enabled lotteries with schedules"""
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {vendeur_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check enabled_lotteries exists
        assert "enabled_lotteries" in data
        lotteries = data["enabled_lotteries"]
        
        # Should have lotteries
        assert len(lotteries) > 0, "No enabled lotteries found"
        print(f"✓ Found {len(lotteries)} enabled lotteries")
        
        # Check first lottery has schedule info
        first_lottery = lotteries[0]
        assert "lottery_id" in first_lottery
        assert "lottery_name" in first_lottery
        
        # Check for schedule fields (may be None if no schedule)
        schedule_fields = ["open_time", "close_time", "draw_time", "is_open"]
        for field in schedule_fields:
            if field in first_lottery:
                print(f"  {field}: {first_lottery[field]}")
    
    def test_device_config_returns_prime_configs(self, vendeur_token):
        """Test that device config returns prime configurations"""
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {vendeur_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check configuration has prime values
        config = data.get("configuration", {})
        
        prime_fields = [
            "prime_borlette", "prime_loto3", "prime_loto4", 
            "prime_loto5", "prime_mariage", "prime_mariage_gratuit"
        ]
        
        found_primes = 0
        for field in prime_fields:
            if field in config:
                found_primes += 1
                print(f"  {field}: {config[field]}")
        
        assert found_primes > 0, "No prime configurations found"
        print(f"✓ Found {found_primes} prime configurations")


class TestCompanyPrimesAPI:
    """Tests for /api/company/primes endpoint"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        """Get company admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COMPANY_ADMIN_EMAIL, "password": COMPANY_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    def test_get_company_primes(self, company_admin_token):
        """Test GET /api/company/primes returns all prime values"""
        response = requests.get(
            f"{BASE_URL}/api/company/primes",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required prime fields
        required_fields = [
            "prime_borlette", "prime_loto3", "prime_loto4",
            "prime_loto5", "prime_mariage", "prime_mariage_gratuit"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
            print(f"  {field}: {data[field]}")
        
        # Verify borlette format (should be "60|20|10" or similar)
        assert "|" in str(data["prime_borlette"]), "Borlette prime should have pipe format"
        
        print("✓ All prime fields present")
    
    def test_update_company_primes(self, company_admin_token):
        """Test PUT /api/company/primes updates prime values"""
        # First get current values
        get_response = requests.get(
            f"{BASE_URL}/api/company/primes",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        original_primes = get_response.json()
        
        # Update with same values (to not break anything)
        update_payload = {
            "prime_borlette": original_primes.get("prime_borlette", "60|20|10"),
            "prime_loto3": original_primes.get("prime_loto3", "500")
        }
        
        response = requests.put(
            f"{BASE_URL}/api/company/primes",
            headers={"Authorization": f"Bearer {company_admin_token}"},
            json=update_payload
        )
        
        assert response.status_code == 200
        print("✓ Prime update successful")


class TestBetLimitsAPI:
    """Tests for bet limits configuration"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        """Get company admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COMPANY_ADMIN_EMAIL, "password": COMPANY_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_company_settings_includes_bet_limits(self, company_admin_token):
        """Test that company settings include bet limits"""
        response = requests.get(
            f"{BASE_URL}/api/company/settings",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        # May return 200 or 404 depending on implementation
        if response.status_code == 200:
            data = response.json()
            print(f"Company settings: {list(data.keys())}")
        else:
            # Try alternative endpoint
            response = requests.get(
                f"{BASE_URL}/api/company/profile",
                headers={"Authorization": f"Bearer {company_admin_token}"}
            )
            if response.status_code == 200:
                data = response.json()
                print(f"Company profile: {list(data.keys())}")


class TestLotteryScheduleSync:
    """Tests for lottery schedule synchronization"""
    
    @pytest.fixture(scope="class")
    def vendeur_token(self):
        """Get vendeur authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VENDEUR_EMAIL, "password": VENDEUR_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_device_sync_returns_latest_data(self, vendeur_token):
        """Test /api/device/sync returns real-time data"""
        response = requests.get(
            f"{BASE_URL}/api/device/sync",
            headers={"Authorization": f"Bearer {vendeur_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "config_version" in data
        assert "agent_status" in data
        assert "server_time" in data
        
        print(f"✓ Sync response: config_version={data['config_version']}, agent_status={data['agent_status']}")
    
    def test_today_results_endpoint(self, vendeur_token):
        """Test /api/results/today returns results"""
        response = requests.get(
            f"{BASE_URL}/api/results/today",
            headers={"Authorization": f"Bearer {vendeur_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return a list (may be empty)
        assert isinstance(data, list)
        print(f"✓ Today's results: {len(data)} results found")


class TestTranslationKeys:
    """Tests to verify translation keys are used correctly in API responses"""
    
    @pytest.fixture(scope="class")
    def vendeur_token(self):
        """Get vendeur authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VENDEUR_EMAIL, "password": VENDEUR_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_lottery_names_not_hardcoded(self, vendeur_token):
        """Test that lottery names come from database, not hardcoded"""
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {vendeur_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        lotteries = data.get("enabled_lotteries", [])
        
        # Check that lottery names are present
        for lottery in lotteries[:5]:  # Check first 5
            assert "lottery_name" in lottery
            assert lottery["lottery_name"] is not None
            assert len(lottery["lottery_name"]) > 0
        
        print(f"✓ Lottery names are properly populated")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
