"""
Company CRUD API Tests for LOTTOLAB SaaS Platform
Testing: POS Devices, Agents, Schedules, Tickets, Results, Reports, Users, Activity Logs, Settings
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://global-lottery-hub.preview.emergentagent.com"

# Test credentials
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get Company Admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": COMPANY_ADMIN_EMAIL,
        "password": COMPANY_ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


# ========== AUTHENTICATION TESTS ==========
class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self, api_client):
        """Company Admin login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == COMPANY_ADMIN_EMAIL
        assert data["user"]["role"] == "COMPANY_ADMIN"
    
    def test_login_invalid_credentials(self, api_client):
        """Login with wrong password fails"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401


# ========== AGENTS CRUD TESTS ==========
class TestAgentsCRUD:
    """Agents CRUD operations tests"""
    
    def test_get_agents_list(self, authenticated_client):
        """GET /api/company/agents returns list"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/agents")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_agent_success(self, authenticated_client):
        """POST /api/company/agents creates new agent"""
        unique_id = str(uuid.uuid4())[:8]
        agent_data = {
            "name": f"TEST_Agent_{unique_id}",
            "username": f"testagent_{unique_id}",
            "password": "TestPassword123!",
            "phone": "+509-1234-5678",
            "email": f"testagent_{unique_id}@test.com",
            "can_void_ticket": False
        }
        response = authenticated_client.post(f"{BASE_URL}/api/company/agents", json=agent_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["name"] == agent_data["name"]
        assert data["username"] == agent_data["username"]
        assert data["status"] == "ACTIVE"
        assert "agent_id" in data
        return data["agent_id"]
    
    def test_update_agent_status(self, authenticated_client):
        """PUT /api/company/agents/{agent_id} updates agent status"""
        # First create an agent
        unique_id = str(uuid.uuid4())[:8]
        create_resp = authenticated_client.post(f"{BASE_URL}/api/company/agents", json={
            "name": f"TEST_Update_{unique_id}",
            "username": f"testupdate_{unique_id}",
            "password": "TestPassword123!",
            "email": f"testupdate_{unique_id}@test.com"
        })
        assert create_resp.status_code == 200
        agent_id = create_resp.json()["agent_id"]
        
        # Update status to SUSPENDED
        response = authenticated_client.put(
            f"{BASE_URL}/api/company/agents/{agent_id}",
            json={"status": "SUSPENDED"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "SUSPENDED"
    
    def test_create_agent_duplicate_username_fails(self, authenticated_client):
        """Duplicate username should fail"""
        unique_id = str(uuid.uuid4())[:8]
        agent_data = {
            "name": f"TEST_Dup_{unique_id}",
            "username": "duplicate_test_user",
            "password": "TestPassword123!",
            "email": f"dup1_{unique_id}@test.com"
        }
        # Create first agent
        resp1 = authenticated_client.post(f"{BASE_URL}/api/company/agents", json=agent_data)
        
        if resp1.status_code == 200:
            # Try to create second agent with same username
            agent_data["email"] = f"dup2_{unique_id}@test.com"
            resp2 = authenticated_client.post(f"{BASE_URL}/api/company/agents", json=agent_data)
            assert resp2.status_code == 400
            assert "already exists" in resp2.json().get("detail", "").lower()


# ========== POS DEVICES CRUD TESTS ==========
class TestPOSDevicesCRUD:
    """POS Devices CRUD operations tests"""
    
    def test_get_pos_devices_list(self, authenticated_client):
        """GET /api/company/pos-devices returns list"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/pos-devices")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_pos_device_success(self, authenticated_client):
        """POST /api/company/pos-devices creates new device"""
        unique_imei = str(int(time.time() * 1000))[:15].ljust(15, '0')
        device_data = {
            "imei": unique_imei,
            "device_name": f"TEST_Terminal_{unique_imei[-6:]}",
            "branch": "Test Branch",
            "location": "Test Location"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/company/pos-devices", json=device_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["imei"] == device_data["imei"]
        assert data["device_name"] == device_data["device_name"]
        assert data["status"] == "PENDING"
        assert "device_id" in data
        return data["device_id"]
    
    def test_activate_pos_device(self, authenticated_client):
        """PUT /api/company/pos-devices/{device_id}/activate activates device"""
        # First get list of devices and find one that's PENDING
        list_resp = authenticated_client.get(f"{BASE_URL}/api/company/pos-devices")
        devices = list_resp.json()
        pending_device = next((d for d in devices if d["status"] == "PENDING"), None)
        
        if pending_device:
            device_id = pending_device["device_id"]
            response = authenticated_client.put(f"{BASE_URL}/api/company/pos-devices/{device_id}/activate")
            assert response.status_code == 200
    
    def test_block_pos_device(self, authenticated_client):
        """PUT /api/company/pos-devices/{device_id}/block blocks device"""
        # Create new device first
        unique_imei = str(int(time.time() * 1000) + 1)[:15].ljust(15, '0')
        create_resp = authenticated_client.post(f"{BASE_URL}/api/company/pos-devices", json={
            "imei": unique_imei,
            "device_name": f"TEST_Block_{unique_imei[-6:]}",
            "branch": "Block Test"
        })
        
        if create_resp.status_code == 200:
            device_id = create_resp.json()["device_id"]
            # First activate
            authenticated_client.put(f"{BASE_URL}/api/company/pos-devices/{device_id}/activate")
            # Then block
            response = authenticated_client.put(f"{BASE_URL}/api/company/pos-devices/{device_id}/block")
            assert response.status_code == 200
    
    def test_delete_pos_device(self, authenticated_client):
        """DELETE /api/company/pos-devices/{device_id} deletes device"""
        # Create new device first
        unique_imei = str(int(time.time() * 1000) + 2)[:15].ljust(15, '0')
        create_resp = authenticated_client.post(f"{BASE_URL}/api/company/pos-devices", json={
            "imei": unique_imei,
            "device_name": f"TEST_Delete_{unique_imei[-6:]}",
            "branch": "Delete Test"
        })
        
        if create_resp.status_code == 200:
            device_id = create_resp.json()["device_id"]
            response = authenticated_client.delete(f"{BASE_URL}/api/company/pos-devices/{device_id}")
            assert response.status_code == 200
            
            # Verify deletion
            get_resp = authenticated_client.get(f"{BASE_URL}/api/company/pos-devices")
            devices = get_resp.json()
            assert not any(d["device_id"] == device_id for d in devices)
    
    def test_duplicate_imei_fails(self, authenticated_client):
        """Duplicate IMEI should fail"""
        unique_imei = str(int(time.time() * 1000) + 3)[:15].ljust(15, '0')
        device_data = {"imei": unique_imei, "device_name": "Dup Test 1"}
        
        resp1 = authenticated_client.post(f"{BASE_URL}/api/company/pos-devices", json=device_data)
        if resp1.status_code == 200:
            # Try duplicate
            device_data["device_name"] = "Dup Test 2"
            resp2 = authenticated_client.post(f"{BASE_URL}/api/company/pos-devices", json=device_data)
            assert resp2.status_code == 400
            assert "already registered" in resp2.json().get("detail", "").lower()


# ========== SCHEDULES CRUD TESTS ==========
class TestSchedulesCRUD:
    """Schedules CRUD operations tests"""
    
    def test_get_schedules_list(self, authenticated_client):
        """GET /api/company/schedules returns list"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/schedules")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_lotteries_for_schedule(self, authenticated_client):
        """GET /api/company/lotteries for schedule creation"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/lotteries")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_toggle_schedule_active(self, authenticated_client):
        """PUT /api/company/schedules/{schedule_id} toggles active status"""
        list_resp = authenticated_client.get(f"{BASE_URL}/api/company/schedules")
        schedules = list_resp.json()
        
        if schedules:
            schedule = schedules[0]
            new_status = not schedule["is_active"]
            response = authenticated_client.put(
                f"{BASE_URL}/api/company/schedules/{schedule['schedule_id']}",
                json={"is_active": new_status}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["is_active"] == new_status


# ========== TICKETS TESTS ==========
class TestTickets:
    """Tickets read operations tests"""
    
    def test_get_tickets_list(self, authenticated_client):
        """GET /api/company/tickets returns list"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/tickets")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_filter_tickets_by_status(self, authenticated_client):
        """GET /api/company/tickets with status filter"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/tickets?status=ACTIVE")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


# ========== REPORTS TESTS ==========
class TestReports:
    """Reports read operations tests"""
    
    def test_get_reports_today(self, authenticated_client):
        """GET /api/company/reports/summary for today"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/reports/summary?period=today")
        assert response.status_code == 200
        data = response.json()
        assert "total_tickets" in data
        assert "total_sales" in data
        assert "net_revenue" in data
    
    def test_get_reports_week(self, authenticated_client):
        """GET /api/company/reports/summary for week"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/reports/summary?period=week")
        assert response.status_code == 200
        data = response.json()
        assert "total_tickets" in data
    
    def test_get_reports_month(self, authenticated_client):
        """GET /api/company/reports/summary for month"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/reports/summary?period=month")
        assert response.status_code == 200
        data = response.json()
        assert "total_tickets" in data


# ========== COMPANY USERS CRUD TESTS ==========
class TestCompanyUsersCRUD:
    """Company Users CRUD operations tests"""
    
    def test_get_company_users_list(self, authenticated_client):
        """GET /api/company/users returns list"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/users")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should include at least the company admin
        assert len(data) >= 1
    
    def test_create_company_user_manager(self, authenticated_client):
        """POST /api/company/users creates manager"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "name": f"TEST_Manager_{unique_id}",
            "email": f"testmanager_{unique_id}@test.com",
            "password": "TestPassword123!",
            "role": "COMPANY_MANAGER"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/company/users", json=user_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["name"] == user_data["name"]
        assert data["role"] == "COMPANY_MANAGER"
        assert data["status"] == "ACTIVE"
    
    def test_create_company_user_auditor(self, authenticated_client):
        """POST /api/company/users creates auditor"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "name": f"TEST_Auditor_{unique_id}",
            "email": f"testauditor_{unique_id}@test.com",
            "password": "TestPassword123!",
            "role": "AUDITOR_READONLY"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/company/users", json=user_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["role"] == "AUDITOR_READONLY"
    
    def test_cannot_create_admin_role(self, authenticated_client):
        """Cannot create COMPANY_ADMIN via this endpoint"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "name": f"TEST_Admin_{unique_id}",
            "email": f"testadmin_{unique_id}@test.com",
            "password": "TestPassword123!",
            "role": "COMPANY_ADMIN"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/company/users", json=user_data)
        assert response.status_code == 400


# ========== ACTIVITY LOGS TESTS ==========
class TestActivityLogs:
    """Activity logs read operations tests"""
    
    def test_get_activity_logs(self, authenticated_client):
        """GET /api/company/activity-logs returns list"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/activity-logs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_filter_activity_logs_by_action(self, authenticated_client):
        """GET /api/company/activity-logs with action_type filter"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/activity-logs?action_type=USER_LOGIN")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_filter_activity_logs_by_entity(self, authenticated_client):
        """GET /api/company/activity-logs with entity_type filter"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/activity-logs?entity_type=user")
        assert response.status_code == 200


# ========== SETTINGS TESTS ==========
class TestSettings:
    """Settings read/update operations tests"""
    
    def test_get_settings(self, authenticated_client):
        """GET /api/company/settings returns settings"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/settings")
        assert response.status_code == 200
        data = response.json()
        assert "timezone" in data
        assert "currency" in data
        assert "stop_sales_before_draw_minutes" in data
    
    def test_update_settings(self, authenticated_client):
        """PUT /api/company/settings updates settings"""
        # First get current settings
        get_resp = authenticated_client.get(f"{BASE_URL}/api/company/settings")
        current = get_resp.json()
        
        # Update settings
        new_stop_minutes = 10 if current.get("stop_sales_before_draw_minutes") != 10 else 5
        response = authenticated_client.put(f"{BASE_URL}/api/company/settings", json={
            "stop_sales_before_draw_minutes": new_stop_minutes
        })
        assert response.status_code == 200
        data = response.json()
        assert data["stop_sales_before_draw_minutes"] == new_stop_minutes
    
    def test_update_settings_timezone(self, authenticated_client):
        """PUT /api/company/settings can update timezone"""
        response = authenticated_client.put(f"{BASE_URL}/api/company/settings", json={
            "timezone": "America/New_York"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["timezone"] == "America/New_York"
        
        # Restore to default
        authenticated_client.put(f"{BASE_URL}/api/company/settings", json={
            "timezone": "America/Port-au-Prince"
        })


# ========== RESULTS TESTS ==========
class TestResults:
    """Results read operations tests"""
    
    def test_get_results_list(self, authenticated_client):
        """GET /api/company/results returns list"""
        response = authenticated_client.get(f"{BASE_URL}/api/company/results")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
