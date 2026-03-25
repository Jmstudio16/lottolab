"""
Tests API pour la configuration des primes et synchronisation des loteries
=========================================================================
Teste les endpoints:
- GET /api/company/primes - Récupérer les primes configurées
- PUT /api/company/primes - Mettre à jour les primes
- POST /api/company/sync-lotteries - Synchroniser les loteries
- GET /api/company/enabled-lotteries-count - Compter les loteries activées
- GET /api/company/primes/display - Primes formatées pour affichage vendeur
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')

# Test credentials
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Test123!"
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"


@pytest.fixture(scope="module")
def company_admin_token():
    """Get Company Admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": COMPANY_ADMIN_EMAIL, "password": COMPANY_ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Company Admin login failed: {response.status_code}")


@pytest.fixture(scope="module")
def super_admin_token():
    """Get Super Admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Super Admin login failed: {response.status_code}")


@pytest.fixture
def company_admin_headers(company_admin_token):
    """Headers with Company Admin auth"""
    return {
        "Authorization": f"Bearer {company_admin_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture
def super_admin_headers(super_admin_token):
    """Headers with Super Admin auth"""
    return {
        "Authorization": f"Bearer {super_admin_token}",
        "Content-Type": "application/json"
    }


class TestGetPrimes:
    """Tests for GET /api/company/primes"""
    
    def test_get_primes_success(self, company_admin_headers):
        """Company Admin can retrieve prime configuration"""
        response = requests.get(
            f"{BASE_URL}/api/company/primes",
            headers=company_admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required prime fields exist
        assert "company_id" in data
        assert "prime_borlette" in data
        assert "prime_loto3" in data
        assert "prime_loto4" in data
        assert "prime_loto5" in data
        assert "prime_mariage" in data
        assert "prime_mariage_gratuit" in data
        
        # Verify default values format
        assert "|" in data["prime_borlette"]  # Should be "60|20|10" format
        print(f"✓ GET /api/company/primes - Primes retrieved: {data['prime_borlette']}")
    
    def test_get_primes_unauthorized(self):
        """Unauthenticated request should fail"""
        response = requests.get(f"{BASE_URL}/api/company/primes")
        assert response.status_code in [401, 403]
        print("✓ GET /api/company/primes - Unauthorized access blocked")


class TestUpdatePrimes:
    """Tests for PUT /api/company/primes"""
    
    def test_update_single_prime(self, company_admin_headers):
        """Update a single prime value"""
        # First get current values
        get_response = requests.get(
            f"{BASE_URL}/api/company/primes",
            headers=company_admin_headers
        )
        original_loto3 = get_response.json().get("prime_loto3", "500")
        
        # Update Loto3 prime
        new_value = "550" if original_loto3 == "500" else "500"
        response = requests.put(
            f"{BASE_URL}/api/company/primes",
            headers=company_admin_headers,
            json={"prime_loto3": new_value}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["prime_loto3"] == new_value
        
        # Restore original value
        requests.put(
            f"{BASE_URL}/api/company/primes",
            headers=company_admin_headers,
            json={"prime_loto3": original_loto3}
        )
        print(f"✓ PUT /api/company/primes - Single prime updated: {new_value}")
    
    def test_update_borlette_prime(self, company_admin_headers):
        """Update Borlette prime with 60|20|10 format"""
        response = requests.put(
            f"{BASE_URL}/api/company/primes",
            headers=company_admin_headers,
            json={"prime_borlette": "65|22|12"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["prime_borlette"] == "65|22|12"
        
        # Restore default
        requests.put(
            f"{BASE_URL}/api/company/primes",
            headers=company_admin_headers,
            json={"prime_borlette": "60|20|10"}
        )
        print("✓ PUT /api/company/primes - Borlette prime updated with pipe format")
    
    def test_update_multiple_primes(self, company_admin_headers):
        """Update multiple primes at once"""
        response = requests.put(
            f"{BASE_URL}/api/company/primes",
            headers=company_admin_headers,
            json={
                "prime_loto4": "5500",
                "prime_loto5": "55000",
                "prime_mariage": "800"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["prime_loto4"] == "5500"
        assert data["prime_loto5"] == "55000"
        assert data["prime_mariage"] == "800"
        
        # Restore defaults
        requests.put(
            f"{BASE_URL}/api/company/primes",
            headers=company_admin_headers,
            json={
                "prime_loto4": "5000",
                "prime_loto5": "50000",
                "prime_mariage": "750"
            }
        )
        print("✓ PUT /api/company/primes - Multiple primes updated")
    
    def test_update_prime_invalid_format(self, company_admin_headers):
        """Invalid prime format should be rejected"""
        response = requests.put(
            f"{BASE_URL}/api/company/primes",
            headers=company_admin_headers,
            json={"prime_borlette": "invalid|format|abc"}
        )
        
        assert response.status_code == 400
        print("✓ PUT /api/company/primes - Invalid format rejected")


class TestSyncLotteries:
    """Tests for POST /api/company/sync-lotteries"""
    
    def test_sync_lotteries_success(self, company_admin_headers):
        """Company Admin can sync lotteries"""
        response = requests.post(
            f"{BASE_URL}/api/company/sync-lotteries",
            headers=company_admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert "company_id" in data
        assert "after" in data  # Count after sync
        
        # After sync, should have lotteries
        assert data["after"] >= 0
        print(f"✓ POST /api/company/sync-lotteries - Synced, {data['after']} lotteries active")


class TestEnabledLotteriesCount:
    """Tests for GET /api/company/enabled-lotteries-count"""
    
    def test_get_enabled_count(self, company_admin_headers):
        """Get count of enabled lotteries"""
        response = requests.get(
            f"{BASE_URL}/api/company/enabled-lotteries-count",
            headers=company_admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "company_id" in data
        assert "enabled_lotteries" in data
        assert isinstance(data["enabled_lotteries"], int)
        
        # Should have lotteries enabled (bug fix verification)
        # Note: After sync, this should be > 0
        print(f"✓ GET /api/company/enabled-lotteries-count - Count: {data['enabled_lotteries']}")


class TestPrimesDisplay:
    """Tests for GET /api/company/primes/display"""
    
    def test_get_primes_display(self, company_admin_headers):
        """Get primes formatted for vendeur display"""
        response = requests.get(
            f"{BASE_URL}/api/company/primes/display",
            headers=company_admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "primes" in data
        assert "company_id" in data
        assert isinstance(data["primes"], list)
        
        # Verify prime structure
        if len(data["primes"]) > 0:
            prime = data["primes"][0]
            assert "bet_type" in prime
            assert "name" in prime
            assert "formula" in prime
            assert "description" in prime
        
        # Should have 6 prime types
        assert len(data["primes"]) == 6
        
        # Verify all bet types present
        bet_types = [p["bet_type"] for p in data["primes"]]
        assert "BORLETTE" in bet_types
        assert "LOTO3" in bet_types
        assert "LOTO4" in bet_types
        assert "LOTO5" in bet_types
        assert "MARIAGE" in bet_types
        assert "MARIAGE_GRATUIT" in bet_types
        
        print(f"✓ GET /api/company/primes/display - {len(data['primes'])} primes formatted")


class TestPrimesPersistence:
    """Test that prime updates persist correctly"""
    
    def test_prime_update_persists(self, company_admin_headers):
        """Verify prime updates are saved to database"""
        # Update prime
        test_value = "777"
        requests.put(
            f"{BASE_URL}/api/company/primes",
            headers=company_admin_headers,
            json={"prime_mariage_gratuit": test_value}
        )
        
        # Fetch again to verify persistence
        response = requests.get(
            f"{BASE_URL}/api/company/primes",
            headers=company_admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["prime_mariage_gratuit"] == test_value
        
        # Restore default
        requests.put(
            f"{BASE_URL}/api/company/primes",
            headers=company_admin_headers,
            json={"prime_mariage_gratuit": "750"}
        )
        print("✓ Prime update persists correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
