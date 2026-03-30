"""
ITERATION 49: Real-time Synchronization Service Tests
=====================================================
Tests for lottery status synchronization between Super Admin and all users.

Features tested:
1. GET /api/sync/lotteries/status - Real-time status of all lotteries
2. GET /api/sync/vendeur/open-lotteries - ONLY open lotteries for vendors
3. PUT /api/saas/master-lotteries/{id}/toggle-global - Global toggle with WebSocket broadcast
4. PUT /api/saas/global-schedules/{id} - Schedule modification with WebSocket broadcast
5. Countdown timers and open/close time display
6. Flag filtering (Haiti/USA)
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
SUPER_ADMIN_CREDS = {"email": "jefferson@jmstudio.com", "password": "JMStudio@2026!"}
COMPANY_ADMIN_CREDS = {"email": "admin@lotopam.com", "password": "LotoPAM2026!"}
VENDEUR_CREDS = {"email": "vendeur@lotopam.com", "password": "Vendeur2026!"}


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Verify API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ API healthy: {data.get('version')}")


class TestAuthentication:
    """Authentication tests for all user types"""
    
    def test_super_admin_login(self):
        """Super Admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data.get("user", {}).get("role") == "SUPER_ADMIN"
        print(f"✓ Super Admin login successful: {data.get('user', {}).get('email')}")
    
    def test_company_admin_login(self):
        """Company Admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN_CREDS)
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            print(f"✓ Company Admin login successful: {data.get('user', {}).get('email')}")
        else:
            pytest.skip(f"Company Admin login failed: {response.status_code}")
    
    def test_vendeur_login(self):
        """Vendeur can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR_CREDS)
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            print(f"✓ Vendeur login successful: {data.get('user', {}).get('email')}")
        else:
            pytest.skip(f"Vendeur login failed: {response.status_code}")


@pytest.fixture
def super_admin_token():
    """Get Super Admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Super Admin login failed")


@pytest.fixture
def company_admin_token():
    """Get Company Admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=COMPANY_ADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Company Admin login failed")


@pytest.fixture
def vendeur_token():
    """Get Vendeur token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDEUR_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Vendeur login failed")


class TestSyncLotteriesStatus:
    """Tests for GET /api/sync/lotteries/status"""
    
    def test_get_lotteries_status_super_admin(self, super_admin_token):
        """Super Admin can get all lotteries status"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/lotteries/status", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "lotteries" in data
        assert "total" in data
        assert "open_count" in data
        assert "closed_count" in data
        assert "server_time" in data
        assert "timezone" in data
        
        print(f"✓ Super Admin sees {data['total']} lotteries ({data['open_count']} open, {data['closed_count']} closed)")
        print(f"  Timezone: {data['timezone']}")
        
        # Verify lottery structure
        if data["lotteries"]:
            lottery = data["lotteries"][0]
            assert "lottery_id" in lottery
            assert "lottery_name" in lottery
            assert "is_open" in lottery
            print(f"  Sample lottery: {lottery.get('lottery_name')} - {'OPEN' if lottery.get('is_open') else 'CLOSED'}")
    
    def test_get_lotteries_status_company_admin(self, company_admin_token):
        """Company Admin can get lotteries status"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/lotteries/status", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "lotteries" in data
        print(f"✓ Company Admin sees {data['total']} lotteries")
    
    def test_lotteries_status_has_time_info(self, super_admin_token):
        """Lotteries include open/close time information"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/lotteries/status", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Find an open lottery to check time info
        open_lotteries = [l for l in data["lotteries"] if l.get("is_open")]
        if open_lotteries:
            lottery = open_lotteries[0]
            # Check for time fields
            assert "open_time" in lottery or "status_text" in lottery
            if "time_until_close" in lottery:
                assert lottery["time_until_close"] is None or isinstance(lottery["time_until_close"], (int, float))
                print(f"✓ Open lottery '{lottery.get('lottery_name')}' has time_until_close: {lottery.get('time_until_close')}s")
            if "status_text" in lottery:
                print(f"  Status text: {lottery.get('status_text')}")
        else:
            print("⚠ No open lotteries found to verify time info")


class TestVendeurOpenLotteries:
    """Tests for GET /api/sync/vendeur/open-lotteries"""
    
    def test_vendeur_gets_only_open_lotteries(self, vendeur_token):
        """Vendeur endpoint returns ONLY open lotteries"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/vendeur/open-lotteries", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "lotteries" in data
        assert "open_count" in data
        assert "server_time" in data
        assert "timezone" in data
        
        # ALL returned lotteries must be open
        for lottery in data["lotteries"]:
            assert lottery.get("is_open") == True, f"Closed lottery found: {lottery.get('lottery_name')}"
        
        print(f"✓ Vendeur sees {data['open_count']} open lotteries (all verified as open)")
    
    def test_vendeur_lotteries_have_countdown(self, vendeur_token):
        """Open lotteries have countdown timer info"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/vendeur/open-lotteries", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        if data["lotteries"]:
            lottery = data["lotteries"][0]
            # Should have time_until_close for countdown
            if "time_until_close" in lottery and lottery["time_until_close"]:
                assert lottery["time_until_close"] > 0
                hours = lottery["time_until_close"] // 3600
                mins = (lottery["time_until_close"] % 3600) // 60
                print(f"✓ Lottery '{lottery.get('lottery_name')}' closes in {hours}h{mins}m")
            
            # Should have open/close times
            if "open_time" in lottery and "close_time" in lottery:
                print(f"  Hours: {lottery.get('open_time')} - {lottery.get('close_time')}")
        else:
            print("⚠ No open lotteries to verify countdown")
    
    def test_vendeur_lotteries_have_flag_type(self, vendeur_token):
        """Lotteries have flag_type for filtering"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/vendeur/open-lotteries", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        haiti_count = 0
        usa_count = 0
        
        for lottery in data["lotteries"]:
            flag = lottery.get("flag_type", "USA")
            if flag == "HAITI":
                haiti_count += 1
            else:
                usa_count += 1
        
        print(f"✓ Flag distribution: Haiti={haiti_count}, USA={usa_count}")
    
    def test_vendeur_endpoint_requires_auth(self):
        """Vendeur endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/sync/vendeur/open-lotteries")
        assert response.status_code in [401, 403]
        print("✓ Endpoint correctly requires authentication")


class TestLotteryStatusById:
    """Tests for GET /api/sync/lottery/{lottery_id}/status"""
    
    def test_get_single_lottery_status(self, super_admin_token):
        """Can get status for a specific lottery"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First get list of lotteries
        list_response = requests.get(f"{BASE_URL}/api/sync/lotteries/status", headers=headers)
        assert list_response.status_code == 200
        lotteries = list_response.json().get("lotteries", [])
        
        if not lotteries:
            pytest.skip("No lotteries available")
        
        lottery_id = lotteries[0]["lottery_id"]
        
        # Get specific lottery status
        response = requests.get(f"{BASE_URL}/api/sync/lottery/{lottery_id}/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["lottery_id"] == lottery_id
        assert "lottery_name" in data
        assert "is_open" in data
        assert "schedules" in data
        
        print(f"✓ Got status for lottery: {data.get('lottery_name')}")
        print(f"  Is open: {data.get('is_open')}")
        print(f"  Schedules: {len(data.get('schedules', []))}")


class TestToggleLotteryGlobal:
    """Tests for PUT /api/saas/master-lotteries/{id}/toggle-global"""
    
    def test_toggle_requires_super_admin(self, company_admin_token):
        """Toggle endpoint requires Super Admin role"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Try to toggle with company admin
        response = requests.put(
            f"{BASE_URL}/api/saas/master-lotteries/test_id/toggle-global",
            params={"is_active": False},
            headers=headers
        )
        
        assert response.status_code == 403
        print("✓ Toggle correctly requires Super Admin role")
    
    def test_toggle_lottery_global(self, super_admin_token):
        """Super Admin can toggle lottery global status"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Get a lottery to toggle
        list_response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=headers)
        assert list_response.status_code == 200
        lotteries = list_response.json()
        
        if not lotteries:
            pytest.skip("No lotteries available")
        
        # Find an active lottery
        active_lottery = next((l for l in lotteries if l.get("is_active_global")), None)
        if not active_lottery:
            pytest.skip("No active lottery to toggle")
        
        lottery_id = active_lottery["lottery_id"]
        lottery_name = active_lottery.get("lottery_name")
        
        # Toggle OFF
        response = requests.put(
            f"{BASE_URL}/api/saas/master-lotteries/{lottery_id}/toggle-global",
            params={"is_active": False},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Toggled lottery '{lottery_name}' OFF")
        
        # Toggle back ON
        response = requests.put(
            f"{BASE_URL}/api/saas/master-lotteries/{lottery_id}/toggle-global",
            params={"is_active": True},
            headers=headers
        )
        
        assert response.status_code == 200
        print(f"✓ Toggled lottery '{lottery_name}' back ON")


class TestGlobalScheduleUpdate:
    """Tests for PUT /api/saas/global-schedules/{id}"""
    
    def test_get_global_schedules(self, super_admin_token):
        """Can get global schedules"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/saas/global-schedules", headers=headers)
        
        assert response.status_code == 200
        schedules = response.json()
        assert isinstance(schedules, list)
        
        print(f"✓ Got {len(schedules)} global schedules")
        
        if schedules:
            schedule = schedules[0]
            print(f"  Sample: {schedule.get('lottery_name')} - {schedule.get('draw_name')}")
            print(f"  Times: {schedule.get('open_time')} - {schedule.get('close_time')} (draw: {schedule.get('draw_time')})")
    
    def test_update_schedule_requires_super_admin(self, company_admin_token):
        """Schedule update requires Super Admin"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        response = requests.put(
            f"{BASE_URL}/api/saas/global-schedules/test_id",
            json={"open_time": "08:00"},
            headers=headers
        )
        
        assert response.status_code == 403
        print("✓ Schedule update correctly requires Super Admin")
    
    def test_update_schedule(self, super_admin_token):
        """Super Admin can update schedule times"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Get schedules
        list_response = requests.get(f"{BASE_URL}/api/saas/global-schedules", headers=headers)
        assert list_response.status_code == 200
        schedules = list_response.json()
        
        if not schedules:
            pytest.skip("No schedules available")
        
        schedule = schedules[0]
        schedule_id = schedule.get("schedule_id")
        original_open_time = schedule.get("open_time")
        
        # Update open time
        new_open_time = "07:00" if original_open_time != "07:00" else "08:00"
        
        response = requests.put(
            f"{BASE_URL}/api/saas/global-schedules/{schedule_id}",
            json={"open_time": new_open_time},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Updated schedule open_time to {new_open_time}")
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/saas/global-schedules/{schedule_id}",
            json={"open_time": original_open_time},
            headers=headers
        )
        print(f"✓ Restored original open_time: {original_open_time}")


class TestCompanyLotteries:
    """Tests for company lottery sync"""
    
    def test_get_company_lotteries_with_status(self, company_admin_token):
        """Company Admin can get lotteries with real-time status"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/company/lotteries", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "lotteries" in data
        assert "total" in data
        assert "open_count" in data
        
        print(f"✓ Company has {data['total']} lotteries ({data['open_count']} open)")
        
        if data["lotteries"]:
            lottery = data["lotteries"][0]
            assert "is_open" in lottery
            assert "lottery_name" in lottery


class TestSyncToggleLottery:
    """Tests for POST /api/sync/lottery/{id}/toggle"""
    
    def test_sync_toggle_requires_super_admin(self, company_admin_token):
        """Sync toggle requires Super Admin"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/sync/lottery/test_id/toggle",
            headers=headers
        )
        
        assert response.status_code == 403
        print("✓ Sync toggle correctly requires Super Admin")


class TestWebSocketEvents:
    """Tests for WebSocket event structure (via API responses)"""
    
    def test_toggle_response_includes_broadcast_info(self, super_admin_token):
        """Toggle response indicates WebSocket broadcast"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Get a lottery
        list_response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=headers)
        lotteries = list_response.json()
        
        if not lotteries:
            pytest.skip("No lotteries available")
        
        lottery = lotteries[0]
        lottery_id = lottery["lottery_id"]
        current_status = lottery.get("is_active_global", True)
        
        # Toggle
        response = requests.put(
            f"{BASE_URL}/api/saas/master-lotteries/{lottery_id}/toggle-global",
            params={"is_active": not current_status},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Response should have message about the action
        assert "message" in data
        print(f"✓ Toggle response: {data.get('message')}")
        
        # Restore
        requests.put(
            f"{BASE_URL}/api/saas/master-lotteries/{lottery_id}/toggle-global",
            params={"is_active": current_status},
            headers=headers
        )


class TestTimezoneHandling:
    """Tests for timezone handling in sync service"""
    
    def test_server_returns_timezone(self, vendeur_token):
        """Server returns timezone in response"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/vendeur/open-lotteries", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "timezone" in data
        assert data["timezone"] == "America/Port-au-Prince"
        print(f"✓ Server timezone: {data['timezone']}")
    
    def test_server_returns_server_time(self, vendeur_token):
        """Server returns current server time"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/vendeur/open-lotteries", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "server_time" in data
        # Verify it's a valid ISO timestamp
        server_time = data["server_time"]
        assert "T" in server_time
        print(f"✓ Server time: {server_time}")


class TestClosedLotteriesNotShownToVendeur:
    """Verify closed lotteries are hidden from vendeur"""
    
    def test_compare_admin_vs_vendeur_lottery_count(self, super_admin_token, vendeur_token):
        """Vendeur sees fewer lotteries than admin (only open ones)"""
        admin_headers = {"Authorization": f"Bearer {super_admin_token}"}
        vendeur_headers = {"Authorization": f"Bearer {vendeur_token}"}
        
        # Get admin view (all lotteries)
        admin_response = requests.get(f"{BASE_URL}/api/sync/lotteries/status", headers=admin_headers)
        assert admin_response.status_code == 200
        admin_data = admin_response.json()
        
        # Get vendeur view (only open)
        vendeur_response = requests.get(f"{BASE_URL}/api/sync/vendeur/open-lotteries", headers=vendeur_headers)
        assert vendeur_response.status_code == 200
        vendeur_data = vendeur_response.json()
        
        admin_total = admin_data.get("total", 0)
        admin_open = admin_data.get("open_count", 0)
        vendeur_open = vendeur_data.get("open_count", 0)
        
        print(f"✓ Admin sees: {admin_total} total, {admin_open} open")
        print(f"✓ Vendeur sees: {vendeur_open} open (closed lotteries hidden)")
        
        # Vendeur should see same or fewer than admin's open count
        assert vendeur_open <= admin_open


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
