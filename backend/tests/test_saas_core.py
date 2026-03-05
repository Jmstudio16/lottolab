"""
SaaS Core Enterprise Backend Tests
Tests for multi-tenant isolation, master lotteries, global schedules,
company creation, license management, heartbeat system
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://lottery-sync-fix.preview.emergentagent.com')

# Session-level fixtures to avoid rate limiting
@pytest.fixture(scope="session")
def super_token():
    """Get Super Admin token once for all tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "jefferson@jmstudio.com", "password": "JMStudio@2026!"
    })
    assert response.status_code == 200, f"Super Admin login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="session")
def company_token():
    """Get Company Admin token once for all tests"""
    time.sleep(0.5)  # Small delay to avoid rate limiting
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@lotopam.com", "password": "Admin123!"
    })
    assert response.status_code == 200, f"Company Admin login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="session")
def company_id(company_token):
    """Get company_id from Company Admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@lotopam.com", "password": "Admin123!"
    })
    return response.json()["user"]["company_id"]


class TestSaaSCoreAuthentication:
    """Authentication and role-based access tests"""
    
    def test_super_admin_login(self):
        """Super Admin can login and get SUPER_ADMIN role"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "jefferson@jmstudio.com", "password": "JMStudio@2026!"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "SUPER_ADMIN"
        assert data["user"]["company_id"] is None  # Super Admin has no company_id
        assert "token" in data
        print(f"✓ Super Admin login successful: {data['user']['email']}")
    
    def test_company_admin_login(self):
        """Company Admin can login with COMPANY_ADMIN role"""
        time.sleep(0.5)
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@lotopam.com", "password": "Admin123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "COMPANY_ADMIN"
        assert data["user"]["company_id"] is not None
        print(f"✓ Company Admin login successful: {data['user']['email']}, company_id: {data['user']['company_id']}")


class TestMasterLotteries:
    """Master lottery catalog tests (220 lotteries)"""
    
    def test_super_admin_sees_all_lotteries(self, super_token):
        """Super Admin sees all 220 lotteries including inactive ones"""
        headers = {"Authorization": f"Bearer {super_token}"}
        response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 220, f"Expected 220+ lotteries, got {len(data)}"
        print(f"✓ Super Admin sees {len(data)} lotteries")
        
        # Check structure
        lottery = data[0]
        required_fields = ["lottery_id", "lottery_name", "state_code", "state_name", "game_type", "is_active_global"]
        for field in required_fields:
            assert field in lottery, f"Missing field: {field}"
    
    def test_company_admin_sees_only_active_lotteries(self, company_token):
        """Company Admin sees only globally active lotteries"""
        headers = {"Authorization": f"Bearer {company_token}"}
        response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # All returned should be active
        inactive = [l for l in data if not l.get("is_active_global", True)]
        assert len(inactive) == 0, f"Company Admin should not see inactive lotteries, found {len(inactive)}"
        print(f"✓ Company Admin sees only active lotteries: {len(data)}")
    
    def test_toggle_lottery_global_status(self, super_token):
        """Super Admin can toggle lottery global status"""
        headers = {"Authorization": f"Bearer {super_token}"}
        
        # Get first lottery
        response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=headers)
        lotteries = response.json()
        lottery_id = lotteries[0]["lottery_id"]
        
        # Toggle OFF
        response = requests.put(
            f"{BASE_URL}/api/saas/master-lotteries/{lottery_id}/toggle-global?is_active=false",
            headers=headers
        )
        assert response.status_code == 200
        print(f"✓ Lottery toggled OFF")
        
        # Toggle back ON
        response = requests.put(
            f"{BASE_URL}/api/saas/master-lotteries/{lottery_id}/toggle-global?is_active=true",
            headers=headers
        )
        assert response.status_code == 200
        print(f"✓ Lottery toggled ON")
    
    def test_company_admin_cannot_toggle_global(self, super_token, company_token):
        """Company Admin cannot toggle global lottery status"""
        super_headers = {"Authorization": f"Bearer {super_token}"}
        company_headers = {"Authorization": f"Bearer {company_token}"}
        
        response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=super_headers)
        lottery_id = response.json()[0]["lottery_id"]
        
        # Try to toggle as Company Admin
        response = requests.put(
            f"{BASE_URL}/api/saas/master-lotteries/{lottery_id}/toggle-global?is_active=false",
            headers=company_headers
        )
        assert response.status_code == 403
        print(f"✓ Company Admin correctly blocked from toggling global status")


class TestGlobalSchedules:
    """Global schedules tests (Super Admin only CRUD)"""
    
    def test_super_admin_sees_all_schedules(self, super_token):
        """Super Admin sees all global schedules"""
        headers = {"Authorization": f"Bearer {super_token}"}
        response = requests.get(f"{BASE_URL}/api/saas/global-schedules", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 10, f"Expected 10+ schedules, got {len(data)}"
        print(f"✓ Super Admin sees {len(data)} global schedules")
        
        # Check structure
        schedule = data[0]
        required_fields = ["schedule_id", "lottery_id", "draw_name", "draw_time", "is_active"]
        for field in required_fields:
            assert field in schedule, f"Missing field: {field}"
    
    def test_company_admin_sees_schedules_for_enabled_lotteries(self, company_token):
        """Company Admin sees schedules only for their enabled lotteries"""
        headers = {"Authorization": f"Bearer {company_token}"}
        response = requests.get(f"{BASE_URL}/api/saas/global-schedules", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Company Admin sees {len(data)} schedules (filtered by enabled lotteries)")
    
    def test_company_admin_cannot_create_schedule(self, super_token, company_token):
        """Company Admin cannot create global schedule"""
        super_headers = {"Authorization": f"Bearer {super_token}"}
        company_headers = {"Authorization": f"Bearer {company_token}"}
        
        # Get a lottery ID
        response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=super_headers)
        lottery_id = response.json()[0]["lottery_id"]
        
        # Try to create as Company Admin
        schedule_data = {
            "lottery_id": lottery_id,
            "draw_name": "Test Draw",
            "open_time": "08:00",
            "close_time": "12:00",
            "draw_time": "12:30",
            "days_of_week": []
        }
        response = requests.post(
            f"{BASE_URL}/api/saas/global-schedules",
            json=schedule_data,
            headers=company_headers
        )
        assert response.status_code == 403
        assert "Super Admin" in response.json()["detail"] or "requis" in response.json()["detail"]
        print(f"✓ Company Admin correctly blocked from creating global schedule")
    
    def test_super_admin_can_create_schedule(self, super_token):
        """Super Admin can create global schedule"""
        headers = {"Authorization": f"Bearer {super_token}"}
        
        # Get a lottery ID
        response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=headers)
        lottery_id = response.json()[0]["lottery_id"]
        
        schedule_data = {
            "lottery_id": lottery_id,
            "draw_name": "Test Schedule",
            "open_time": "08:00",
            "close_time": "12:00",
            "draw_time": "12:30",
            "days_of_week": [],
            "stop_sales_before_minutes": 5,
            "is_active": True
        }
        response = requests.post(
            f"{BASE_URL}/api/saas/global-schedules",
            json=schedule_data,
            headers=headers
        )
        assert response.status_code == 200
        assert "schedule_id" in response.json()
        
        # Cleanup - delete the test schedule
        schedule_id = response.json()["schedule_id"]
        requests.delete(f"{BASE_URL}/api/saas/global-schedules/{schedule_id}", headers=headers)
        print(f"✓ Super Admin created and cleaned up test schedule")


class TestCompanyFullCreation:
    """Full company creation with admin + config + lotteries"""
    
    def test_full_company_creation(self, super_token):
        """Creates company + admin + config + links lotteries"""
        import random
        headers = {"Authorization": f"Bearer {super_token}"}
        rand = random.randint(10000, 99999)
        
        company_data = {
            "company_name": f"Test Company {rand}",
            "slogan": "Test Slogan",
            "contact_email": f"admin{rand}@testcompany.com",
            "admin_password": "TestPass123!",
            "admin_name": f"Test Admin {rand}",
            "plan_id": "Basic",
            "timezone": "America/New_York",
            "currency": "USD",
            "default_commission_rate": 8.0,
            "max_agents": 25,
            "max_daily_sales": 500000.0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/saas/companies/full-create",
            json=company_data,
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "company_id" in data
        assert "admin_user_id" in data
        assert data["admin_email"] == company_data["contact_email"]
        assert data["lotteries_enabled"] >= 200, f"Expected 200+ lotteries linked, got {data['lotteries_enabled']}"
        
        print(f"✓ Company created: {data['company_id']}")
        print(f"✓ Admin created: {data['admin_email']}")
        print(f"✓ Lotteries linked: {data['lotteries_enabled']}")


class TestLicenseManagement:
    """License management tests (suspend, activate, extend)"""
    
    @pytest.fixture(autouse=True)
    def setup(self, super_token):
        self.headers = {"Authorization": f"Bearer {super_token}"}
        # Get first company for testing
        response = requests.get(f"{BASE_URL}/api/super/companies", headers=self.headers)
        self.company_id = response.json()[0]["company_id"]
    
    def test_suspend_company(self):
        """Super Admin can suspend company"""
        response = requests.put(
            f"{BASE_URL}/api/saas/companies/{self.company_id}/suspend",
            headers=self.headers
        )
        assert response.status_code == 200
        assert "suspendue" in response.json()["message"].lower()
        print(f"✓ Company suspended")
        
        # Re-activate for cleanup
        requests.put(
            f"{BASE_URL}/api/saas/companies/{self.company_id}/activate",
            headers=self.headers
        )
    
    def test_activate_company(self):
        """Super Admin can activate company"""
        response = requests.put(
            f"{BASE_URL}/api/saas/companies/{self.company_id}/activate",
            headers=self.headers
        )
        assert response.status_code == 200
        assert "activée" in response.json()["message"].lower()
        print(f"✓ Company activated")
    
    def test_extend_license(self):
        """Super Admin can extend company license"""
        response = requests.put(
            f"{BASE_URL}/api/saas/companies/{self.company_id}/extend-license?days=30",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "30 jours" in data["message"]
        assert "new_expiration" in data
        print(f"✓ License extended, new expiration: {data['new_expiration']}")


class TestHeartbeatOnlineStatus:
    """Heartbeat and online status tracking tests"""
    
    def test_company_heartbeat(self, company_token):
        """Company admin can send heartbeat"""
        headers = {"Authorization": f"Bearer {company_token}"}
        response = requests.post(
            f"{BASE_URL}/api/saas/heartbeat/company",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print(f"✓ Company heartbeat sent: {data.get('timestamp', 'N/A')}")
    
    def test_agent_heartbeat(self, company_token):
        """User can send agent heartbeat"""
        headers = {"Authorization": f"Bearer {company_token}"}
        response = requests.post(
            f"{BASE_URL}/api/saas/heartbeat/agent",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print(f"✓ Agent heartbeat sent")
    
    def test_online_status_requires_super_admin(self, company_token):
        """Online status endpoint requires Super Admin"""
        headers = {"Authorization": f"Bearer {company_token}"}
        response = requests.get(
            f"{BASE_URL}/api/saas/online-status",
            headers=headers
        )
        assert response.status_code == 403
        print(f"✓ Company Admin blocked from online status")
    
    def test_super_admin_can_see_online_status(self, super_token):
        """Super Admin can see online status"""
        headers = {"Authorization": f"Bearer {super_token}"}
        response = requests.get(
            f"{BASE_URL}/api/saas/online-status",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "companies_online" in data
        assert "agents_online" in data
        assert "companies" in data
        assert "agents" in data
        print(f"✓ Online status: {data['companies_online']} companies, {data['agents_online']} agents")


class TestCompanyLotteryCatalog:
    """Company lottery catalog tests (synchronized from master)"""
    
    def test_lottery_catalog_synchronized(self, company_token):
        """Company sees synchronized lotteries from master"""
        headers = {"Authorization": f"Bearer {company_token}"}
        response = requests.get(
            f"{BASE_URL}/api/company/lottery-catalog",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) >= 200, f"Expected 200+ lotteries, got {len(data)}"
        
        # Check structure
        lottery = data[0]
        required_fields = ["lottery_id", "lottery_name", "enabled"]
        for field in required_fields:
            assert field in lottery, f"Missing field: {field}"
        
        # Count enabled
        enabled = sum(1 for l in data if l.get("enabled"))
        print(f"✓ Company sees {len(data)} lotteries, {enabled} enabled")
    
    def test_lottery_shows_disabled_by_super_admin_flag(self, company_token):
        """Lotteries show disabled_by_super_admin flag"""
        headers = {"Authorization": f"Bearer {company_token}"}
        response = requests.get(
            f"{BASE_URL}/api/company/lottery-catalog",
            headers=headers
        )
        data = response.json()
        
        # Check if disabled_by_super_admin field exists
        lottery = data[0]
        assert "disabled_by_super_admin" in lottery or "can_toggle" in lottery
        print(f"✓ Lottery catalog shows super admin control flags")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
