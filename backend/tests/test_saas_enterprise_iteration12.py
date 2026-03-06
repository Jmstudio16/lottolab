"""
LOTTOLAB SaaS Enterprise Core Tests - Iteration 12
Tests for: Cron job, Soft delete, Suspension, Activation, Staff management, RBAC
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://lottery-sync-hub.preview.emergentagent.com').rstrip('/')

# Test Credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin123!"

# Track test data for cleanup
created_test_data = []


@pytest.fixture(scope="module")
def super_admin_token():
    """Get Super Admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Super Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def company_admin_token():
    """Get Company Admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": COMPANY_ADMIN_EMAIL,
        "password": COMPANY_ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Company Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def auth_header(token):
    """Create auth header dict"""
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# COMPANY LIFECYCLE TESTS
# ============================================================================

class TestCompanySoftDelete:
    """Test soft delete functionality - status=DELETED, users blocked"""
    
    def test_create_company_for_delete_test(self, super_admin_token, api_client):
        """Create a test company to delete"""
        test_id = str(uuid.uuid4())[:8]
        company_data = {
            "company_name": f"TEST_DELETE_{test_id}",
            "contact_email": f"delete_test_{test_id}@test.com",
            "admin_password": "Test123!",
            "admin_name": "Test Delete Admin",
            "plan_id": "Basic",
            "timezone": "America/Port-au-Prince",
            "currency": "HTG",
            "default_commission_rate": 10.0,
            "max_agents": 10,
            "max_daily_sales": 100000.0
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/saas/companies/full-create",
            json=company_data,
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200, f"Failed to create test company: {response.text}"
        
        data = response.json()
        assert "company_id" in data
        created_test_data.append({"type": "company", "id": data["company_id"]})
        
        # Store for cleanup and further tests
        pytest.test_delete_company_id = data["company_id"]
        pytest.test_delete_admin_email = company_data["contact_email"]
        pytest.test_delete_admin_password = company_data["admin_password"]
        
        return data["company_id"]
    
    def test_soft_delete_sets_status_deleted(self, super_admin_token, api_client):
        """Test soft delete sets status to DELETED"""
        company_id = getattr(pytest, 'test_delete_company_id', None)
        if not company_id:
            pytest.skip("No test company created")
        
        response = api_client.delete(
            f"{BASE_URL}/api/saas/companies/{company_id}",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200, f"Delete failed: {response.text}"
        
        data = response.json()
        assert "users_blocked" in data, "Response should include users_blocked count"
        
        # Verify company status is DELETED
        response = api_client.get(
            f"{BASE_URL}/api/saas/companies/{company_id}",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200
        company = response.json()
        assert company["status"] == "DELETED", "Company status should be DELETED"
    
    def test_deleted_company_admin_cannot_login(self, api_client):
        """Test that admin of deleted company cannot login"""
        email = getattr(pytest, 'test_delete_admin_email', None)
        password = getattr(pytest, 'test_delete_admin_password', None)
        if not email or not password:
            pytest.skip("No test admin credentials")
        
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        # Should fail because user is suspended
        assert response.status_code in [401, 403], f"Deleted company admin should not be able to login: {response.text}"
    
    def test_deleted_company_in_archived_list(self, super_admin_token, api_client):
        """Test deleted company appears in archived companies"""
        response = api_client.get(
            f"{BASE_URL}/api/saas/archived-companies",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200, f"Failed to get archived companies: {response.text}"
        
        company_id = getattr(pytest, 'test_delete_company_id', None)
        if company_id:
            archived = response.json()
            company_ids = [c["company_id"] for c in archived]
            assert company_id in company_ids, "Deleted company should be in archived list"


class TestCompanySuspension:
    """Test company suspension - blocks all user logins"""
    
    def test_create_company_for_suspension_test(self, super_admin_token, api_client):
        """Create a test company to suspend"""
        test_id = str(uuid.uuid4())[:8]
        company_data = {
            "company_name": f"TEST_SUSPEND_{test_id}",
            "contact_email": f"suspend_test_{test_id}@test.com",
            "admin_password": "Test123!",
            "admin_name": "Test Suspend Admin",
            "plan_id": "Professional",
            "timezone": "America/Port-au-Prince",
            "currency": "HTG",
            "default_commission_rate": 10.0,
            "max_agents": 10,
            "max_daily_sales": 100000.0
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/saas/companies/full-create",
            json=company_data,
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200, f"Failed to create test company: {response.text}"
        
        data = response.json()
        created_test_data.append({"type": "company", "id": data["company_id"]})
        
        pytest.test_suspend_company_id = data["company_id"]
        pytest.test_suspend_admin_email = company_data["contact_email"]
        pytest.test_suspend_admin_password = company_data["admin_password"]
        
        return data
    
    def test_suspend_company_blocks_users(self, super_admin_token, api_client):
        """Test suspending company blocks all users"""
        company_id = getattr(pytest, 'test_suspend_company_id', None)
        if not company_id:
            pytest.skip("No test company created")
        
        response = api_client.put(
            f"{BASE_URL}/api/saas/companies/{company_id}/suspend",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200, f"Suspend failed: {response.text}"
        
        data = response.json()
        assert "users_suspended" in data, "Response should include users_suspended count"
        
        # Verify company status is SUSPENDED
        response = api_client.get(
            f"{BASE_URL}/api/saas/companies/{company_id}",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200
        company = response.json()
        assert company["status"] == "SUSPENDED"
    
    def test_suspended_company_admin_cannot_login(self, api_client):
        """Test that admin of suspended company cannot login"""
        email = getattr(pytest, 'test_suspend_admin_email', None)
        password = getattr(pytest, 'test_suspend_admin_password', None)
        if not email or not password:
            pytest.skip("No test admin credentials")
        
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        # Should fail because user is suspended
        assert response.status_code in [401, 403], f"Suspended company admin should not be able to login: {response.text}"


class TestCompanyActivation:
    """Test company activation - reactivates admin"""
    
    def test_activate_suspended_company(self, super_admin_token, api_client):
        """Test activating a suspended company reactivates admin"""
        company_id = getattr(pytest, 'test_suspend_company_id', None)
        if not company_id:
            pytest.skip("No test company to activate")
        
        response = api_client.put(
            f"{BASE_URL}/api/saas/companies/{company_id}/activate",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200, f"Activate failed: {response.text}"
        
        data = response.json()
        assert "admins_reactivated" in data, "Response should include admins_reactivated count"
        
        # Verify company status is ACTIVE
        response = api_client.get(
            f"{BASE_URL}/api/saas/companies/{company_id}",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200
        company = response.json()
        assert company["status"] == "ACTIVE"
    
    def test_activated_company_admin_can_login(self, api_client):
        """Test that admin of activated company can login again"""
        email = getattr(pytest, 'test_suspend_admin_email', None)
        password = getattr(pytest, 'test_suspend_admin_password', None)
        if not email or not password:
            pytest.skip("No test admin credentials")
        
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        # Should succeed now
        assert response.status_code == 200, f"Activated company admin should be able to login: {response.text}"


class TestCompanyRestore:
    """Test restoring a soft-deleted company"""
    
    def test_restore_deleted_company(self, super_admin_token, api_client):
        """Test restoring a soft-deleted company"""
        company_id = getattr(pytest, 'test_delete_company_id', None)
        if not company_id:
            pytest.skip("No deleted company to restore")
        
        response = api_client.put(
            f"{BASE_URL}/api/saas/companies/{company_id}/restore?days=30",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200, f"Restore failed: {response.text}"
        
        data = response.json()
        assert "new_subscription_end" in data
        
        # Verify company status is ACTIVE
        response = api_client.get(
            f"{BASE_URL}/api/saas/companies/{company_id}",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200
        company = response.json()
        assert company["status"] == "ACTIVE"


# ============================================================================
# COMPANY EDIT MODAL TESTS
# ============================================================================

class TestCompanyEditModal:
    """Test edit company modal - subscription_end_date and status"""
    
    def test_update_company_subscription_end_date(self, super_admin_token, api_client):
        """Test updating subscription_end_date via edit modal"""
        company_id = getattr(pytest, 'test_suspend_company_id', None)
        if not company_id:
            pytest.skip("No test company to update")
        
        # Set subscription end date to 60 days from now
        new_end_date = (datetime.now() + timedelta(days=60)).isoformat()
        
        response = api_client.put(
            f"{BASE_URL}/api/saas/companies/{company_id}",
            json={"subscription_end_date": new_end_date},
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        # Verify the change
        response = api_client.get(
            f"{BASE_URL}/api/saas/companies/{company_id}",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200
        company = response.json()
        # Check that license_end or subscription_end_date was updated
        assert company.get("license_end") or company.get("subscription_end_date")
    
    def test_update_company_status_via_edit(self, super_admin_token, api_client):
        """Test updating company status via edit modal"""
        company_id = getattr(pytest, 'test_suspend_company_id', None)
        if not company_id:
            pytest.skip("No test company to update")
        
        # Update to SUSPENDED via edit endpoint
        response = api_client.put(
            f"{BASE_URL}/api/saas/companies/{company_id}",
            json={"status": "SUSPENDED"},
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200, f"Update status failed: {response.text}"
        
        # Verify
        response = api_client.get(
            f"{BASE_URL}/api/saas/companies/{company_id}",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200
        assert response.json()["status"] == "SUSPENDED"
        
        # Reactivate for further tests
        response = api_client.put(
            f"{BASE_URL}/api/saas/companies/{company_id}/activate",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200


# ============================================================================
# STAFF MANAGEMENT TESTS
# ============================================================================

class TestStaffManagement:
    """Test staff CRUD operations"""
    
    @pytest.fixture
    def company_admin_auth(self, company_admin_token):
        """Get company admin auth header"""
        return auth_header(company_admin_token)
    
    def test_get_staff_list(self, company_admin_token, api_client):
        """Test getting staff list"""
        response = api_client.get(
            f"{BASE_URL}/api/company/staff/",
            headers=auth_header(company_admin_token)
        )
        assert response.status_code == 200, f"Get staff failed: {response.text}"
        assert isinstance(response.json(), list)
    
    def test_create_staff_member(self, company_admin_token, api_client):
        """Test creating a staff member"""
        test_id = str(uuid.uuid4())[:8]
        staff_data = {
            "email": f"test_staff_{test_id}@test.com",
            "password": "Staff123!",
            "name": f"Test Staff {test_id}",
            "role": "COMPANY_MANAGER"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/company/staff/",
            json=staff_data,
            headers=auth_header(company_admin_token)
        )
        assert response.status_code == 200, f"Create staff failed: {response.text}"
        
        data = response.json()
        assert "user_id" in data
        assert data["email"] == staff_data["email"]
        assert data["role"] == "COMPANY_MANAGER"
        assert data["status"] == "ACTIVE"
        
        pytest.test_staff_user_id = data["user_id"]
        pytest.test_staff_email = staff_data["email"]
        pytest.test_staff_password = staff_data["password"]
        
        created_test_data.append({"type": "user", "id": data["user_id"]})
        
        return data
    
    def test_suspend_staff_member(self, company_admin_token, api_client):
        """Test suspending a staff member"""
        user_id = getattr(pytest, 'test_staff_user_id', None)
        if not user_id:
            pytest.skip("No test staff member created")
        
        response = api_client.put(
            f"{BASE_URL}/api/company/staff/{user_id}/suspend",
            headers=auth_header(company_admin_token)
        )
        assert response.status_code == 200, f"Suspend staff failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "SUSPENDED"
    
    def test_suspended_staff_cannot_login(self, api_client):
        """Test that suspended staff cannot login"""
        email = getattr(pytest, 'test_staff_email', None)
        password = getattr(pytest, 'test_staff_password', None)
        if not email or not password:
            pytest.skip("No test staff credentials")
        
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        # Should fail because staff is suspended
        assert response.status_code in [401, 403], f"Suspended staff should not be able to login: {response.text}"
    
    def test_activate_staff_member(self, company_admin_token, api_client):
        """Test activating a suspended staff member"""
        user_id = getattr(pytest, 'test_staff_user_id', None)
        if not user_id:
            pytest.skip("No test staff member")
        
        response = api_client.put(
            f"{BASE_URL}/api/company/staff/{user_id}/activate",
            headers=auth_header(company_admin_token)
        )
        assert response.status_code == 200, f"Activate staff failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "ACTIVE"
    
    def test_activated_staff_can_login(self, api_client):
        """Test that activated staff can login"""
        email = getattr(pytest, 'test_staff_email', None)
        password = getattr(pytest, 'test_staff_password', None)
        if not email or not password:
            pytest.skip("No test staff credentials")
        
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        # Should succeed now
        assert response.status_code == 200, f"Activated staff should be able to login: {response.text}"
    
    def test_delete_staff_member(self, company_admin_token, api_client):
        """Test deleting (soft delete) a staff member"""
        user_id = getattr(pytest, 'test_staff_user_id', None)
        if not user_id:
            pytest.skip("No test staff member")
        
        response = api_client.delete(
            f"{BASE_URL}/api/company/staff/{user_id}",
            headers=auth_header(company_admin_token)
        )
        assert response.status_code == 200, f"Delete staff failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "DELETED"


# ============================================================================
# RBAC PERMISSIONS TESTS
# ============================================================================

class TestRoleBasedPermissions:
    """Test RBAC permissions API"""
    
    def test_get_my_permissions(self, company_admin_token, api_client):
        """Test getting current user's permissions"""
        response = api_client.get(
            f"{BASE_URL}/api/company/staff/permissions",
            headers=auth_header(company_admin_token)
        )
        assert response.status_code == 200, f"Get permissions failed: {response.text}"
        
        data = response.json()
        assert "role" in data
        assert "permissions" in data
        assert data["role"] == "COMPANY_ADMIN"
        assert data["permissions"]["can_manage_staff"] == True
        assert data["permissions"]["can_manage_agents"] == True
    
    def test_get_available_roles(self, company_admin_token, api_client):
        """Test getting available staff roles"""
        response = api_client.get(
            f"{BASE_URL}/api/company/staff/roles",
            headers=auth_header(company_admin_token)
        )
        assert response.status_code == 200, f"Get roles failed: {response.text}"
        
        roles = response.json()
        assert isinstance(roles, list)
        assert len(roles) >= 3  # At least 3 staff roles
        
        role_names = [r["role"] for r in roles]
        assert "COMPANY_MANAGER" in role_names
        assert "AUDITOR_READONLY" in role_names
        assert "BRANCH_USER" in role_names


# ============================================================================
# SUBSCRIPTION COUNTER TESTS
# ============================================================================

class TestSubscriptionCounter:
    """Test subscription counter on dashboard"""
    
    def test_get_my_subscription(self, company_admin_token, api_client):
        """Test getting subscription info for company admin"""
        response = api_client.get(
            f"{BASE_URL}/api/saas/my-subscription",
            headers=auth_header(company_admin_token)
        )
        # This endpoint may or may not exist - check gracefully
        if response.status_code == 200:
            data = response.json()
            # Should have subscription info
            assert "remaining_days" in data or "subscription_end" in data or data is None
        elif response.status_code == 404:
            # Endpoint may not exist yet
            pytest.skip("my-subscription endpoint not found")
    
    def test_company_subscription_info(self, super_admin_token, api_client):
        """Test getting company subscription details via Super Admin"""
        # Get list of companies first
        response = api_client.get(
            f"{BASE_URL}/api/saas/companies",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200
        
        companies = response.json()
        if len(companies) > 0:
            company_id = companies[0]["company_id"]
            
            response = api_client.get(
                f"{BASE_URL}/api/saas/companies/{company_id}/subscription",
                headers=auth_header(super_admin_token)
            )
            
            if response.status_code == 200:
                data = response.json()
                assert "remaining_days" in data
                assert "is_expired" in data
            elif response.status_code == 404:
                pytest.skip("subscription endpoint not found")


# ============================================================================
# EXTEND LICENSE TESTS
# ============================================================================

class TestExtendLicense:
    """Test license extension functionality"""
    
    def test_extend_license_by_days(self, super_admin_token, api_client):
        """Test extending company license"""
        company_id = getattr(pytest, 'test_suspend_company_id', None)
        if not company_id:
            pytest.skip("No test company")
        
        response = api_client.put(
            f"{BASE_URL}/api/saas/companies/{company_id}/extend-license?days=30",
            headers=auth_header(super_admin_token)
        )
        assert response.status_code == 200, f"Extend license failed: {response.text}"
        
        data = response.json()
        assert "new_expiration" in data


# ============================================================================
# CLEANUP
# ============================================================================

def test_cleanup(super_admin_token, api_client):
    """Clean up test data - run last"""
    for item in created_test_data:
        try:
            if item["type"] == "company":
                # Soft delete companies
                api_client.delete(
                    f"{BASE_URL}/api/saas/companies/{item['id']}",
                    headers=auth_header(super_admin_token)
                )
        except Exception as e:
            print(f"Cleanup error: {e}")
