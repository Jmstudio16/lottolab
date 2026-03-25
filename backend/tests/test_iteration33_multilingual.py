"""
Test suite for Iteration 33 - Multilingual System and Ticket Print
Tests:
1. Language switcher visibility and functionality
2. Menu translations (FR, HT, EN, ES)
3. Ticket print includes succursale name
4. Only open lotteries visible on new sale page
"""
import pytest
import requests
import os

BASE_URL = "http://localhost:8001"

# Test credentials
VENDEUR_CREDS = {"email": "vendeur@lotopam.com", "password": "Vendeur123!"}

class TestVendeurAuthentication:
    """Test vendeur login"""
    
    def test_vendeur_login(self):
        """Test vendeur can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR_CREDS)
        assert response.status_code == 200, f"Vendeur login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        print(f"✓ Vendeur login successful, role: {data.get('user', {}).get('role')}")
        return data["token"]


class TestVendeurProfile:
    """Test vendeur profile returns succursale info"""
    
    @pytest.fixture
    def vendeur_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR_CREDS)
        if response.status_code != 200:
            pytest.skip("Vendeur login failed")
        return response.json()["token"]
    
    def test_vendeur_profile_returns_succursale(self, vendeur_token):
        """Verify /api/vendeur/profile returns succursale name"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/profile", headers=headers)
        
        assert response.status_code == 200, f"Profile request failed: {response.text}"
        data = response.json()
        
        # Check succursale exists
        assert "succursale" in data, "No 'succursale' in profile response"
        succursale = data["succursale"]
        
        # Check succursale has name
        assert "name" in succursale or "nom_succursale" in succursale, "No name in succursale"
        succursale_name = succursale.get("name") or succursale.get("nom_succursale")
        assert succursale_name, "Succursale name is empty"
        
        print(f"✓ Vendeur profile returns succursale: {succursale_name}")


class TestTicketPrint:
    """Test ticket print includes succursale name"""
    
    @pytest.fixture
    def vendeur_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR_CREDS)
        if response.status_code != 200:
            pytest.skip("Vendeur login failed")
        return response.json()["token"]
    
    def test_ticket_print_includes_succursale(self, vendeur_token):
        """Verify /api/ticket/print/{id} includes succursale name in HTML"""
        # Use the test ticket ID provided
        ticket_id = "tkt_1774408423431na86nx"
        
        response = requests.get(
            f"{BASE_URL}/api/ticket/print/{ticket_id}?token={vendeur_token}"
        )
        
        assert response.status_code == 200, f"Ticket print failed: {response.text}"
        html_content = response.text
        
        # Check that SUCCURSALE label is present
        assert "SUCCURSALE" in html_content, "SUCCURSALE label not found in ticket HTML"
        
        # Check that a succursale name is present (not N/A)
        assert "Succursale" in html_content or "Pétion" in html_content, \
            "Succursale name not found in ticket HTML"
        
        print("✓ Ticket print includes SUCCURSALE label and name")


class TestDeviceConfigLotteries:
    """Test device config returns lotteries with is_open field"""
    
    @pytest.fixture
    def vendeur_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR_CREDS)
        if response.status_code != 200:
            pytest.skip("Vendeur login failed")
        return response.json()["token"]
    
    def test_device_config_returns_lotteries(self, vendeur_token):
        """Verify /api/device/config returns enabled_lotteries"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/device/config", headers=headers)
        
        assert response.status_code == 200, f"Device config failed: {response.text}"
        data = response.json()
        
        assert "enabled_lotteries" in data, "No 'enabled_lotteries' in response"
        lotteries = data["enabled_lotteries"]
        assert len(lotteries) > 0, "No lotteries returned"
        
        print(f"✓ Device config returns {len(lotteries)} lotteries")
    
    def test_lotteries_have_is_open_field(self, vendeur_token):
        """Verify each lottery has is_open field"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/device/config", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        lotteries = data.get("enabled_lotteries", [])
        
        # Check first 5 lotteries have is_open field
        for lottery in lotteries[:5]:
            assert "is_open" in lottery, f"Lottery {lottery.get('lottery_name')} missing is_open field"
        
        print("✓ Lotteries have is_open field")
    
    def test_lotteries_have_time_fields(self, vendeur_token):
        """Verify lotteries have open_time, close_time, draw_time fields"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/device/config", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        lotteries = data.get("enabled_lotteries", [])
        
        # Check first 5 lotteries have time fields
        for lottery in lotteries[:5]:
            # These fields should exist (may be null for 24h lotteries)
            assert "open_time" in lottery or "close_time" in lottery, \
                f"Lottery {lottery.get('lottery_name')} missing time fields"
        
        print("✓ Lotteries have time fields for open/close status calculation")


class TestTranslationFiles:
    """Test that translation files exist and have required keys"""
    
    def test_translation_files_exist(self):
        """Verify all 4 translation files exist"""
        import os
        
        base_path = "/app/frontend/src/i18n/locales"
        languages = ["fr.json", "en.json", "es.json", "ht.json"]
        
        for lang_file in languages:
            file_path = os.path.join(base_path, lang_file)
            assert os.path.exists(file_path), f"Translation file {lang_file} not found"
        
        print("✓ All 4 translation files exist (fr, en, es, ht)")
    
    def test_translation_files_have_vendeur_keys(self):
        """Verify translation files have vendeur menu keys"""
        import json
        import os
        
        base_path = "/app/frontend/src/i18n/locales"
        required_keys = [
            "vendeur.dashboard",
            "vendeur.newSale",
            "vendeur.myTickets",
            "vendeur.salesToday",
            "vendeur.notifications",
            "vendeur.latestResults",
            "vendeur.recentActivity",
            "nav.dashboard",
            "nav.results"
        ]
        
        for lang in ["fr", "ht", "en", "es"]:
            file_path = os.path.join(base_path, f"{lang}.json")
            with open(file_path, "r", encoding="utf-8") as f:
                translations = json.load(f)
            
            for key in required_keys:
                parts = key.split(".")
                value = translations
                for part in parts:
                    assert part in value, f"Key '{key}' not found in {lang}.json"
                    value = value[part]
                assert value, f"Key '{key}' is empty in {lang}.json"
        
        print("✓ All translation files have required vendeur keys")
    
    def test_translations_are_different(self):
        """Verify translations are actually different between languages"""
        import json
        import os
        
        base_path = "/app/frontend/src/i18n/locales"
        
        with open(os.path.join(base_path, "fr.json"), "r", encoding="utf-8") as f:
            fr = json.load(f)
        with open(os.path.join(base_path, "ht.json"), "r", encoding="utf-8") as f:
            ht = json.load(f)
        with open(os.path.join(base_path, "en.json"), "r", encoding="utf-8") as f:
            en = json.load(f)
        
        # Check that key translations are different
        assert fr["vendeur"]["salesToday"] != ht["vendeur"]["salesToday"], \
            "FR and HT salesToday should be different"
        assert fr["vendeur"]["salesToday"] != en["vendeur"]["salesToday"], \
            "FR and EN salesToday should be different"
        
        # FR: "Ventes Jour", HT: "Vant Jodi a", EN: "Sales Today"
        print(f"✓ FR: {fr['vendeur']['salesToday']}")
        print(f"✓ HT: {ht['vendeur']['salesToday']}")
        print(f"✓ EN: {en['vendeur']['salesToday']}")
        print("✓ Translations are different between languages")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
