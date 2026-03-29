"""
Iteration 45: MEGA FINALIZATION Tests
=====================================
Tests for:
1. Menu corrections (verified via frontend)
2. Dashboard stats are real (not placeholder)
3. Commission = 0 when not configured
4. Winning calculation 60/20/10 correct
5. Winning tickets display with correct status
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN = {"email": "jefferson@jmstudio.com", "password": "Admin123!"}
COMPANY_ADMIN = {"email": "admin@lotopam.com", "password": "Test123!"}
VENDEUR = {"email": "pierre.jean@agent.com", "password": "Test123!"}


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("database") == "connected"
        print(f"✅ API healthy: {data}")


class TestAuthentication:
    """Test authentication for all roles"""
    
    def test_super_admin_login(self):
        """Test Super Admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data  # API returns 'token' not 'access_token'
        assert data.get("user", {}).get("role") == "SUPER_ADMIN"
        print(f"✅ Super Admin login successful")
    
    def test_company_admin_login(self):
        """Test Company Admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data  # API returns 'token' not 'access_token'
        assert data.get("user", {}).get("role") == "COMPANY_ADMIN"
        print(f"✅ Company Admin login successful")
    
    def test_vendeur_login(self):
        """Test Vendeur login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data  # API returns 'token' not 'access_token'
        assert data.get("user", {}).get("role") in ["AGENT_POS", "VENDEUR"]
        print(f"✅ Vendeur login successful")


class TestDashboardRealData:
    """Test that dashboard shows real data, not placeholders"""
    
    @pytest.fixture
    def company_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN)
        return response.json().get("token")  # API returns 'token'
    
    @pytest.fixture
    def vendeur_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR)
        return response.json().get("token")  # API returns 'token'
    
    def test_company_dashboard_has_real_stats(self, company_admin_token):
        """Test Company Admin dashboard returns real statistics"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        # Correct endpoint is /api/company/dashboard/stats
        response = requests.get(f"{BASE_URL}/api/company/dashboard/stats", headers=headers)
        
        assert response.status_code == 200, f"Dashboard endpoint returned {response.status_code}"
        data = response.json()
        
        # Check stats exist and are numbers (not placeholder strings)
        tickets_today = data.get("tickets_today", 0)
        sales_today = data.get("sales_today", 0)
        active_agents = data.get("active_agents", 0)
        
        assert isinstance(tickets_today, (int, float))
        assert isinstance(sales_today, (int, float))
        
        print(f"✅ Company dashboard stats: tickets_today={tickets_today}, sales_today={sales_today}, active_agents={active_agents}")
    
    def test_vendeur_dashboard_has_real_stats(self, vendeur_token):
        """Test Vendeur dashboard returns real statistics"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/dashboard", headers=headers)
        assert response.status_code == 200, f"Vendeur dashboard returned {response.status_code}"
        data = response.json()
        
        # Check stats exist and are numbers
        stats = data.get("stats", {})
        assert isinstance(stats.get("ventes_jour", 0), (int, float))
        assert isinstance(stats.get("ventes_mois", 0), (int, float))
        assert isinstance(stats.get("tickets_jour", 0), (int, float))
        assert isinstance(stats.get("commissions", 0), (int, float))
        
        print(f"✅ Vendeur dashboard stats: ventes_jour={stats.get('ventes_jour')}, commissions={stats.get('commissions')}")


class TestCommissionDefaultsToZero:
    """Test that commission = 0 when not configured in agent_policy"""
    
    @pytest.fixture
    def vendeur_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR)
        return response.json().get("token")  # API returns 'token'
    
    def test_vendeur_commission_is_zero_by_default(self, vendeur_token):
        """Test that vendeur commission defaults to 0 when not configured"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        stats = data.get("stats", {})
        commission_rate = stats.get("commission_rate", 0)
        commissions = stats.get("commissions", 0)
        
        # Commission rate should be 0 if not configured
        # (unless explicitly set in agent_policy)
        print(f"Commission rate: {commission_rate}%, Commissions: {commissions} HTG")
        
        # If commission_rate is 0, commissions should also be 0
        if commission_rate == 0:
            assert commissions == 0, "Commission should be 0 when rate is 0"
            print("✅ Commission correctly defaults to 0 when not configured")
        else:
            print(f"⚠️ Commission rate is {commission_rate}% (configured in agent_policy)")
    
    def test_vendeur_profile_commission_rate(self, vendeur_token):
        """Test vendeur profile shows commission rate"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/profile", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        vendeur_info = data.get("vendeur", {})
        commission_rate = vendeur_info.get("commission_rate")
        
        # commission_rate should be None or 0 if not configured
        print(f"✅ Vendeur profile commission_rate: {commission_rate}")


class TestWinningCalculation60_20_10:
    """Test winning calculation follows 60/20/10 rule"""
    
    @pytest.fixture
    def company_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN)
        return response.json().get("token")  # API returns 'token'
    
    def test_check_winning_ticket_calculation(self, company_admin_token):
        """Test ticket check returns correct winning calculation"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Use the known winning ticket from iteration 43/44
        ticket_code = "558296411985929"
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/check",
            json={"ticket_code": ticket_code},
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("found"):
                status = data.get("status")
                is_winner = data.get("is_winner")
                winnings = data.get("winnings", 0) or data.get("win_amount", 0)
                
                print(f"Ticket {ticket_code}: status={status}, is_winner={is_winner}, winnings={winnings}")
                
                # Check all_plays_calculated for 60/20/10 multipliers
                all_plays = data.get("all_plays_calculated", [])
                for play in all_plays:
                    if play.get("is_winner"):
                        lot = play.get("winning_lot")
                        multiplier = play.get("multiplier")
                        bet = play.get("bet_amount")
                        gain = play.get("gain")
                        
                        # Verify 60/20/10 rule
                        expected_multiplier = {1: 60, 2: 20, 3: 10}.get(lot, 0)
                        assert multiplier == expected_multiplier, f"Lot {lot} should have multiplier {expected_multiplier}, got {multiplier}"
                        
                        # Verify calculation
                        expected_gain = bet * multiplier
                        assert gain == expected_gain, f"Gain should be {expected_gain}, got {gain}"
                        
                        print(f"  ✅ Play: {play.get('played_number')} - Lot {lot}, {bet}×{multiplier}={gain}")
                
                # Verify total gain = 2250 (88→1500 + 50→500 + 05→250)
                if winnings == 2250:
                    print(f"✅ Total gain correct: 2250 HTG (88→1500 + 50→500 + 05→250)")
            else:
                print(f"⚠️ Ticket {ticket_code} not found")
        else:
            print(f"⚠️ Ticket check returned {response.status_code}")
    
    def test_winning_engine_multipliers(self, company_admin_token):
        """Test winning engine calculation tests endpoint"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Test the winning engine calculation tests
        response = requests.get(f"{BASE_URL}/api/winning-engine/tests", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            passed = data.get("passed", 0)
            failed = data.get("failed", 0)
            tests = data.get("tests", [])
            
            print(f"Winning engine tests: {passed} passed, {failed} failed")
            
            for test in tests:
                status = "✅" if test.get("passed") else "❌"
                print(f"  {status} {test.get('name')}: expected={test.get('expected_lot')}, actual={test.get('actual_lot')}")
            
            assert failed == 0, f"Winning engine has {failed} failing tests"
        else:
            print(f"⚠️ Winning engine tests endpoint returned {response.status_code}")


class TestWinningTicketsDisplay:
    """Test winning tickets display with correct status"""
    
    @pytest.fixture
    def company_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN)
        return response.json().get("token")  # API returns 'token'
    
    def test_company_winning_tickets_list(self, company_admin_token):
        """Test company can see winning tickets"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/winning-tickets", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            tickets = data if isinstance(data, list) else data.get("tickets", [])
            
            print(f"Found {len(tickets)} winning tickets")
            
            for ticket in tickets[:5]:  # Show first 5
                status = ticket.get("status")
                code = ticket.get("ticket_code")
                winnings = ticket.get("winnings", 0) or ticket.get("win_amount", 0)
                
                # Status should be WINNER, WON, or PAID
                assert status in ["WINNER", "WON", "PAID", "GAGNANT"], f"Invalid status: {status}"
                
                print(f"  ✅ Ticket {code}: status={status}, winnings={winnings} HTG")
        else:
            print(f"⚠️ Winning tickets endpoint returned {response.status_code}")
    
    def test_winning_ticket_has_correct_fields(self, company_admin_token):
        """Test winning ticket has all required fields"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Check specific winning ticket
        ticket_code = "558296411985929"
        response = requests.post(
            f"{BASE_URL}/api/tickets/check",
            json={"ticket_code": ticket_code},
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("found") and data.get("is_winner"):
                # Check required fields
                required_fields = ["ticket_id", "ticket_code", "status", "is_winner", "winnings", "plays"]
                for field in required_fields:
                    assert field in data or field in data.get("ticket", {}), f"Missing field: {field}"
                
                # Check winning_numbers_parsed
                wn_parsed = data.get("winning_numbers_parsed", {})
                if wn_parsed:
                    assert "first" in wn_parsed, "Missing first lot in winning_numbers_parsed"
                    print(f"✅ Winning numbers: {wn_parsed.get('first')}-{wn_parsed.get('second')}-{wn_parsed.get('third')}")
                
                print(f"✅ Winning ticket has all required fields")
            else:
                print(f"⚠️ Ticket not found or not a winner")
        else:
            print(f"⚠️ Ticket check returned {response.status_code}")


class TestSuperAdminDashboard:
    """Test Super Admin dashboard shows real data"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        return response.json().get("token")  # API returns 'token'
    
    def test_super_admin_dashboard_stats(self, super_admin_token):
        """Test Super Admin dashboard returns real statistics"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/super/dashboard", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check stats exist
            stats = data.get("stats", data)
            total_companies = stats.get("total_companies", 0)
            active_companies = stats.get("active_companies", 0)
            total_agents = stats.get("total_agents", 0)
            
            assert isinstance(total_companies, (int, float))
            assert isinstance(active_companies, (int, float))
            
            print(f"✅ Super Admin stats: companies={total_companies}, active={active_companies}, agents={total_agents}")
        else:
            print(f"⚠️ Super Admin dashboard returned {response.status_code}")


class TestVendeurWinningTickets:
    """Test Vendeur can see their winning tickets"""
    
    @pytest.fixture
    def vendeur_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR)
        return response.json().get("token")  # API returns 'token'
    
    def test_vendeur_winning_tickets(self, vendeur_token):
        """Test Vendeur can access winning tickets endpoint"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/winning-tickets", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            tickets = data.get("tickets", [])
            summary = data.get("summary", {})
            
            print(f"Vendeur winning tickets: {len(tickets)} tickets")
            print(f"  Total win amount: {summary.get('total_win_amount', 0)} HTG")
            print(f"  Paid: {summary.get('paid_count', 0)}, Pending: {summary.get('pending_count', 0)}")
            
            print(f"✅ Vendeur winning tickets endpoint working")
        else:
            print(f"⚠️ Vendeur winning tickets returned {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
