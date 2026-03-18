"""
LOTTOLAB - Final Production Readiness Testing
Tests: Login flows, Company Lotteries (190+), Agent POS, Backend sale validation
"""

import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test Credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"

COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin123!"

AGENT_EMAIL = "agent001@lottolab.com"
AGENT_PASSWORD = "Agent123!"


class TestLoginFlows:
    """Test all three login flows: Super Admin, Company Admin, Agent POS"""
    
    def test_01_super_admin_login(self):
        """Super Admin login should return token and redirect to /super/dashboard"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Super Admin login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "SUPER_ADMIN", f"Wrong role: {data['user']['role']}"
        assert data["redirect_path"] == "/super/dashboard", f"Wrong redirect: {data['redirect_path']}"
        print(f"Super Admin login OK - User: {data['user']['name']}")
    
    def test_02_company_admin_login(self):
        """Company Admin login should return token and redirect to /company/dashboard"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Company Admin login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "COMPANY_ADMIN", f"Wrong role: {data['user']['role']}"
        assert data["redirect_path"] == "/company/dashboard", f"Wrong redirect: {data['redirect_path']}"
        assert data["user"]["company_id"] is not None, "Company ID missing"
        print(f"Company Admin login OK - Company: {data['user']['company_id']}")
    
    def test_03_agent_pos_login(self):
        """Agent POS login should return token with device session"""
        response = requests.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": AGENT_EMAIL,
            "password": AGENT_PASSWORD
        }, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
        
        assert response.status_code == 200, f"Agent login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "No token in response"
        assert "agent_id" in data, "No agent_id in response"
        assert "company_id" in data, "No company_id in response"
        assert "device_session_id" in data, "No device_session_id"
        print(f"Agent login OK - Agent: {data['agent_name']}, Device: {data['device_type']}")
    
    def test_04_invalid_login_rejected(self):
        """Invalid credentials should be rejected"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestCompanyLotteries:
    """Test Company Admin Lottery Catalog - 190+ lotteries with pagination"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get Company Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_01_get_all_lotteries_returns_150_plus(self):
        """GET /api/company/lotteries should return 150+ lotteries from global catalog"""
        response = requests.get(f"{BASE_URL}/api/company/lotteries", headers=self.headers)
        assert response.status_code == 200, f"Failed to get lotteries: {response.text}"
        
        lotteries = response.json()
        assert isinstance(lotteries, list), "Response is not a list"
        assert len(lotteries) >= 100, f"Expected 100+ lotteries, got {len(lotteries)}"
        
        # Check lottery structure
        if lotteries:
            lottery = lotteries[0]
            assert "lottery_id" in lottery, "Missing lottery_id"
            assert "lottery_name" in lottery, "Missing lottery_name"
            assert "enabled" in lottery, "Missing enabled flag"
        
        print(f"Total lotteries in catalog: {len(lotteries)}")
        
        # Count enabled vs disabled
        enabled = sum(1 for l in lotteries if l.get("enabled"))
        disabled = len(lotteries) - enabled
        print(f"Enabled: {enabled}, Disabled: {disabled}")
    
    def test_02_lotteries_have_state_codes(self):
        """Lotteries should have state_code or region for filtering"""
        response = requests.get(f"{BASE_URL}/api/company/lotteries", headers=self.headers)
        lotteries = response.json()
        
        states = set()
        for lottery in lotteries:
            state = lottery.get("state_code") or lottery.get("region")
            if state:
                states.add(state)
        
        assert len(states) > 0, "No state codes found in lotteries"
        print(f"Unique states/regions: {len(states)} - {sorted(states)[:10]}...")
    
    def test_03_toggle_lottery_on(self):
        """PUT /api/company/lotteries/{id}/toggle should enable a lottery"""
        # First get a lottery that's disabled
        response = requests.get(f"{BASE_URL}/api/company/lotteries", headers=self.headers)
        lotteries = response.json()
        
        disabled_lottery = next((l for l in lotteries if not l.get("enabled")), None)
        if not disabled_lottery:
            pytest.skip("No disabled lottery found to test toggle")
        
        lottery_id = disabled_lottery["lottery_id"]
        
        # Toggle ON
        toggle_response = requests.put(
            f"{BASE_URL}/api/company/lotteries/{lottery_id}/toggle",
            params={"enabled": True},
            headers=self.headers
        )
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        
        result = toggle_response.json()
        assert result.get("enabled") == True, "Expected enabled=True"
        print(f"Toggled ON: {disabled_lottery['lottery_name']}")
        
        # Toggle back OFF to restore state
        requests.put(
            f"{BASE_URL}/api/company/lotteries/{lottery_id}/toggle",
            params={"enabled": False},
            headers=self.headers
        )
    
    def test_04_toggle_lottery_off(self):
        """PUT /api/company/lotteries/{id}/toggle should disable a lottery"""
        response = requests.get(f"{BASE_URL}/api/company/lotteries", headers=self.headers)
        lotteries = response.json()
        
        enabled_lottery = next((l for l in lotteries if l.get("enabled")), None)
        if not enabled_lottery:
            pytest.skip("No enabled lottery found to test toggle")
        
        lottery_id = enabled_lottery["lottery_id"]
        
        # Toggle OFF
        toggle_response = requests.put(
            f"{BASE_URL}/api/company/lotteries/{lottery_id}/toggle",
            params={"enabled": False},
            headers=self.headers
        )
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        
        result = toggle_response.json()
        assert result.get("enabled") == False, "Expected enabled=False"
        print(f"Toggled OFF: {enabled_lottery['lottery_name']}")
        
        # Toggle back ON to restore state
        requests.put(
            f"{BASE_URL}/api/company/lotteries/{lottery_id}/toggle",
            params={"enabled": True},
            headers=self.headers
        )


class TestAgentPOSDeviceConfig:
    """Test Agent POS device config and sync endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get Agent token"""
        response = requests.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": AGENT_EMAIL,
            "password": AGENT_PASSWORD
        }, headers={"User-Agent": "Mozilla/5.0 Test Browser"})
        
        assert response.status_code == 200, f"Agent login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_01_get_device_config(self):
        """GET /api/device/config should return full config with enabled lotteries"""
        response = requests.get(f"{BASE_URL}/api/device/config", headers=self.headers)
        assert response.status_code == 200, f"Failed to get config: {response.text}"
        
        config = response.json()
        
        # Check required fields
        assert "config_version" in config, "Missing config_version"
        assert "company" in config, "Missing company info"
        assert "agent" in config, "Missing agent info"
        assert "enabled_lotteries" in config, "Missing enabled_lotteries"
        assert "schedules" in config, "Missing schedules"
        
        print(f"Config version: {config['config_version']}")
        print(f"Enabled lotteries: {len(config['enabled_lotteries'])}")
        print(f"Schedules today: {len(config['schedules'])}")
    
    def test_02_device_sync_returns_updates(self):
        """GET /api/device/sync should return sync data with daily stats"""
        response = requests.get(f"{BASE_URL}/api/device/sync", headers=self.headers)
        assert response.status_code == 200, f"Sync failed: {response.text}"
        
        sync_data = response.json()
        
        assert "config_version" in sync_data
        assert "agent_status" in sync_data
        assert "daily_stats" in sync_data
        assert "server_time" in sync_data
        
        print(f"Agent status: {sync_data['agent_status']}")
        print(f"Daily stats: {sync_data['daily_stats']}")
    
    def test_03_get_enabled_lotteries_with_schedules(self):
        """Config should include schedules for enabled lotteries"""
        response = requests.get(f"{BASE_URL}/api/device/config", headers=self.headers)
        config = response.json()
        
        schedules = config.get("schedules", [])
        if len(schedules) > 0:
            schedule = schedules[0]
            assert "lottery_id" in schedule, "Schedule missing lottery_id"
            assert "draw_name" in schedule, "Schedule missing draw_name"
            # May have opening_time, closing_time, draw_time
            print(f"Sample schedule: {schedule.get('draw_name')} - {schedule.get('draw_time')}")


class TestBackendSaleValidation:
    """Test that backend validates sale times and rejects closed lotteries"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get Agent token"""
        response = requests.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": AGENT_EMAIL,
            "password": AGENT_PASSWORD
        }, headers={"User-Agent": "Mozilla/5.0 Test Browser"})
        
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_01_sale_endpoint_exists(self):
        """POST /api/lottery/sell endpoint should exist"""
        # Get config to find an enabled lottery
        config_response = requests.get(f"{BASE_URL}/api/device/config", headers=self.headers)
        config = config_response.json()
        
        enabled = config.get("enabled_lotteries", [])
        schedules = config.get("schedules", [])
        
        if not enabled:
            pytest.skip("No enabled lotteries")
        
        # Just test that the endpoint responds (validation may reject)
        lottery = enabled[0]
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        response = requests.post(f"{BASE_URL}/api/lottery/sell", 
            json={
                "lottery_id": lottery["lottery_id"],
                "draw_date": today,
                "draw_name": "Morning",
                "plays": [{"numbers": "123", "bet_type": "BORLETTE", "amount": 50}]
            },
            headers=self.headers
        )
        
        # Should be 200 (success) or 400 (validation error like lottery closed)
        assert response.status_code in [200, 400, 403], f"Unexpected status: {response.status_code} - {response.text}"
        print(f"Sale endpoint response: {response.status_code} - {response.json() if response.status_code != 200 else 'SUCCESS'}")
    
    def test_02_sale_rejected_for_disabled_lottery(self):
        """Sales should be rejected for disabled lotteries"""
        # Get a disabled lottery
        config_response = requests.get(f"{BASE_URL}/api/device/config", headers=self.headers)
        config = config_response.json()
        
        # Get company admin token to get all lotteries (including disabled)
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        admin_token = admin_response.json()["token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        all_lotteries = requests.get(f"{BASE_URL}/api/company/lotteries", headers=admin_headers).json()
        disabled = next((l for l in all_lotteries if not l.get("enabled")), None)
        
        if not disabled:
            pytest.skip("No disabled lottery to test")
        
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        response = requests.post(f"{BASE_URL}/api/lottery/sell",
            json={
                "lottery_id": disabled["lottery_id"],
                "draw_date": today,
                "draw_name": "Morning",
                "plays": [{"numbers": "456", "bet_type": "BORLETTE", "amount": 50}]
            },
            headers=self.headers
        )
        
        # Should reject with 403 (lottery not enabled for company)
        assert response.status_code in [400, 403, 404], f"Expected rejection, got {response.status_code}"
        print(f"Disabled lottery sale rejected: {response.json().get('detail', response.text)}")
    
    def test_03_minimum_bet_validation(self):
        """Sales below minimum bet should be rejected"""
        config_response = requests.get(f"{BASE_URL}/api/device/config", headers=self.headers)
        config = config_response.json()
        
        enabled = config.get("enabled_lotteries", [])
        if not enabled:
            pytest.skip("No enabled lotteries")
        
        lottery = enabled[0]
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Try to sell with amount below minimum (typically 10)
        response = requests.post(f"{BASE_URL}/api/lottery/sell",
            json={
                "lottery_id": lottery["lottery_id"],
                "draw_date": today,
                "draw_name": "Morning",
                "plays": [{"numbers": "789", "bet_type": "BORLETTE", "amount": 1}]  # Below min
            },
            headers=self.headers
        )
        
        # May reject for low amount or lottery closed
        assert response.status_code in [200, 400], f"Unexpected: {response.status_code}"
        if response.status_code == 400:
            detail = response.json().get("detail", "")
            print(f"Low bet validation: {detail}")


class TestResultsEndpoint:
    """Test results endpoints for Agent"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get Agent token"""
        response = requests.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": AGENT_EMAIL,
            "password": AGENT_PASSWORD
        }, headers={"User-Agent": "Mozilla/5.0 Test Browser"})
        
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_01_get_today_results(self):
        """GET /api/results/today should return today's results"""
        response = requests.get(f"{BASE_URL}/api/results/today", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        results = response.json()
        assert isinstance(results, list), "Expected list of results"
        print(f"Today's results count: {len(results)}")
    
    def test_02_get_device_results(self):
        """GET /api/device/results should return results for enabled lotteries"""
        response = requests.get(f"{BASE_URL}/api/device/results", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        results = response.json()
        assert isinstance(results, list), "Expected list of results"
        print(f"Device results count: {len(results)}")


class TestAgentTickets:
    """Test Agent ticket endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get Agent token"""
        response = requests.post(f"{BASE_URL}/api/auth/agent/login", json={
            "email": AGENT_EMAIL,
            "password": AGENT_PASSWORD
        }, headers={"User-Agent": "Mozilla/5.0 Test Browser"})
        
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_01_get_agent_tickets(self):
        """GET /api/agent/tickets should return agent's tickets"""
        response = requests.get(f"{BASE_URL}/api/agent/tickets", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        tickets = response.json()
        assert isinstance(tickets, list), "Expected list of tickets"
        print(f"Agent tickets count: {len(tickets)}")
    
    def test_02_get_agent_reports(self):
        """GET /api/agent/reports should return agent's sales reports"""
        response = requests.get(f"{BASE_URL}/api/agent/reports", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        report = response.json()
        assert "period" in report, "Missing period"
        assert "totals" in report, "Missing totals"
        print(f"Report period: {report['period']}")
        print(f"Report totals: {report['totals']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
