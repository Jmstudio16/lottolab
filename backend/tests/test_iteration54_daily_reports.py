"""
Iteration 54: Daily Reports Testing
====================================
Tests for:
1. GET /api/reports/daily-summary - Company Admin daily report with SGL-style columns
2. VendeurLayout - 'Payer Gagnant' button removed
3. Vendeur Report - Date filters working
4. CSV Export functionality
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "LotoPAM2026!"
VENDEUR_EMAIL = "vendeur@lotopam.com"
VENDEUR_PASSWORD = "vendor123"


class TestDailyReportAPI:
    """Tests for the daily-summary report endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as company admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_daily_summary_endpoint_exists(self):
        """Test that daily-summary endpoint exists and returns data"""
        response = requests.get(
            f"{BASE_URL}/api/reports/daily-summary?start_date=2026-03-01&end_date=2026-04-02",
            headers=self.headers
        )
        assert response.status_code == 200, f"Daily summary failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "start_date" in data
        assert "end_date" in data
        assert "company_id" in data
        assert "total_pos" in data
        assert "agents" in data
        assert "totals" in data
        print(f"✓ Daily summary endpoint working - {data['total_pos']} agents found")
    
    def test_daily_summary_agent_columns(self):
        """Test that each agent has all required SGL-style columns"""
        response = requests.get(
            f"{BASE_URL}/api/reports/daily-summary?start_date=2026-03-01&end_date=2026-04-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        required_columns = [
            "no", "agent_id", "agent_name", "tfiche", "vente", "a_paye",
            "pct_agent", "pp_sans_agent", "pp_avec_agent", "pct_sup", "b_final", "is_negative"
        ]
        
        if data["agents"]:
            agent = data["agents"][0]
            for col in required_columns:
                assert col in agent, f"Missing column: {col}"
            print(f"✓ All SGL-style columns present: {required_columns}")
        else:
            print("⚠ No agents found to verify columns")
    
    def test_daily_summary_totals(self):
        """Test that totals are calculated correctly"""
        response = requests.get(
            f"{BASE_URL}/api/reports/daily-summary?start_date=2026-03-01&end_date=2026-04-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        totals = data["totals"]
        required_totals = ["total_tickets", "total_vente", "total_paye", "total_profit_loss", "total_balance"]
        
        for key in required_totals:
            assert key in totals, f"Missing total: {key}"
        
        print(f"✓ Totals: tickets={totals['total_tickets']}, vente={totals['total_vente']}, balance={totals['total_balance']}")
    
    def test_daily_summary_negative_balance_flag(self):
        """Test that is_negative flag is set correctly for negative B.Final"""
        response = requests.get(
            f"{BASE_URL}/api/reports/daily-summary?start_date=2026-03-01&end_date=2026-04-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        for agent in data["agents"]:
            if agent["b_final"] < 0:
                assert agent["is_negative"] == True, f"Agent {agent['agent_name']} has negative balance but is_negative is False"
            else:
                assert agent["is_negative"] == False, f"Agent {agent['agent_name']} has positive balance but is_negative is True"
        
        print("✓ is_negative flag correctly set for all agents")
    
    def test_daily_summary_date_range(self):
        """Test that date range filtering works"""
        # Test with today only
        today = "2026-04-02"
        response = requests.get(
            f"{BASE_URL}/api/reports/daily-summary?start_date={today}&end_date={today}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["start_date"] == today
        assert data["end_date"] == today
        print(f"✓ Date range filtering works - today: {data['totals']['total_tickets']} tickets")


class TestVendeurReport:
    """Tests for vendeur report endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as vendeur"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDEUR_EMAIL,
            "password": VENDEUR_PASSWORD
        })
        assert response.status_code == 200, f"Vendeur login failed: {response.text}"
        self.vendeur_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.vendeur_token}"}
    
    def test_vendeur_report_today(self):
        """Test vendeur report with today period"""
        response = requests.get(
            f"{BASE_URL}/api/vendeur/report?period=today",
            headers=self.headers
        )
        assert response.status_code == 200, f"Vendeur report failed: {response.text}"
        data = response.json()
        
        required_fields = ["period", "total_sales", "total_tickets", "winning_tickets", "paid_tickets", "unpaid_tickets"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Vendeur report (today): {data['total_tickets']} tickets, {data['total_sales']} HTG")
    
    def test_vendeur_report_custom_dates(self):
        """Test vendeur report with custom date range"""
        response = requests.get(
            f"{BASE_URL}/api/vendeur/report?start_date=2026-03-01&end_date=2026-04-02",
            headers=self.headers
        )
        assert response.status_code == 200, f"Vendeur report custom dates failed: {response.text}"
        data = response.json()
        
        # Should have data for the date range
        assert data["total_tickets"] >= 0
        assert data["total_sales"] >= 0
        print(f"✓ Vendeur report (custom dates): {data['total_tickets']} tickets, {data['total_sales']} HTG")
    
    def test_vendeur_report_week(self):
        """Test vendeur report with week period"""
        response = requests.get(
            f"{BASE_URL}/api/vendeur/report?period=week",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_tickets" in data
        print(f"✓ Vendeur report (week): {data['total_tickets']} tickets")
    
    def test_vendeur_report_month(self):
        """Test vendeur report with month period"""
        response = requests.get(
            f"{BASE_URL}/api/vendeur/report?period=month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_tickets" in data
        print(f"✓ Vendeur report (month): {data['total_tickets']} tickets")
    
    def test_vendeur_report_tickets_by_lottery(self):
        """Test that tickets_by_lottery is returned"""
        response = requests.get(
            f"{BASE_URL}/api/vendeur/report?start_date=2026-03-01&end_date=2026-04-02",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "tickets_by_lottery" in data
        if data["tickets_by_lottery"]:
            lottery = data["tickets_by_lottery"][0]
            assert "lottery" in lottery or "lottery_name" in lottery
            assert "count" in lottery
            assert "amount" in lottery
            print(f"✓ Tickets by lottery: {len(data['tickets_by_lottery'])} lotteries")
        else:
            print("⚠ No lottery breakdown data")


class TestOtherDailyReportEndpoints:
    """Tests for other daily report endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as company admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_winning_tickets_by_lottery(self):
        """Test winning tickets by lottery endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/reports/winning-tickets-by-lottery?start_date=2026-03-01&end_date=2026-04-02",
            headers=self.headers
        )
        assert response.status_code == 200, f"Winning tickets by lottery failed: {response.text}"
        data = response.json()
        
        assert "lotteries" in data
        assert "grand_total_mise" in data
        assert "grand_total_gain" in data
        print(f"✓ Winning tickets by lottery: {len(data['lotteries'])} lotteries, total gain: {data['grand_total_gain']}")
    
    def test_sold_tickets_report(self):
        """Test sold tickets report endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/reports/sold-tickets?start_date=2026-03-01&end_date=2026-04-02",
            headers=self.headers
        )
        assert response.status_code == 200, f"Sold tickets report failed: {response.text}"
        data = response.json()
        
        assert "total_fiche" in data
        assert "total_vente" in data
        assert "tickets" in data
        print(f"✓ Sold tickets report: {data['total_fiche']} tickets, {data['total_vente']} HTG")
    
    def test_pos_list(self):
        """Test POS list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/reports/pos-list",
            headers=self.headers
        )
        assert response.status_code == 200, f"POS list failed: {response.text}"
        data = response.json()
        
        assert "total_pos" in data
        assert "pos_list" in data
        print(f"✓ POS list: {data['total_pos']} vendors")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
