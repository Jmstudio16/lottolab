"""
LOTTOLAB Iteration 47 Tests
===========================
Testing: WebSocket, Analytics Pro, PWA features

Features tested:
1. WebSocket - Connection, stats endpoint
2. Analytics Pro - All 4 dashboards (Sales, Gains, Performance, Real-time)
3. PWA - manifest.json, service-worker.js
4. Menu access - Analytics Pro for Super Admin and Company Admin
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "Super@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin@2026!"
VENDEUR_EMAIL = "pierre.jean@agent.com"
VENDEUR_PASSWORD = "Agent@2026!"


@pytest.fixture(scope="module")
def super_admin_token():
    """Get Super Admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Super Admin authentication failed")


@pytest.fixture(scope="module")
def company_admin_token():
    """Get Company Admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": COMPANY_ADMIN_EMAIL,
        "password": COMPANY_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Company Admin authentication failed")


@pytest.fixture(scope="module")
def vendeur_token():
    """Get Vendeur authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": VENDEUR_EMAIL,
        "password": VENDEUR_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Vendeur authentication failed")


class TestHealthCheck:
    """Basic health check"""
    
    def test_health_endpoint(self):
        """Test health endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✓ Health check passed: {data['status']}")


class TestAuthentication:
    """Authentication tests for all roles"""
    
    def test_super_admin_login(self):
        """Test Super Admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "SUPER_ADMIN"
        print(f"✓ Super Admin login successful")
    
    def test_company_admin_login(self):
        """Test Company Admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "COMPANY_ADMIN"
        print(f"✓ Company Admin login successful")
    
    def test_vendeur_login(self):
        """Test Vendeur can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDEUR_EMAIL,
            "password": VENDEUR_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "AGENT_POS"
        print(f"✓ Vendeur login successful")


class TestAnalyticsSalesDashboard:
    """Analytics Pro - Sales Dashboard tests"""
    
    def test_sales_summary_super_admin(self, super_admin_token):
        """Test sales summary endpoint for Super Admin"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/sales/summary?period=month", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert "current" in data
        assert "total_sales" in data["current"]
        assert "total_tickets" in data["current"]
        assert "net_revenue" in data["current"]
        print(f"✓ Sales summary: {data['current']['total_sales']} HTG, {data['current']['total_tickets']} tickets")
    
    def test_sales_summary_company_admin(self, company_admin_token):
        """Test sales summary endpoint for Company Admin"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/sales/summary?period=month", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "current" in data
        print(f"✓ Company Admin sales summary: {data['current']['total_sales']} HTG")
    
    def test_sales_trend(self, super_admin_token):
        """Test sales trend endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/sales/trend?period=month", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"✓ Sales trend: {len(data['data'])} data points")
    
    def test_top_agents(self, super_admin_token):
        """Test top agents endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/sales/top-agents?period=month&limit=10", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert isinstance(data["agents"], list)
        if data["agents"]:
            agent = data["agents"][0]
            assert "rank" in agent
            assert "agent_name" in agent
            assert "total_sales" in agent
        print(f"✓ Top agents: {len(data['agents'])} agents")
    
    def test_top_lotteries(self, super_admin_token):
        """Test top lotteries endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/sales/top-lotteries?period=month&limit=10", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "lotteries" in data
        assert isinstance(data["lotteries"], list)
        if data["lotteries"]:
            lottery = data["lotteries"][0]
            assert "lottery_name" in lottery
            assert "total_sales" in lottery
        print(f"✓ Top lotteries: {len(data['lotteries'])} lotteries")


class TestAnalyticsGainsDashboard:
    """Analytics Pro - Gains Dashboard tests"""
    
    def test_most_played_numbers(self, super_admin_token):
        """Test most played numbers endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/gains/most-played-numbers?limit=15", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "numbers" in data
        assert isinstance(data["numbers"], list)
        if data["numbers"]:
            num = data["numbers"][0]
            assert "number" in num
            assert "times_played" in num
            assert "total_wagered" in num
        print(f"✓ Most played numbers: {len(data['numbers'])} numbers")
    
    def test_most_winning_numbers(self, super_admin_token):
        """Test most winning numbers endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/gains/most-winning-numbers?limit=15", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "numbers" in data
        assert isinstance(data["numbers"], list)
        print(f"✓ Most winning numbers: {len(data['numbers'])} numbers")
    
    def test_gains_by_game_type(self, super_admin_token):
        """Test gains by game type endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/gains/by-game-type?period=month", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "game_types" in data
        assert isinstance(data["game_types"], list)
        if data["game_types"]:
            gt = data["game_types"][0]
            assert "bet_type" in gt
            assert "total_wagered" in gt
            assert "win_rate" in gt
        print(f"✓ Game types: {len(data['game_types'])} types")


class TestAnalyticsPerformanceDashboard:
    """Analytics Pro - Performance Dashboard tests"""
    
    def test_performance_summary(self, super_admin_token):
        """Test performance summary endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/performance/summary?period=month", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        summary = data["summary"]
        assert "total_sales" in summary
        assert "active_agents" in summary
        assert "profit_margin" in summary
        print(f"✓ Performance summary: {summary['active_agents']} active agents, {summary['profit_margin']:.1f}% margin")
    
    def test_agents_ranking(self, super_admin_token):
        """Test agents ranking endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/performance/agents-ranking?period=month&limit=20", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert isinstance(data["agents"], list)
        if data["agents"]:
            agent = data["agents"][0]
            assert "rank" in agent
            assert "agent_name" in agent
            assert "total_sales" in agent
            assert "win_rate" in agent
            assert "profit_margin" in agent
        print(f"✓ Agents ranking: {len(data['agents'])} agents")


class TestWebSocketEndpoints:
    """WebSocket related tests"""
    
    def test_websocket_stats_endpoint(self, super_admin_token):
        """Test WebSocket stats endpoint"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/ws/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_connections" in data
        assert "companies_connected" in data
        print(f"✓ WebSocket stats: {data['total_connections']} connections")


class TestPWA:
    """PWA (Progressive Web App) tests"""
    
    def test_manifest_json_accessible(self):
        """Test manifest.json is accessible"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "short_name" in data
        assert "icons" in data
        assert "start_url" in data
        assert "display" in data
        assert data["name"] == "LOTTOLAB - Lottery Management"
        assert data["short_name"] == "LOTTOLAB"
        print(f"✓ manifest.json valid: {data['name']}")
    
    def test_manifest_has_required_icons(self):
        """Test manifest has required PWA icons"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        data = response.json()
        icons = data.get("icons", [])
        assert len(icons) >= 2, "PWA requires at least 2 icons"
        
        # Check for 192x192 and 512x512 icons
        sizes = [icon.get("sizes") for icon in icons]
        assert "192x192" in sizes, "Missing 192x192 icon"
        assert "512x512" in sizes, "Missing 512x512 icon"
        print(f"✓ PWA icons: {len(icons)} icons configured")
    
    def test_manifest_has_shortcuts(self):
        """Test manifest has app shortcuts"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        data = response.json()
        shortcuts = data.get("shortcuts", [])
        assert len(shortcuts) >= 1, "PWA should have shortcuts"
        print(f"✓ PWA shortcuts: {len(shortcuts)} shortcuts")
    
    def test_service_worker_accessible(self):
        """Test service-worker.js is accessible"""
        response = requests.get(f"{BASE_URL}/service-worker.js")
        assert response.status_code == 200
        content = response.text
        assert "CACHE_NAME" in content or "lottolab" in content.lower()
        assert "install" in content
        assert "fetch" in content
        print(f"✓ service-worker.js accessible ({len(content)} bytes)")


class TestAnalyticsAccessControl:
    """Test Analytics Pro access control for different roles"""
    
    def test_vendeur_cannot_access_analytics(self, vendeur_token):
        """Test Vendeur cannot access analytics endpoints"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/sales/summary?period=month", headers=headers)
        # Vendeur should get 403 Forbidden
        assert response.status_code == 403
        print(f"✓ Vendeur correctly denied access to analytics")
    
    def test_company_admin_can_access_analytics(self, company_admin_token):
        """Test Company Admin can access analytics"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/sales/summary?period=month", headers=headers)
        assert response.status_code == 200
        print(f"✓ Company Admin can access analytics")
    
    def test_super_admin_can_access_analytics(self, super_admin_token):
        """Test Super Admin can access analytics"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/sales/summary?period=month", headers=headers)
        assert response.status_code == 200
        print(f"✓ Super Admin can access analytics")


class TestAnalyticsPeriodFilters:
    """Test Analytics period filters work correctly"""
    
    def test_day_period(self, super_admin_token):
        """Test day period filter"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/sales/summary?period=day", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "day"
        print(f"✓ Day period filter works")
    
    def test_week_period(self, super_admin_token):
        """Test week period filter"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/sales/summary?period=week", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "week"
        print(f"✓ Week period filter works")
    
    def test_month_period(self, super_admin_token):
        """Test month period filter"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/sales/summary?period=month", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "month"
        print(f"✓ Month period filter works")
    
    def test_year_period(self, super_admin_token):
        """Test year period filter"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/sales/summary?period=year", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "year"
        print(f"✓ Year period filter works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
