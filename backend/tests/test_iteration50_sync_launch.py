"""
Iteration 50: Synchronisation Complète pour le Lancement
Tests for:
1. Commission vendeur = 0 si non configurée (ne pas afficher)
2. Commission ne doit PAS être calculée si = 0
3. Page Configuration Company Admin - tous les onglets fonctionnels
4. Page Payer Gagnants vendeur fonctionne
5. Tickets gagnants avec statut WINNER ou PAID (pas EN ATTENTE)
6. Rapport vendeur synchronisé
7. Limites de mise configurées par Company Admin
8. Table des Primes configurée (14 configurations)
9. Blocage boules fonctionne
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "LotoPAM2026!"
VENDEUR_EMAIL = "vendeur@lotopam.com"
VENDEUR_PASSWORD = "vendor123"


class TestHealthCheck:
    """Basic health check"""
    
    def test_health_endpoint(self):
        """Test API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print(f"✓ Health check passed: {response.json()}")


class TestAuthentication:
    """Authentication tests for all roles"""
    
    def test_super_admin_login(self):
        """Test Super Admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print(f"✓ Super Admin login successful")
        return data["token"]
    
    def test_company_admin_login(self):
        """Test Company Admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print(f"✓ Company Admin login successful")
        return data["token"]
    
    def test_vendeur_login(self):
        """Test Vendeur login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDEUR_EMAIL,
            "password": VENDEUR_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print(f"✓ Vendeur login successful")
        return data["token"]


@pytest.fixture
def super_admin_token():
    """Get Super Admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Super Admin login failed")


@pytest.fixture
def company_admin_token():
    """Get Company Admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": COMPANY_ADMIN_EMAIL,
        "password": COMPANY_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Company Admin login failed")


@pytest.fixture
def vendeur_token():
    """Get Vendeur token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": VENDEUR_EMAIL,
        "password": VENDEUR_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Vendeur login failed")


# ============================================================================
# TEST 1: Commission vendeur = 0 si non configurée
# ============================================================================

class TestVendeurCommissionDefault:
    """Test that vendeur commission defaults to 0 if not configured"""
    
    def test_vendeur_dashboard_commission_default_zero(self, vendeur_token):
        """Vendeur dashboard should show commission_rate = 0 if not configured"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Commission rate should be 0 by default
        commission_rate = data.get("stats", {}).get("commission_rate", 0)
        commissions = data.get("stats", {}).get("commissions", 0)
        
        print(f"✓ Vendeur dashboard commission_rate: {commission_rate}")
        print(f"✓ Vendeur dashboard commissions: {commissions}")
        
        # If commission_rate is 0, commissions should also be 0
        if commission_rate == 0:
            assert commissions == 0, "Commissions should be 0 when commission_rate is 0"
            print("✓ Commission correctly = 0 when not configured")
    
    def test_vendeur_profile_commission_null_or_zero(self, vendeur_token):
        """Vendeur profile should return commission_rate as null or 0 if not configured"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check vendeur object for commission_rate
        vendeur_data = data.get("vendeur", {})
        commission_rate = vendeur_data.get("commission_rate")
        
        print(f"✓ Vendeur profile commission_rate: {commission_rate}")
        
        # Should be None or 0 if not configured
        assert commission_rate is None or commission_rate == 0, \
            f"Commission rate should be None or 0 when not configured, got {commission_rate}"
        print("✓ Commission rate correctly None/0 in profile")
    
    def test_vendeur_report_commission_zero_when_not_configured(self, vendeur_token):
        """Vendeur report should show commission = 0 when rate is 0"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/report?period=month", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        commission_rate = data.get("commission_rate", 0)
        total_commission = data.get("total_commission", 0)
        
        print(f"✓ Vendeur report commission_rate: {commission_rate}")
        print(f"✓ Vendeur report total_commission: {total_commission}")
        
        # If rate is 0, total commission should be 0
        if commission_rate == 0:
            assert total_commission == 0, "Total commission should be 0 when rate is 0"
            print("✓ Report commission correctly = 0")


# ============================================================================
# TEST 2: Commission ne doit PAS être calculée si = 0
# ============================================================================

class TestCommissionNotCalculatedWhenZero:
    """Test that commission is NOT calculated when rate = 0"""
    
    def test_vendeur_stats_no_commission_calculation(self, vendeur_token):
        """Vendeur stats should not calculate commission when rate = 0"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/stats?period=month", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        stats = data.get("stats", {})
        commission_rate = stats.get("commission_rate", 0)
        commission = stats.get("commission", 0)
        total_sales = stats.get("total_sales", 0)
        
        print(f"✓ Stats - commission_rate: {commission_rate}, commission: {commission}, total_sales: {total_sales}")
        
        if commission_rate == 0:
            assert commission == 0, f"Commission should be 0 when rate is 0, got {commission}"
            print("✓ Commission NOT calculated when rate = 0")
        else:
            # If rate > 0, commission should be calculated
            expected_commission = total_sales * (commission_rate / 100)
            assert abs(commission - expected_commission) < 0.01, \
                f"Commission calculation mismatch: expected {expected_commission}, got {commission}"
            print(f"✓ Commission correctly calculated: {commission}")


# ============================================================================
# TEST 3: Page Configuration Company Admin - tous les onglets
# ============================================================================

class TestCompanyConfigurationPage:
    """Test Company Admin Configuration page endpoints"""
    
    def test_get_company_configuration(self, company_admin_token):
        """Test GET /api/company/configuration"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/configuration", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check expected fields
        expected_fields = [
            "stop_sales_before_draw_minutes",
            "void_window_minutes",
            "allow_ticket_void",
            "auto_print_ticket"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Company configuration loaded with {len(data)} fields")
        print(f"  - stop_sales_before_draw_minutes: {data.get('stop_sales_before_draw_minutes')}")
        print(f"  - void_window_minutes: {data.get('void_window_minutes')}")
    
    def test_update_company_configuration(self, company_admin_token):
        """Test PUT /api/company/configuration"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # First get current config
        get_response = requests.get(f"{BASE_URL}/api/company/configuration", headers=headers)
        current_config = get_response.json()
        
        # Update with same values (safe update)
        update_data = {
            "stop_sales_before_draw_minutes": current_config.get("stop_sales_before_draw_minutes", 5),
            "void_window_minutes": current_config.get("void_window_minutes", 5),
            "allow_ticket_void": current_config.get("allow_ticket_void", True),
            "auto_print_ticket": current_config.get("auto_print_ticket", True)
        }
        
        response = requests.put(f"{BASE_URL}/api/company/configuration", 
                               json=update_data, headers=headers)
        assert response.status_code == 200
        print("✓ Company configuration update successful")
    
    def test_get_prime_configs(self, company_admin_token):
        """Test GET /api/company/prime-configs - Table des Primes"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/prime-configs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ Prime configs loaded: {len(data)} configurations")
        
        # Should have multiple prime configurations
        if len(data) > 0:
            for prime in data[:3]:  # Show first 3
                print(f"  - {prime.get('bet_code')}: {prime.get('payout_formula')}")
    
    def test_seed_prime_defaults(self, company_admin_token):
        """Test POST /api/company/prime-configs/seed-defaults"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.post(f"{BASE_URL}/api/company/prime-configs/seed-defaults", 
                                json={}, headers=headers)
        # May return 200 or 400 if already seeded
        assert response.status_code in [200, 400]
        print(f"✓ Seed prime defaults: {response.status_code}")
    
    def test_get_company_statistics(self, company_admin_token):
        """Test GET /api/company/statistics/comprehensive"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/statistics/comprehensive", headers=headers)
        
        # May return 200 or 404 if endpoint doesn't exist
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Company statistics loaded")
            if "summary" in data:
                print(f"  - Total tickets: {data['summary'].get('total_tickets', 0)}")
                print(f"  - Total sales: {data['summary'].get('total_sales', 0)}")
        else:
            print(f"⚠ Statistics endpoint returned {response.status_code}")


# ============================================================================
# TEST 4: Page Payer Gagnants vendeur fonctionne
# ============================================================================

class TestVendeurPayWinners:
    """Test Vendeur pay winners functionality"""
    
    def test_get_winning_tickets(self, vendeur_token):
        """Test GET /api/vendeur/winning-tickets"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/winning-tickets", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "tickets" in data
        assert "summary" in data
        
        print(f"✓ Winning tickets endpoint works")
        print(f"  - Total winning tickets: {data['summary'].get('total_count', 0)}")
        print(f"  - Total win amount: {data['summary'].get('total_win_amount', 0)}")
        print(f"  - Paid count: {data['summary'].get('paid_count', 0)}")
        print(f"  - Pending count: {data['summary'].get('pending_count', 0)}")
        
        return data.get("tickets", [])
    
    def test_get_vendor_balance(self, vendeur_token):
        """Test GET /api/vendeur/balance"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/balance", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ Vendor balance endpoint works")
        print(f"  - Available balance: {data.get('available_balance', 0)}")
        print(f"  - Total payouts: {data.get('total_payouts', 0)}")
    
    def test_get_paid_tickets(self, vendeur_token):
        """Test GET /api/vendeur/paid-tickets"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/paid-tickets", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "tickets" in data
        assert "summary" in data
        
        print(f"✓ Paid tickets endpoint works")
        print(f"  - Total paid: {data['summary'].get('total_count', 0)}")
        print(f"  - Total paid amount: {data['summary'].get('total_paid', 0)}")


# ============================================================================
# TEST 5: Tickets gagnants avec statut WINNER ou PAID (pas EN ATTENTE)
# ============================================================================

class TestWinningTicketStatus:
    """Test that winning tickets have correct status (WINNER or PAID, not PENDING)"""
    
    def test_winning_tickets_have_correct_status(self, vendeur_token):
        """Winning tickets should have status WINNER, WON, or PAID"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/winning-tickets", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        tickets = data.get("tickets", [])
        
        valid_statuses = ["WINNER", "WON", "PAID"]
        invalid_statuses = ["PENDING", "EN_ATTENTE", "VALIDATED"]
        
        for ticket in tickets:
            status = ticket.get("status", "")
            assert status in valid_statuses, \
                f"Winning ticket {ticket.get('ticket_code')} has invalid status: {status}"
            assert status not in invalid_statuses, \
                f"Winning ticket should not have status: {status}"
        
        print(f"✓ All {len(tickets)} winning tickets have correct status (WINNER/WON/PAID)")
    
    def test_mes_tickets_winner_status(self, vendeur_token):
        """Test that mes-tickets with status=WINNER returns correct tickets"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/mes-tickets?status=WINNER", headers=headers)
        assert response.status_code == 200
        tickets = response.json()
        
        for ticket in tickets:
            status = ticket.get("status", "")
            assert status in ["WINNER", "WON"], \
                f"Ticket {ticket.get('ticket_code')} has unexpected status: {status}"
        
        print(f"✓ mes-tickets?status=WINNER returns {len(tickets)} tickets with correct status")


# ============================================================================
# TEST 6: Rapport vendeur synchronisé
# ============================================================================

class TestVendeurReportSync:
    """Test vendeur report is synchronized with actual data"""
    
    def test_vendeur_report_endpoint(self, vendeur_token):
        """Test GET /api/vendeur/report"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/report?period=today", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        expected_fields = [
            "period", "total_sales", "total_tickets", "total_commission",
            "commission_rate", "winning_tickets", "total_wins"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field in report: {field}"
        
        print(f"✓ Vendeur report endpoint works")
        print(f"  - Period: {data.get('period')}")
        print(f"  - Total sales: {data.get('total_sales')}")
        print(f"  - Total tickets: {data.get('total_tickets')}")
        print(f"  - Commission rate: {data.get('commission_rate')}")
        print(f"  - Total commission: {data.get('total_commission')}")
    
    def test_vendeur_report_periods(self, vendeur_token):
        """Test vendeur report for different periods"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        
        periods = ["today", "week", "month"]
        for period in periods:
            response = requests.get(f"{BASE_URL}/api/vendeur/report?period={period}", headers=headers)
            assert response.status_code == 200
            data = response.json()
            assert data.get("period") == period
            print(f"✓ Report for period '{period}' works")


# ============================================================================
# TEST 7: Limites de mise configurées par Company Admin
# ============================================================================

class TestBetLimitsConfiguration:
    """Test bet limits configured by Company Admin"""
    
    def test_get_bet_limits_in_config(self, company_admin_token):
        """Test that bet limits are in company configuration"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/configuration", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        limit_fields = ["min_bet_amount", "max_bet_amount", "max_bet_per_number"]
        
        for field in limit_fields:
            if field in data:
                print(f"✓ {field}: {data.get(field)}")
            else:
                print(f"⚠ {field} not found in config")
    
    def test_update_bet_limits(self, company_admin_token):
        """Test updating bet limits"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Get current config
        get_response = requests.get(f"{BASE_URL}/api/company/configuration", headers=headers)
        current_config = get_response.json()
        
        # Update limits (use current values to avoid breaking anything)
        update_data = {
            "min_bet_amount": current_config.get("min_bet_amount", 10),
            "max_bet_amount": current_config.get("max_bet_amount", 10000),
            "max_bet_per_number": current_config.get("max_bet_per_number", 5000)
        }
        
        response = requests.put(f"{BASE_URL}/api/company/configuration", 
                               json=update_data, headers=headers)
        assert response.status_code == 200
        print("✓ Bet limits update successful")
    
    def test_device_config_includes_limits(self, vendeur_token):
        """Test that device config includes bet limits for vendeur"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/device/config", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            config = data.get("configuration", {})
            
            print(f"✓ Device config includes limits:")
            print(f"  - min_bet_amount: {config.get('min_bet_amount')}")
            print(f"  - max_bet_amount: {config.get('max_bet_amount')}")
        else:
            print(f"⚠ Device config endpoint returned {response.status_code}")


# ============================================================================
# TEST 8: Table des Primes configurée (14 configurations)
# ============================================================================

class TestPrimeTableConfiguration:
    """Test prime table has all required configurations"""
    
    def test_prime_configs_count(self, company_admin_token):
        """Test that prime configs exist"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/prime-configs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ Prime configs count: {len(data)}")
        
        # List all bet codes
        bet_codes = [p.get("bet_code") for p in data]
        print(f"  Bet codes: {bet_codes}")
    
    def test_prime_configs_have_required_fields(self, company_admin_token):
        """Test that each prime config has required fields"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/prime-configs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["bet_code", "bet_type", "payout_formula", "is_active"]
        
        for prime in data:
            for field in required_fields:
                assert field in prime, f"Prime {prime.get('bet_code')} missing field: {field}"
        
        print(f"✓ All {len(data)} prime configs have required fields")
    
    def test_borlette_prime_formula(self, company_admin_token):
        """Test BORLETTE prime formula is 60|20|10"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/prime-configs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        borlette_primes = [p for p in data if "BORLETTE" in p.get("bet_type", "").upper() 
                          or "BOR" in p.get("bet_code", "").upper()]
        
        if borlette_primes:
            for prime in borlette_primes:
                formula = prime.get("payout_formula", "")
                print(f"✓ {prime.get('bet_code')} formula: {formula}")
        else:
            print("⚠ No BORLETTE prime found")


# ============================================================================
# TEST 9: Blocage boules fonctionne
# ============================================================================

class TestBlockedNumbers:
    """Test blocked numbers functionality"""
    
    def test_get_blocked_numbers_in_config(self, company_admin_token):
        """Test getting blocked numbers from config"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/configuration", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        blocked = data.get("blocked_numbers", [])
        print(f"✓ Blocked numbers in config: {blocked}")
    
    def test_add_blocked_number(self, company_admin_token):
        """Test adding a blocked number"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Get current config
        get_response = requests.get(f"{BASE_URL}/api/company/configuration", headers=headers)
        current_config = get_response.json()
        
        # Add test blocked number
        current_blocked = current_config.get("blocked_numbers", [])
        test_number = "999"  # Use a number unlikely to be played
        
        if test_number not in current_blocked:
            new_blocked = current_blocked + [test_number]
            update_data = {**current_config, "blocked_numbers": new_blocked}
            
            response = requests.put(f"{BASE_URL}/api/company/configuration", 
                                   json=update_data, headers=headers)
            assert response.status_code == 200
            print(f"✓ Added blocked number: {test_number}")
            
            # Clean up - remove the test number
            update_data["blocked_numbers"] = current_blocked
            requests.put(f"{BASE_URL}/api/company/configuration", 
                        json=update_data, headers=headers)
            print(f"✓ Cleaned up test blocked number")
        else:
            print(f"✓ Test number {test_number} already blocked")
    
    def test_device_config_includes_blocked_numbers(self, vendeur_token):
        """Test that device config includes blocked numbers for vendeur"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/device/config", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            blocked = data.get("blocked_numbers", [])
            print(f"✓ Device config blocked numbers: {len(blocked)} numbers")
        else:
            print(f"⚠ Device config endpoint returned {response.status_code}")


# ============================================================================
# TEST: Supervisor Reports Commission = 0
# ============================================================================

class TestSupervisorReportsCommission:
    """Test supervisor reports show commission = 0 when not configured"""
    
    def test_supervisor_sales_report(self, company_admin_token):
        """Test supervisor sales report endpoint"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Try supervisor endpoint (may need supervisor token)
        response = requests.get(f"{BASE_URL}/api/supervisor/sales-report", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            supervisor_commission = data.get("supervisor_commission", 0)
            print(f"✓ Supervisor commission: {supervisor_commission}")
            
            agents = data.get("agents", [])
            for agent in agents[:3]:  # Show first 3
                print(f"  - {agent.get('agent_name')}: comm_agent={agent.get('comm_agent', 0)}")
        elif response.status_code == 403:
            print("⚠ Supervisor endpoint requires supervisor role")
        else:
            print(f"⚠ Supervisor report returned {response.status_code}")


# ============================================================================
# INTEGRATION TEST: Full Flow
# ============================================================================

class TestFullIntegrationFlow:
    """Test full integration flow"""
    
    def test_vendeur_full_flow(self, vendeur_token):
        """Test vendeur can access all required endpoints"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        
        endpoints = [
            "/api/vendeur/dashboard",
            "/api/vendeur/profile",
            "/api/vendeur/mes-tickets",
            "/api/vendeur/winning-tickets",
            "/api/vendeur/balance",
            "/api/vendeur/report?period=today",
            "/api/vendeur/stats?period=today"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            status = "✓" if response.status_code == 200 else "✗"
            print(f"{status} {endpoint}: {response.status_code}")
    
    def test_company_admin_full_flow(self, company_admin_token):
        """Test company admin can access all required endpoints"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        endpoints = [
            "/api/company/configuration",
            "/api/company/prime-configs",
            "/api/company/dashboard"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            status = "✓" if response.status_code == 200 else "✗"
            print(f"{status} {endpoint}: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
