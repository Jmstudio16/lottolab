"""
Iteration 56 Tests - Settlement History, Lottery Flag Sync, Commission 0%, Settlement Engine Game Types
========================================================================================================
Tests:
1. GET /api/settlement/supervisor-history - Historique règlements superviseur
2. GET /api/supervisor/lottery-flags - Ne doit montrer que les loteries actives globalement
3. GET /api/company/available-lotteries - Ne doit montrer que les loteries actives globalement
4. GET /api/sync/vendeur/open-lotteries - Ne doit montrer que les loteries actives globalement ET au niveau branche
5. Settlement Engine supporte tous les types de jeux (BORLETTE, LOTO3, MARIAGE, L4O1, L4O2, L4O3, L5O1, L5O2)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://seller-commission-ui.preview.emergentagent.com').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "LotoPAM2026!"
SUPERVISOR_EMAIL = "supervisor@lotopam.com"
SUPERVISOR_PASSWORD = "super123"
VENDOR_EMAIL = "vendeur@lotopam.com"
VENDOR_PASSWORD = "vendor123"


class TestSuperAdminAuth:
    """Super Admin authentication"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json(); return data.get("access_token") or data.get("token")
        pytest.skip(f"Super Admin auth failed: {response.status_code}")
    
    def test_super_admin_login(self, super_admin_token):
        """Test Super Admin can login"""
        assert super_admin_token is not None
        print(f"✓ Super Admin authenticated successfully")


class TestCompanyAdminAuth:
    """Company Admin authentication"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json(); return data.get("access_token") or data.get("token")
        pytest.skip(f"Company Admin auth failed: {response.status_code}")
    
    def test_company_admin_login(self, company_admin_token):
        """Test Company Admin can login"""
        assert company_admin_token is not None
        print(f"✓ Company Admin authenticated successfully")


class TestSupervisorAuth:
    """Supervisor authentication"""
    
    @pytest.fixture(scope="class")
    def supervisor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERVISOR_EMAIL,
            "password": SUPERVISOR_PASSWORD
        })
        if response.status_code == 200:
            data = response.json(); return data.get("access_token") or data.get("token")
        pytest.skip(f"Supervisor auth failed: {response.status_code}")
    
    def test_supervisor_login(self, supervisor_token):
        """Test Supervisor can login"""
        assert supervisor_token is not None
        print(f"✓ Supervisor authenticated successfully")


class TestVendorAuth:
    """Vendor authentication"""
    
    @pytest.fixture(scope="class")
    def vendor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD
        })
        if response.status_code == 200:
            data = response.json(); return data.get("access_token") or data.get("token")
        pytest.skip(f"Vendor auth failed: {response.status_code}")
    
    def test_vendor_login(self, vendor_token):
        """Test Vendor can login"""
        assert vendor_token is not None
        print(f"✓ Vendor authenticated successfully")


class TestSupervisorSettlementHistory:
    """Test GET /api/settlement/supervisor-history endpoint"""
    
    @pytest.fixture(scope="class")
    def supervisor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERVISOR_EMAIL,
            "password": SUPERVISOR_PASSWORD
        })
        if response.status_code == 200:
            data = response.json(); return data.get("access_token") or data.get("token")
        pytest.skip(f"Supervisor auth failed: {response.status_code}")
    
    def test_supervisor_settlement_history_endpoint_exists(self, supervisor_token):
        """Test that supervisor-history endpoint exists and returns 200"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.get(f"{BASE_URL}/api/settlement/supervisor-history", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Supervisor settlement history endpoint returns 200")
    
    def test_supervisor_settlement_history_structure(self, supervisor_token):
        """Test that response has correct structure"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.get(f"{BASE_URL}/api/settlement/supervisor-history", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "settlements" in data, "Response should have 'settlements' field"
        assert "total_settlements" in data, "Response should have 'total_settlements' field"
        assert "total_paid" in data, "Response should have 'total_paid' field"
        assert "total_winners" in data, "Response should have 'total_winners' field"
        
        # Verify settlements is a list
        assert isinstance(data["settlements"], list), "settlements should be a list"
        
        print(f"✓ Supervisor settlement history has correct structure")
        print(f"  - Total settlements: {data['total_settlements']}")
        print(f"  - Total paid: {data['total_paid']} HTG")
        print(f"  - Total winners: {data['total_winners']}")
    
    def test_supervisor_settlement_history_settlement_fields(self, supervisor_token):
        """Test that each settlement has required fields"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.get(f"{BASE_URL}/api/settlement/supervisor-history", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        if data["settlements"]:
            settlement = data["settlements"][0]
            expected_fields = [
                "settlement_id", "lottery_name", "draw_date", "draw_name",
                "winning_numbers", "status", "created_at"
            ]
            for field in expected_fields:
                assert field in settlement, f"Settlement should have '{field}' field"
            
            print(f"✓ Settlement has all required fields")
            print(f"  - Sample: {settlement.get('lottery_name')} - {settlement.get('draw_date')}")
        else:
            print(f"✓ No settlements found (empty list is valid)")


class TestSupervisorLotteryFlags:
    """Test GET /api/supervisor/lottery-flags - Only active global lotteries"""
    
    @pytest.fixture(scope="class")
    def supervisor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERVISOR_EMAIL,
            "password": SUPERVISOR_PASSWORD
        })
        if response.status_code == 200:
            data = response.json(); return data.get("access_token") or data.get("token")
        pytest.skip(f"Supervisor auth failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json(); return data.get("access_token") or data.get("token")
        pytest.skip(f"Super Admin auth failed: {response.status_code}")
    
    def test_supervisor_lottery_flags_endpoint(self, supervisor_token):
        """Test that lottery-flags endpoint returns 200"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.get(f"{BASE_URL}/api/supervisor/lottery-flags", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Supervisor lottery-flags endpoint returns 200")
    
    def test_supervisor_lottery_flags_returns_list(self, supervisor_token):
        """Test that response is a list of lotteries"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.get(f"{BASE_URL}/api/supervisor/lottery-flags", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Supervisor lottery-flags returns list with {len(data)} lotteries")
    
    def test_supervisor_lottery_flags_only_active_global(self, supervisor_token, super_admin_token):
        """Test that only globally active lotteries are returned"""
        # Get all master lotteries from super admin
        super_headers = {"Authorization": f"Bearer {super_admin_token}"}
        master_response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=super_headers)
        
        if master_response.status_code != 200:
            pytest.skip("Cannot get master lotteries")
        
        master_lotteries = master_response.json()
        if isinstance(master_lotteries, dict):
            master_lotteries = master_lotteries.get("lotteries", [])
        
        # Get inactive global lotteries
        inactive_global_ids = set()
        for lottery in master_lotteries:
            if not lottery.get("is_active_global", True):
                inactive_global_ids.add(lottery.get("lottery_id"))
        
        # Get supervisor lottery flags
        sup_headers = {"Authorization": f"Bearer {supervisor_token}"}
        sup_response = requests.get(f"{BASE_URL}/api/supervisor/lottery-flags", headers=sup_headers)
        
        assert sup_response.status_code == 200
        sup_lotteries = sup_response.json()
        
        # Check that no inactive global lotteries are in supervisor list
        sup_lottery_ids = {l.get("lottery_id") for l in sup_lotteries}
        
        overlap = inactive_global_ids.intersection(sup_lottery_ids)
        assert len(overlap) == 0, f"Supervisor should not see globally inactive lotteries: {overlap}"
        
        print(f"✓ Supervisor lottery-flags correctly filters out globally inactive lotteries")
        print(f"  - Inactive global lotteries: {len(inactive_global_ids)}")
        print(f"  - Supervisor sees: {len(sup_lotteries)} lotteries")


class TestCompanyAvailableLotteries:
    """Test GET /api/company/lottery-catalog - Only active global lotteries"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json(); return data.get("access_token") or data.get("token")
        pytest.skip(f"Company Admin auth failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json(); return data.get("access_token") or data.get("token")
        pytest.skip(f"Super Admin auth failed: {response.status_code}")
    
    def test_company_lottery_catalog_endpoint(self, company_admin_token):
        """Test that lottery-catalog endpoint returns 200"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/lottery-catalog", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Company lottery-catalog endpoint returns 200")
    
    def test_company_lottery_catalog_only_active_global(self, company_admin_token, super_admin_token):
        """Test that only globally active lotteries are returned"""
        # Get all master lotteries from super admin
        super_headers = {"Authorization": f"Bearer {super_admin_token}"}
        master_response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=super_headers)
        
        if master_response.status_code != 200:
            pytest.skip("Cannot get master lotteries")
        
        master_lotteries = master_response.json()
        if isinstance(master_lotteries, dict):
            master_lotteries = master_lotteries.get("lotteries", [])
        
        # Get inactive global lotteries
        inactive_global_ids = set()
        for lottery in master_lotteries:
            if not lottery.get("is_active_global", True):
                inactive_global_ids.add(lottery.get("lottery_id"))
        
        # Get company lottery catalog
        company_headers = {"Authorization": f"Bearer {company_admin_token}"}
        company_response = requests.get(f"{BASE_URL}/api/company/lottery-catalog", headers=company_headers)
        
        assert company_response.status_code == 200
        company_lotteries = company_response.json()
        
        if isinstance(company_lotteries, dict):
            company_lotteries = company_lotteries.get("lotteries", company_lotteries)
        
        # Check that no inactive global lotteries are in company list
        company_lottery_ids = set()
        for l in company_lotteries:
            if isinstance(l, dict):
                company_lottery_ids.add(l.get("lottery_id"))
        
        overlap = inactive_global_ids.intersection(company_lottery_ids)
        assert len(overlap) == 0, f"Company should not see globally inactive lotteries: {overlap}"
        
        print(f"✓ Company lottery-catalog correctly filters out globally inactive lotteries")
        print(f"  - Inactive global lotteries: {len(inactive_global_ids)}")
        print(f"  - Company sees: {len(company_lotteries)} lotteries")


class TestVendorOpenLotteries:
    """Test GET /api/sync/vendeur/open-lotteries - Only active global AND branch-enabled"""
    
    @pytest.fixture(scope="class")
    def vendor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD
        })
        if response.status_code == 200:
            data = response.json(); return data.get("access_token") or data.get("token")
        pytest.skip(f"Vendor auth failed: {response.status_code}")
    
    def test_vendor_open_lotteries_endpoint(self, vendor_token):
        """Test that vendeur/open-lotteries endpoint returns 200"""
        headers = {"Authorization": f"Bearer {vendor_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/vendeur/open-lotteries", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Vendor open-lotteries endpoint returns 200")
    
    def test_vendor_open_lotteries_structure(self, vendor_token):
        """Test that response has correct structure"""
        headers = {"Authorization": f"Bearer {vendor_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/vendeur/open-lotteries", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "lotteries" in data, "Response should have 'lotteries' field"
        assert "open_count" in data, "Response should have 'open_count' field"
        
        print(f"✓ Vendor open-lotteries has correct structure")
        print(f"  - Open lotteries: {data['open_count']}")
    
    def test_vendor_open_lotteries_only_open(self, vendor_token):
        """Test that only OPEN lotteries are returned"""
        headers = {"Authorization": f"Bearer {vendor_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/vendeur/open-lotteries", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        lotteries = data.get("lotteries", [])
        
        # All returned lotteries should be open
        for lottery in lotteries:
            assert lottery.get("is_open", False), f"Lottery {lottery.get('lottery_name')} should be open"
        
        print(f"✓ All {len(lotteries)} returned lotteries are OPEN")


class TestSettlementEngineGameTypes:
    """Test Settlement Engine supports all game types"""
    
    def test_borlette_matcher_exists(self):
        """Test BORLETTE matcher is registered"""
        from settlement_engine import GAME_MATCHERS
        assert "BORLETTE" in GAME_MATCHERS, "BORLETTE matcher should exist"
        print(f"✓ BORLETTE matcher registered")
    
    def test_loto3_matcher_exists(self):
        """Test LOTO3 matcher is registered"""
        from settlement_engine import GAME_MATCHERS
        assert "LOTO3" in GAME_MATCHERS, "LOTO3 matcher should exist"
        print(f"✓ LOTO3 matcher registered")
    
    def test_mariage_matcher_exists(self):
        """Test MARIAGE matcher is registered"""
        from settlement_engine import GAME_MATCHERS
        assert "MARIAGE" in GAME_MATCHERS, "MARIAGE matcher should exist"
        print(f"✓ MARIAGE matcher registered")
    
    def test_loto4_options_matchers_exist(self):
        """Test LOTO4 option matchers are registered (L4O1, L4O2, L4O3)"""
        from settlement_engine import GAME_MATCHERS
        assert "L4O1" in GAME_MATCHERS, "L4O1 matcher should exist"
        assert "L4O2" in GAME_MATCHERS, "L4O2 matcher should exist"
        assert "L4O3" in GAME_MATCHERS, "L4O3 matcher should exist"
        print(f"✓ LOTO4 option matchers registered (L4O1, L4O2, L4O3)")
    
    def test_loto5_options_matchers_exist(self):
        """Test LOTO5 option matchers are registered (L5O1, L5O2)"""
        from settlement_engine import GAME_MATCHERS
        assert "L5O1" in GAME_MATCHERS, "L5O1 matcher should exist"
        assert "L5O2" in GAME_MATCHERS, "L5O2 matcher should exist"
        print(f"✓ LOTO5 option matchers registered (L5O1, L5O2)")
    
    def test_default_prize_configs_exist(self):
        """Test DEFAULT_PRIZE_CONFIGS has all game types"""
        from settlement_engine import DEFAULT_PRIZE_CONFIGS
        
        required_types = ["BORLETTE", "LOTO3", "LOTO4", "LOTO5", "MARIAGE", "L4O1", "L4O2", "L4O3", "L5O1", "L5O2"]
        
        for game_type in required_types:
            assert game_type in DEFAULT_PRIZE_CONFIGS, f"{game_type} should have default prize config"
        
        print(f"✓ All game types have default prize configs")
        for game_type in required_types:
            config = DEFAULT_PRIZE_CONFIGS[game_type]
            print(f"  - {game_type}: multipliers={config.get('multipliers')}")


class TestBorletteMatcher:
    """Test BORLETTE matching logic"""
    
    def test_borlette_first_prize_match(self):
        """Test BORLETTE matches first prize (borlette)"""
        from settlement_engine import BorletteMatcher
        
        winning = {"first": "123", "second": "45", "third": "67"}
        result = BorletteMatcher.match("23", winning, "BORLETTE")
        
        assert result["is_winner"] == True
        assert result["prize_rank"] == 1
        assert result["winning_lot"] == 1
        print(f"✓ BORLETTE correctly matches first prize (borlette)")
    
    def test_borlette_second_prize_match(self):
        """Test BORLETTE matches second prize"""
        from settlement_engine import BorletteMatcher
        
        winning = {"first": "123", "second": "45", "third": "67"}
        result = BorletteMatcher.match("45", winning, "BORLETTE")
        
        assert result["is_winner"] == True
        assert result["prize_rank"] == 2
        assert result["winning_lot"] == 2
        print(f"✓ BORLETTE correctly matches second prize")
    
    def test_borlette_third_prize_match(self):
        """Test BORLETTE matches third prize"""
        from settlement_engine import BorletteMatcher
        
        winning = {"first": "123", "second": "45", "third": "67"}
        result = BorletteMatcher.match("67", winning, "BORLETTE")
        
        assert result["is_winner"] == True
        assert result["prize_rank"] == 3
        assert result["winning_lot"] == 3
        print(f"✓ BORLETTE correctly matches third prize")
    
    def test_borlette_no_match(self):
        """Test BORLETTE no match"""
        from settlement_engine import BorletteMatcher
        
        winning = {"first": "123", "second": "45", "third": "67"}
        result = BorletteMatcher.match("99", winning, "BORLETTE")
        
        assert result["is_winner"] == False
        assert result["prize_rank"] == 0
        print(f"✓ BORLETTE correctly returns no match")


class TestLoto3Matcher:
    """Test LOTO3 matching logic"""
    
    def test_loto3_exact_match(self):
        """Test LOTO3 exact 3-digit match"""
        from settlement_engine import Loto3Matcher
        
        winning = {"first": "123", "second": "45", "third": "67"}
        result = Loto3Matcher.match("123", winning, "LOTO3")
        
        assert result["is_winner"] == True
        assert result["prize_rank"] == 1
        print(f"✓ LOTO3 correctly matches exact 3 digits")
    
    def test_loto3_no_match(self):
        """Test LOTO3 no match"""
        from settlement_engine import Loto3Matcher
        
        winning = {"first": "123", "second": "45", "third": "67"}
        result = Loto3Matcher.match("456", winning, "LOTO3")
        
        assert result["is_winner"] == False
        print(f"✓ LOTO3 correctly returns no match")


class TestMariageMatcher:
    """Test MARIAGE matching logic"""
    
    def test_mariage_both_numbers_match(self):
        """Test MARIAGE both numbers in winning set"""
        from settlement_engine import MariageMatcher
        
        winning = {"first": "123", "second": "45", "third": "67"}
        # Borlette is 23, second is 45, third is 67
        result = MariageMatcher.match("23-45", winning, "MARIAGE")
        
        assert result["is_winner"] == True
        assert result["prize_rank"] == 1
        print(f"✓ MARIAGE correctly matches both numbers")
    
    def test_mariage_one_number_no_match(self):
        """Test MARIAGE only one number matches"""
        from settlement_engine import MariageMatcher
        
        winning = {"first": "123", "second": "45", "third": "67"}
        result = MariageMatcher.match("23-99", winning, "MARIAGE")
        
        assert result["is_winner"] == False
        print(f"✓ MARIAGE correctly returns no match when only one number matches")


class TestLoto4Matcher:
    """Test LOTO4 matching logic"""
    
    def test_loto4_exact_match(self):
        """Test LOTO4 exact 4-digit match"""
        from settlement_engine import Loto4Matcher
        
        winning = {"first": "1234", "second": "56", "third": "78"}
        result = Loto4Matcher.match("1234", winning, "LOTO4")
        
        assert result["is_winner"] == True
        assert result["prize_rank"] == 1
        print(f"✓ LOTO4 correctly matches exact 4 digits")
    
    def test_loto4_o1_match(self):
        """Test L4O1 option match"""
        from settlement_engine import Loto4Matcher
        
        winning = {"first": "12", "second": "34", "third": "56"}
        # L4O1 = first[:2] + second[:2] = "1234"
        result = Loto4Matcher.match("1234", winning, "L4O1")
        
        assert result["is_winner"] == True
        print(f"✓ L4O1 correctly matches")


class TestLoto5Matcher:
    """Test LOTO5 matching logic"""
    
    def test_loto5_exact_match(self):
        """Test LOTO5 exact 5-digit match"""
        from settlement_engine import Loto5Matcher
        
        winning = {"first": "12345", "second": "67", "third": "89"}
        result = Loto5Matcher.match("12345", winning, "LOTO5")
        
        assert result["is_winner"] == True
        assert result["prize_rank"] == 1
        print(f"✓ LOTO5 correctly matches exact 5 digits")


class TestCommissionZeroPercent:
    """Test that 0% commission is properly handled"""
    
    @pytest.fixture(scope="class")
    def supervisor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERVISOR_EMAIL,
            "password": SUPERVISOR_PASSWORD
        })
        if response.status_code == 200:
            data = response.json(); return data.get("access_token") or data.get("token")
        pytest.skip(f"Supervisor auth failed: {response.status_code}")
    
    def test_supervisor_profile_commission(self, supervisor_token):
        """Test supervisor profile returns commission (can be 0)"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.get(f"{BASE_URL}/api/supervisor/my-profile", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Commission should be a number (can be 0)
        assert "commission_percent" in data, "Profile should have commission_percent"
        assert isinstance(data["commission_percent"], (int, float)), "commission_percent should be a number"
        
        print(f"✓ Supervisor profile returns commission_percent: {data['commission_percent']}%")
    
    def test_supervisor_agents_commission(self, supervisor_token):
        """Test supervisor agents have commission (can be 0)"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.get(f"{BASE_URL}/api/supervisor/agents", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        agents = response.json()
        
        if agents:
            for agent in agents:
                assert "commission_percent" in agent, f"Agent {agent.get('user_id')} should have commission_percent"
                assert isinstance(agent["commission_percent"], (int, float)), "commission_percent should be a number"
            
            print(f"✓ All {len(agents)} agents have commission_percent field")
            for agent in agents[:3]:  # Show first 3
                print(f"  - {agent.get('name', 'N/A')}: {agent.get('commission_percent', 0)}%")
        else:
            print(f"✓ No agents found (empty list is valid)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
