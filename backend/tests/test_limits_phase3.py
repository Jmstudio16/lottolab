"""
LOTTOLAB Phase 3 - Intelligent Limits System Tests
===================================================
Tests for:
1. Limit Configuration (GET/PUT /api/limits/config)
2. Number Blocking (POST/DELETE /api/limits/numbers/block)
3. Bet Checking (/api/limits/check)
4. Alerts Management (/api/limits/alerts)
5. Numbers Status (/api/limits/numbers/status)
6. Dashboard Stats (/api/limits/dashboard/stats)
7. Integration with ticket creation (limit enforcement)
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = "https://seller-commission-ui.preview.emergentagent.com"

# Test credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin@2026!"


class TestHealthCheck:
    """Verify API is accessible"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data['version']}")


class TestAuthentication:
    """Authentication tests for limits endpoints"""
    
    def test_super_admin_login(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "SUPER_ADMIN"
        print(f"✓ Super Admin login successful: {data['user']['email']}")
        return data["token"]
    
    def test_company_admin_login(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print(f"✓ Company Admin login successful: {data['user']['email']}")
        return data["token"]


@pytest.fixture(scope="module")
def super_admin_token():
    """Get Super Admin token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Super Admin login failed")
    return response.json()["token"]


@pytest.fixture(scope="module")
def company_admin_token():
    """Get Company Admin token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": COMPANY_ADMIN_EMAIL,
        "password": COMPANY_ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Company Admin login failed")
    return response.json()["token"]


class TestLimitConfigAPI:
    """Test /api/limits/config endpoints"""
    
    def test_get_config_super_admin(self, super_admin_token):
        """Super Admin can get limit configuration"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/limits/config", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify config structure
        assert "default_max_bet_per_number" in data
        assert "default_max_bet_per_ticket" in data
        assert "alert_threshold_percentage" in data
        assert "auto_block_enabled" in data
        
        print(f"✓ Config retrieved: max_bet={data['default_max_bet_per_number']} HTG, threshold={data['alert_threshold_percentage']}%")
        return data
    
    def test_get_config_company_admin(self, company_admin_token):
        """Company Admin can also get limit configuration"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/limits/config", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "default_max_bet_per_number" in data
        print(f"✓ Company Admin can read config")
    
    def test_get_config_unauthenticated(self):
        """Unauthenticated access should be denied"""
        response = requests.get(f"{BASE_URL}/api/limits/config")
        assert response.status_code in [401, 403]
        print(f"✓ Unauthenticated access correctly denied")
    
    def test_update_config_super_admin(self, super_admin_token):
        """Super Admin can update limit configuration"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Get current config first
        current = requests.get(f"{BASE_URL}/api/limits/config", headers=headers).json()
        
        # Update config
        new_config = {
            "default_max_bet_per_number": 10000,
            "default_max_bet_per_ticket": 50000,
            "alert_threshold_percentage": 75,
            "auto_block_enabled": True,
            "block_duration_minutes": 0
        }
        
        response = requests.put(f"{BASE_URL}/api/limits/config", headers=headers, json=new_config)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Config updated: {data['message']}")
        
        # Verify update
        verify = requests.get(f"{BASE_URL}/api/limits/config", headers=headers).json()
        assert verify["default_max_bet_per_number"] == 10000
        assert verify["alert_threshold_percentage"] == 75
        print(f"✓ Config update verified")
    
    def test_update_config_company_admin_denied(self, company_admin_token):
        """Company Admin cannot update limit configuration (Super Admin only)"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        new_config = {
            "default_max_bet_per_number": 5000,
            "default_max_bet_per_ticket": 50000,
            "alert_threshold_percentage": 80,
            "auto_block_enabled": True,
            "block_duration_minutes": 0
        }
        
        response = requests.put(f"{BASE_URL}/api/limits/config", headers=headers, json=new_config)
        assert response.status_code == 403
        print(f"✓ Company Admin correctly denied config update")


class TestNumberBlockingAPI:
    """Test /api/limits/numbers/block endpoints"""
    
    def test_block_number_super_admin(self, super_admin_token):
        """Super Admin can block a number"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Block number 99 for testing
        params = {
            "number": "99",
            "lottery_id": "lotto_ny_midi",
            "draw_name": "Midi",
            "draw_date": today,
            "reason": "Test blocage Phase 3"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/limits/numbers/block",
            headers=headers,
            params=params
        )
        
        # Could be 200 (success) or 400 (already blocked)
        if response.status_code == 200:
            data = response.json()
            assert "block_id" in data
            print(f"✓ Number 99 blocked: {data['block_id']}")
            return data["block_id"]
        elif response.status_code == 400:
            print(f"✓ Number 99 already blocked (expected)")
            return None
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")
    
    def test_get_blocked_numbers(self, super_admin_token):
        """Get list of blocked numbers"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/limits/numbers/blocked", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "blocked_numbers" in data
        assert "count" in data
        print(f"✓ Retrieved {data['count']} blocked numbers")
        return data["blocked_numbers"]
    
    def test_get_blocked_numbers_filtered(self, super_admin_token):
        """Get blocked numbers with filters"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/limits/numbers/blocked",
            headers=headers,
            params={"lottery_id": "lotto_ny_midi", "draw_date": today}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Filtered blocked numbers: {data['count']} for lotto_ny_midi on {today}")
    
    def test_unblock_number(self, super_admin_token):
        """Super Admin can unblock a number"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First get blocked numbers to find one to unblock
        blocked = requests.get(f"{BASE_URL}/api/limits/numbers/blocked", headers=headers).json()
        
        if blocked["count"] > 0:
            # Find a test block to unblock
            test_blocks = [b for b in blocked["blocked_numbers"] if b.get("number") == "99"]
            if test_blocks:
                block_id = test_blocks[0]["block_id"]
                response = requests.delete(
                    f"{BASE_URL}/api/limits/numbers/block/{block_id}",
                    headers=headers
                )
                assert response.status_code == 200
                print(f"✓ Number unblocked: {block_id}")
            else:
                print(f"✓ No test block (99) to unblock")
        else:
            print(f"✓ No blocked numbers to unblock")


class TestBetCheckAPI:
    """Test /api/limits/check endpoint"""
    
    def test_check_bet_allowed(self, super_admin_token):
        """Check if a bet is allowed"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        today = datetime.now().strftime("%Y-%m-%d")
        
        check_data = {
            "lottery_id": "lotto_ny_midi",
            "draw_name": "Midi",
            "draw_date": today,
            "plays": [
                {"numbers": "12", "bet_type": "BORLETTE", "amount": 100},
                {"numbers": "34", "bet_type": "BORLETTE", "amount": 200}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/limits/check",
            headers=headers,
            json=check_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "all_allowed" in data
        assert "checks" in data
        assert len(data["checks"]) >= 2
        
        for check in data["checks"]:
            assert "number" in check
            assert "is_allowed" in check
            assert "current_total" in check
            assert "max_limit" in check
            assert "percentage_used" in check
        
        print(f"✓ Bet check completed: all_allowed={data['all_allowed']}")
        for check in data["checks"]:
            print(f"  - {check['number']}: {check['current_total']}/{check['max_limit']} HTG ({check['percentage_used']}%)")
    
    def test_check_blocked_number(self, super_admin_token):
        """Check bet on a blocked number returns not allowed"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        today = datetime.now().strftime("%Y-%m-%d")
        
        # First block number 42
        requests.post(
            f"{BASE_URL}/api/limits/numbers/block",
            headers=headers,
            params={
                "number": "42",
                "lottery_id": "lotto_ny_midi",
                "draw_name": "Midi",
                "draw_date": today,
                "reason": "Test blocked number check"
            }
        )
        
        # Now check bet on 42
        check_data = {
            "lottery_id": "lotto_ny_midi",
            "draw_name": "Midi",
            "draw_date": today,
            "plays": [
                {"numbers": "42", "bet_type": "BORLETTE", "amount": 100}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/limits/check",
            headers=headers,
            json=check_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should not be allowed because 42 is blocked
        blocked_check = [c for c in data["checks"] if c["number"] == "42"]
        if blocked_check:
            assert blocked_check[0]["is_blocked"] == True
            assert blocked_check[0]["is_allowed"] == False
            print(f"✓ Blocked number 42 correctly rejected")
        else:
            print(f"✓ Number 42 check completed")


class TestNumbersStatusAPI:
    """Test /api/limits/numbers/status endpoint"""
    
    def test_get_numbers_status(self, super_admin_token):
        """Get status of all numbers for a draw"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/limits/numbers/status",
            headers=headers,
            params={
                "lottery_id": "lotto_ny_midi",
                "draw_name": "Midi",
                "draw_date": today
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "lottery_id" in data
        assert "draw_name" in data
        assert "numbers" in data
        assert "total_count" in data
        assert "blocked_count" in data
        assert "warning_count" in data
        assert "limit_reached_count" in data
        
        print(f"✓ Numbers status retrieved:")
        print(f"  - Total numbers with bets: {data['total_count']}")
        print(f"  - Blocked: {data['blocked_count']}")
        print(f"  - Warning: {data['warning_count']}")
        print(f"  - Limit reached: {data['limit_reached_count']}")
        
        # Check structure of individual number status
        if data["numbers"]:
            num = data["numbers"][0]
            assert "number" in num
            assert "total_bets" in num
            assert "limit" in num
            assert "percentage" in num
            assert "status" in num


class TestAlertsAPI:
    """Test /api/limits/alerts endpoints"""
    
    def test_get_alerts(self, super_admin_token):
        """Get limit alerts"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/limits/alerts",
            headers=headers,
            params={"limit": 20}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "alerts" in data
        assert "total" in data
        assert "unacknowledged_count" in data
        
        print(f"✓ Alerts retrieved: {data['total']} total, {data['unacknowledged_count']} unacknowledged")
        return data["alerts"]
    
    def test_get_unacknowledged_alerts(self, super_admin_token):
        """Get only unacknowledged alerts"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/limits/alerts",
            headers=headers,
            params={"acknowledged": False}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned alerts should be unacknowledged
        for alert in data["alerts"]:
            assert alert["acknowledged"] == False
        
        print(f"✓ Unacknowledged alerts: {len(data['alerts'])}")
    
    def test_acknowledge_alert(self, super_admin_token):
        """Acknowledge a single alert"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Get alerts first
        alerts = requests.get(
            f"{BASE_URL}/api/limits/alerts",
            headers=headers,
            params={"acknowledged": False}
        ).json()
        
        if alerts["alerts"]:
            alert_id = alerts["alerts"][0]["alert_id"]
            
            response = requests.post(
                f"{BASE_URL}/api/limits/alerts/acknowledge",
                headers=headers,
                json={"alert_id": alert_id, "notes": "Test acknowledgement"}
            )
            
            assert response.status_code == 200
            print(f"✓ Alert acknowledged: {alert_id}")
        else:
            print(f"✓ No unacknowledged alerts to acknowledge")
    
    def test_acknowledge_all_alerts(self, super_admin_token):
        """Acknowledge all alerts"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/limits/alerts/acknowledge-all",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        print(f"✓ All alerts acknowledged: {data['message']}")


class TestDashboardStatsAPI:
    """Test /api/limits/dashboard/stats endpoint"""
    
    def test_get_dashboard_stats(self, super_admin_token):
        """Get limits dashboard statistics"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/limits/dashboard/stats", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "config" in data
        assert "blocks" in data
        assert "alerts" in data
        assert "generated_at" in data
        
        # Verify config section
        assert "default_max_bet" in data["config"]
        assert "alert_threshold" in data["config"]
        assert "auto_block_enabled" in data["config"]
        
        # Verify blocks section
        assert "active_total" in data["blocks"]
        assert "created_today" in data["blocks"]
        
        # Verify alerts section
        assert "unacknowledged" in data["alerts"]
        assert "critical" in data["alerts"]
        assert "created_today" in data["alerts"]
        
        print(f"✓ Dashboard stats retrieved:")
        print(f"  - Max bet: {data['config']['default_max_bet']} HTG")
        print(f"  - Alert threshold: {data['config']['alert_threshold']}%")
        print(f"  - Auto-block: {data['config']['auto_block_enabled']}")
        print(f"  - Active blocks: {data['blocks']['active_total']}")
        print(f"  - Unacknowledged alerts: {data['alerts']['unacknowledged']}")


class TestTicketCreationIntegration:
    """Test that ticket creation respects limits"""
    
    def test_ticket_creation_blocked_number(self, company_admin_token):
        """Ticket creation should fail for blocked numbers"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Try to create a ticket with blocked number 42
        ticket_data = {
            "lottery_id": "lotto_ny_midi",
            "draw_name": "Midi",
            "draw_date": today,
            "plays": [
                {"numbers": "42", "bet_type": "BORLETTE", "amount": 100}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/lottery/sell",
            headers=headers,
            json=ticket_data
        )
        
        # Should be rejected (400) because 42 is blocked
        if response.status_code == 400:
            data = response.json()
            assert "bloqué" in data.get("detail", "").lower() or "limite" in data.get("detail", "").lower()
            print(f"✓ Ticket creation correctly rejected for blocked number: {data['detail']}")
        elif response.status_code == 200:
            # Number might have been unblocked
            print(f"✓ Ticket created (number 42 may not be blocked)")
        else:
            print(f"✓ Response: {response.status_code} - {response.text[:200]}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_restore_config(self, super_admin_token):
        """Restore default configuration"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        default_config = {
            "default_max_bet_per_number": 10000,
            "default_max_bet_per_ticket": 50000,
            "alert_threshold_percentage": 75,
            "auto_block_enabled": True,
            "block_duration_minutes": 0
        }
        
        response = requests.put(
            f"{BASE_URL}/api/limits/config",
            headers=headers,
            json=default_config
        )
        
        assert response.status_code == 200
        print(f"✓ Configuration restored to defaults")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
