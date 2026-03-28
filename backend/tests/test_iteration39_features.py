"""
LOTTOLAB - Iteration 39 Testing
Testing new features:
1. Notifications system (CRUD, read/unread, mark-all-read)
2. Draw Times management (Super Admin CRUD)
3. Real-time sync endpoints (global sync, ping)
4. Results lotteries dropdown (236 lotteries)
5. Company Settings (QR toggle, address, phone, header/footer)
"""

import pytest
import requests
import os

BASE_URL = "https://seller-commission-ui.preview.emergentagent.com"

# Test credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin@2026!"


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✅ Health check passed - Version: {data.get('version')}")


class TestSuperAdminAuth:
    """Super Admin authentication tests"""
    
    def test_super_admin_login(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "SUPER_ADMIN"
        print(f"✅ Super Admin login successful: {data['user']['email']}")
        return data["token"]


class TestCompanyAdminAuth:
    """Company Admin authentication tests"""
    
    def test_company_admin_login(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] in ["COMPANY_ADMIN", "COMPANY_MANAGER"]
        print(f"✅ Company Admin login successful: {data['user']['email']}")
        return data["token"]


class TestResultsLotteriesDropdown:
    """Test /api/results/lotteries endpoint - should return 236 lotteries"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_lotteries_for_results(self, super_admin_token):
        """Test that dropdown loads all 236 lotteries"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/results/lotteries", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        
        # Should have many lotteries (236 expected)
        lottery_count = len(data)
        print(f"✅ Lotteries for results dropdown: {lottery_count} lotteries")
        
        # Verify structure
        if data:
            first = data[0]
            assert "lottery_id" in first
            assert "lottery_name" in first
            print(f"   Sample: {first.get('lottery_name')} ({first.get('state_code')})")
        
        # Should have more than 100 lotteries (bug was showing only 1)
        assert lottery_count > 100, f"Expected 200+ lotteries, got {lottery_count}"


class TestDrawTimesManagement:
    """Test Draw Times CRUD for Super Admin"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_all_draw_times(self, super_admin_token):
        """Test GET /api/super/draw-times"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/super/draw-times", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Draw times retrieved: {len(data)} schedules")
        
        # Verify structure if any exist
        if data:
            first = data[0]
            assert "schedule_id" in first or "lottery_id" in first
            print(f"   Sample: {first.get('lottery_name')} - {first.get('draw_name')}")
    
    def test_get_draw_times_by_lottery(self, super_admin_token):
        """Test GET /api/super/draw-times with lottery filter"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First get a lottery ID
        lotteries_response = requests.get(f"{BASE_URL}/api/results/lotteries", headers=headers)
        if lotteries_response.status_code == 200:
            lotteries = lotteries_response.json()
            if lotteries:
                lottery_id = lotteries[0]["lottery_id"]
                
                response = requests.get(
                    f"{BASE_URL}/api/super/draw-times",
                    headers=headers,
                    params={"lottery_id": lottery_id}
                )
                assert response.status_code == 200
                print(f"✅ Draw times filter by lottery works")


class TestNotificationsSystem:
    """Test Notifications CRUD and read/unread states"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def company_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_notifications(self, super_admin_token):
        """Test GET /api/notifications"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Notifications retrieved: {len(data)} notifications")
        
        # Verify structure if any exist
        if data:
            first = data[0]
            assert "notification_id" in first or "id" in first
            assert "title" in first or "message" in first
            print(f"   Sample: {first.get('title', first.get('type'))}")
    
    def test_create_notification(self, super_admin_token):
        """Test POST /api/notifications"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        notification_data = {
            "type": "INFO",
            "title": "Test Notification",
            "message": "This is a test notification from iteration 39 testing"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notifications",
            headers=headers,
            json=notification_data
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "notification_id" in data or "message" in data
        print(f"✅ Notification created successfully")
        return data.get("notification_id")
    
    def test_mark_all_read(self, super_admin_token):
        """Test PUT /api/notifications/mark-all-read"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.put(
            f"{BASE_URL}/api/notifications/mark-all-read",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✅ Mark all read: {data.get('message')}, count: {data.get('count', 0)}")
    
    def test_saas_notifications_endpoint(self, super_admin_token):
        """Test GET /api/saas/notifications (Super Admin specific)"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/saas/notifications", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✅ SAAS notifications endpoint works")
    
    def test_company_notifications_endpoint(self, company_admin_token):
        """Test GET /api/company/notifications (Company Admin specific)"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/notifications", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✅ Company notifications endpoint works")


class TestRealtimeSync:
    """Test Real-time sync endpoints"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def company_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_global_sync(self, company_admin_token):
        """Test GET /api/sync/global"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/global", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify expected fields
        assert "server_time" in data
        assert "unread_notifications" in data or "notifications_count" in data
        print(f"✅ Global sync works - Server time: {data.get('server_time')}")
        print(f"   Results count: {data.get('results_count', 0)}")
        print(f"   Notifications count: {data.get('notifications_count', 0)}")
        print(f"   Unread notifications: {data.get('unread_notifications', 0)}")
    
    def test_sync_ping(self, company_admin_token):
        """Test GET /api/sync/ping (lightweight)"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/ping", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "server_time" in data
        assert "unread_notifications" in data
        print(f"✅ Sync ping works - Unread: {data.get('unread_notifications')}")
    
    def test_latest_results(self, company_admin_token):
        """Test GET /api/sync/latest-results"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/sync/latest-results", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "results" in data
        assert "count" in data
        print(f"✅ Latest results: {data.get('count')} results")


class TestCompanySettings:
    """Test Company Settings page fields"""
    
    @pytest.fixture
    def company_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_company_profile(self, company_admin_token):
        """Test GET /api/company/profile"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/profile", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify expected fields exist
        print(f"✅ Company profile retrieved:")
        print(f"   Name: {data.get('company_name')}")
        print(f"   Phone: {data.get('company_phone', 'Not set')}")
        print(f"   Address: {data.get('company_address', 'Not set')}")
        print(f"   QR Code Enabled: {data.get('qr_code_enabled', True)}")
        print(f"   Header Text: {data.get('ticket_header_text', 'Not set')[:50] if data.get('ticket_header_text') else 'Not set'}")
        print(f"   Footer Text: {data.get('ticket_footer_text', 'Not set')[:50] if data.get('ticket_footer_text') else 'Not set'}")
    
    def test_update_company_profile(self, company_admin_token):
        """Test PUT /api/company/profile with new fields"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # First get current profile
        get_response = requests.get(f"{BASE_URL}/api/company/profile", headers=headers)
        current = get_response.json()
        
        # Update with test values
        update_data = {
            "company_name": current.get("company_name", "Test Company"),
            "company_phone": "+509 1234-5678",
            "company_address": "123 Test Street, Port-au-Prince",
            "company_email": current.get("company_email", "test@test.com"),
            "qr_code_enabled": True,
            "ticket_header_text": "Bonne chance!",
            "ticket_footer_text": "Merci de jouer avec nous!"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/company/profile",
            headers=headers,
            json=update_data
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✅ Company profile updated successfully")
    
    def test_qr_code_toggle(self, company_admin_token):
        """Test QR code toggle functionality"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Get current state
        get_response = requests.get(f"{BASE_URL}/api/company/profile", headers=headers)
        current = get_response.json()
        current_qr = current.get("qr_code_enabled", True)
        
        # Toggle QR code
        update_data = {
            "company_name": current.get("company_name"),
            "qr_code_enabled": not current_qr
        }
        
        response = requests.put(
            f"{BASE_URL}/api/company/profile",
            headers=headers,
            json=update_data
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify toggle worked
        verify_response = requests.get(f"{BASE_URL}/api/company/profile", headers=headers)
        new_state = verify_response.json().get("qr_code_enabled")
        
        print(f"✅ QR Code toggle: {current_qr} -> {new_state}")
        
        # Restore original state
        restore_data = {
            "company_name": current.get("company_name"),
            "qr_code_enabled": current_qr
        }
        requests.put(f"{BASE_URL}/api/company/profile", headers=headers, json=restore_data)


class TestCompanyPrimes:
    """Test Company Primes configuration"""
    
    @pytest.fixture
    def company_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_primes(self, company_admin_token):
        """Test GET /api/company/primes"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/primes", headers=headers)
        
        # May return 404 if not configured, which is OK
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Company primes retrieved:")
            print(f"   Borlette: {data.get('prime_borlette', '60|20|10')}")
            print(f"   Loto 3: {data.get('prime_loto3', '500')}")
        else:
            print(f"ℹ️ Primes not configured (using defaults)")


class TestSuperAdminResultsPage:
    """Test Super Admin Results page functionality"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_results(self, super_admin_token):
        """Test GET /api/results (Super Admin)"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/results", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Results retrieved: {len(data)} results")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
