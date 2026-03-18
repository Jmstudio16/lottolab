"""
Test suite for LOTTOLAB RBAC and new features:
- Super Admin: Global lottery catalog, schedules, results
- Company Admin: Branches, Configuration, Statistics, Daily Reports (READ-ONLY for schedules/results)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin123!"


class TestAuthentication:
    """Authentication tests for both Super Admin and Company Admin"""
    
    def test_super_admin_login_success(self):
        """Super Admin should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Super Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "SUPER_ADMIN"
        print(f"Super Admin login successful: {data['user']['name']}")
        
    def test_company_admin_login_success(self):
        """Company Admin should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Company Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "COMPANY_ADMIN"
        print(f"Company Admin login successful: {data['user']['name']}")


@pytest.fixture(scope="class")
def super_admin_token():
    """Get Super Admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Super Admin authentication failed")


@pytest.fixture(scope="class")
def company_admin_token():
    """Get Company Admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": COMPANY_ADMIN_EMAIL,
        "password": COMPANY_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Company Admin authentication failed")


class TestSuperAdminLotteryCatalog:
    """Super Admin: Global Lottery Catalog tests"""
    
    def test_get_lottery_catalog(self, super_admin_token):
        """Super Admin can view global lottery catalog"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/super/lottery-catalog", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Lottery catalog has {len(data)} lotteries")
        
    def test_seed_lottery_catalog(self, super_admin_token):
        """Super Admin can seed the lottery catalog"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.post(f"{BASE_URL}/api/super/seed-lottery-catalog", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Seed catalog result: {data['message']}")
        
    def test_lottery_catalog_has_155_lotteries(self, super_admin_token):
        """Verify 155 lotteries (50 states x 3 + 5 Haiti)"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/super/lottery-catalog", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Should have 155 lotteries: 50 states * 3 game types + 5 Haiti games
        assert len(data) >= 155, f"Expected 155 lotteries, got {len(data)}"
        print(f"Confirmed lottery catalog has {len(data)} lotteries")
        
    def test_filter_lottery_catalog_by_state(self, super_admin_token):
        """Super Admin can filter lottery catalog by state"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/super/lottery-catalog?state_code=NY", headers=headers)
        assert response.status_code == 200
        data = response.json()
        for lottery in data:
            assert lottery.get("state_code") == "NY"
        print(f"Found {len(data)} NY lotteries")


class TestSuperAdminGlobalSchedules:
    """Super Admin: Global Schedules CRUD tests"""
    
    created_schedule_id = None
    
    def test_get_global_schedules(self, super_admin_token):
        """Super Admin can view global schedules"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/super/global-schedules", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} global schedules")
        
    def test_create_global_schedule(self, super_admin_token):
        """Super Admin can create global schedule"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First get a lottery ID
        lotteries = requests.get(f"{BASE_URL}/api/super/lottery-catalog", headers=headers).json()
        if not lotteries:
            pytest.skip("No lotteries available")
            
        lottery_id = lotteries[0]["lottery_id"]
        
        schedule_data = {
            "lottery_id": lottery_id,
            "draw_name": "Midday",
            "days_of_week": [0, 1, 2, 3, 4],  # Mon-Fri
            "open_time": "08:00",
            "close_time": "12:00",
            "draw_time": "12:30",
            "is_active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/super/global-schedules", headers=headers, json=schedule_data)
        assert response.status_code == 200, f"Create schedule failed: {response.text}"
        data = response.json()
        assert "schedule_id" in data
        TestSuperAdminGlobalSchedules.created_schedule_id = data["schedule_id"]
        print(f"Created schedule: {data['schedule_id']}")
        
    def test_delete_global_schedule(self, super_admin_token):
        """Super Admin can delete global schedule"""
        if not TestSuperAdminGlobalSchedules.created_schedule_id:
            pytest.skip("No schedule to delete")
            
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.delete(
            f"{BASE_URL}/api/super/global-schedules/{TestSuperAdminGlobalSchedules.created_schedule_id}",
            headers=headers
        )
        assert response.status_code == 200
        print("Schedule deleted successfully")


class TestSuperAdminGlobalResults:
    """Super Admin: Global Results CRUD tests"""
    
    created_result_id = None
    
    def test_get_global_results(self, super_admin_token):
        """Super Admin can view global results"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/super/global-results", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} global results")
        
    def test_create_global_result(self, super_admin_token):
        """Super Admin can create global result"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First get a lottery ID
        lotteries = requests.get(f"{BASE_URL}/api/super/lottery-catalog", headers=headers).json()
        if not lotteries:
            pytest.skip("No lotteries available")
            
        lottery_id = lotteries[0]["lottery_id"]
        today = datetime.now().strftime("%Y-%m-%d")
        
        result_data = {
            "lottery_id": lottery_id,
            "draw_date": today,
            "draw_name": "TEST_Evening",
            "winning_numbers": "123-456-789",
            "winning_numbers_parsed": {"first": "123", "second": "456", "third": "789"},
            "bonus_number": "77"
        }
        
        response = requests.post(f"{BASE_URL}/api/super/global-results", headers=headers, json=result_data)
        assert response.status_code == 200, f"Create result failed: {response.text}"
        data = response.json()
        assert "result_id" in data
        TestSuperAdminGlobalResults.created_result_id = data["result_id"]
        print(f"Created result: {data['result_id']}")
        
    def test_delete_global_result(self, super_admin_token):
        """Super Admin can delete global result"""
        if not TestSuperAdminGlobalResults.created_result_id:
            pytest.skip("No result to delete")
            
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.delete(
            f"{BASE_URL}/api/super/global-results/{TestSuperAdminGlobalResults.created_result_id}",
            headers=headers
        )
        assert response.status_code == 200
        print("Result deleted successfully")


class TestCompanyAdminReadOnlyAccess:
    """Company Admin: READ-ONLY access to schedules and results"""
    
    def test_company_admin_can_view_schedules(self, company_admin_token):
        """Company Admin can VIEW schedules (read-only)"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/schedules", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Company Admin sees {len(data)} schedules (read-only)")
        
    def test_company_admin_can_view_results(self, company_admin_token):
        """Company Admin can VIEW results (read-only)"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/results", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Company Admin sees {len(data)} results (read-only)")
        
    def test_company_admin_cannot_create_schedules(self, company_admin_token):
        """Company Admin CANNOT create schedules - route should not exist"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.post(f"{BASE_URL}/api/company/schedules", headers=headers, json={})
        # Should get 404 (route doesn't exist) or 405 (method not allowed)
        assert response.status_code in [404, 405, 422], \
            f"Expected 404/405/422, got {response.status_code}. Schedule creation should be blocked."
        print("Confirmed: Company Admin cannot create schedules")
        
    def test_company_admin_cannot_create_results(self, company_admin_token):
        """Company Admin CANNOT create results - route should not exist"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.post(f"{BASE_URL}/api/company/results", headers=headers, json={})
        # Should get 404 (route doesn't exist) or 405 (method not allowed)
        assert response.status_code in [404, 405, 422], \
            f"Expected 404/405/422, got {response.status_code}. Result creation should be blocked."
        print("Confirmed: Company Admin cannot create results")


class TestCompanyAdminBranches:
    """Company Admin: Branches (Succursales) CRUD tests"""
    
    created_branch_id = None
    
    def test_get_branches(self, company_admin_token):
        """Company Admin can list branches"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/branches", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} branches")
        
    def test_create_branch(self, company_admin_token):
        """Company Admin can create branch"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        import random
        branch_code = f"TEST_{random.randint(1000, 9999)}"
        
        branch_data = {
            "name": f"Test Branch {branch_code}",
            "code": branch_code,
            "address": "123 Test Street",
            "city": "Port-au-Prince",
            "phone": "+509 1234 5678"
        }
        
        response = requests.post(f"{BASE_URL}/api/company/branches", headers=headers, json=branch_data)
        assert response.status_code == 200, f"Create branch failed: {response.text}"
        data = response.json()
        assert "branch_id" in data
        TestCompanyAdminBranches.created_branch_id = data["branch_id"]
        print(f"Created branch: {data['branch_id']}, code: {branch_code}")
        
    def test_update_branch(self, company_admin_token):
        """Company Admin can update branch"""
        if not TestCompanyAdminBranches.created_branch_id:
            pytest.skip("No branch to update")
            
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.put(
            f"{BASE_URL}/api/company/branches/{TestCompanyAdminBranches.created_branch_id}",
            headers=headers,
            json={"city": "Cap-Haïtien"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("city") == "Cap-Haïtien"
        print("Branch updated successfully")
        
    def test_delete_branch(self, company_admin_token):
        """Company Admin can delete branch"""
        if not TestCompanyAdminBranches.created_branch_id:
            pytest.skip("No branch to delete")
            
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.delete(
            f"{BASE_URL}/api/company/branches/{TestCompanyAdminBranches.created_branch_id}",
            headers=headers
        )
        assert response.status_code == 200
        print("Branch deleted successfully")


class TestCompanyAdminConfiguration:
    """Company Admin: Configuration module tests"""
    
    def test_get_configuration(self, company_admin_token):
        """Company Admin can get configuration"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/configuration", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Verify expected fields
        assert "min_bet_amount" in data
        assert "max_bet_amount" in data
        assert "agent_commission_percent" in data
        print(f"Configuration loaded: min_bet={data.get('min_bet_amount')}, max_bet={data.get('max_bet_amount')}")
        
    def test_update_configuration(self, company_admin_token):
        """Company Admin can update configuration"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.put(
            f"{BASE_URL}/api/company/configuration",
            headers=headers,
            json={"agent_commission_percent": 12.5}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("agent_commission_percent") == 12.5
        print("Configuration updated successfully")
        
    def test_get_prime_configs(self, company_admin_token):
        """Company Admin can get prime configurations"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/prime-configs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} prime configurations")
        
    def test_seed_default_primes(self, company_admin_token):
        """Company Admin can seed default prime configurations"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.post(f"{BASE_URL}/api/company/prime-configs/seed-defaults", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Prime seed result: {data['message']}")


class TestCompanyAdminStatistics:
    """Company Admin: Statistics module tests"""
    
    def test_get_agent_control_stats(self, company_admin_token):
        """Company Admin can get agent control statistics"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/statistics/agent-control", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert "period" in data
        print(f"Agent control stats: {len(data.get('agents', []))} agents")
        
    def test_get_tickets_by_agent(self, company_admin_token):
        """Company Admin can get tickets by agent stats"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/statistics/tickets-by-agent", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        print(f"Tickets by agent: {len(data.get('data', []))} entries")
        
    def test_get_winning_tickets_stats(self, company_admin_token):
        """Company Admin can get winning tickets statistics"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/statistics/winning-tickets", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_winners" in data
        assert "total_payout" in data
        print(f"Winning tickets: {data.get('total_winners')} winners, {data.get('total_payout')} payout")
        
    def test_get_tracability_logs(self, company_admin_token):
        """Company Admin can get audit trail (traçabilité)"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/statistics/tracability", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Audit logs: {len(data)} entries")
        
    def test_get_blocked_numbers(self, company_admin_token):
        """Company Admin can get blocked numbers"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/blocked-numbers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Blocked numbers: {len(data)} entries")
        
    def test_get_sales_limits(self, company_admin_token):
        """Company Admin can get sales limits"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/sales-limits", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Sales limits: {len(data)} entries")


class TestCompanyAdminDailyReports:
    """Company Admin: Daily Reports (Journalier) tests"""
    
    def test_get_daily_reports(self, company_admin_token):
        """Company Admin can get daily reports"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/daily-reports", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Daily reports: {len(data)} reports")
        
    def test_generate_daily_report(self, company_admin_token):
        """Company Admin can generate daily report"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/company/daily-reports/generate?report_date={today}",
            headers=headers
        )
        assert response.status_code == 200, f"Generate report failed: {response.text}"
        data = response.json()
        assert "report_date" in data
        assert "total_tickets" in data
        assert "total_sales" in data
        print(f"Generated report for {today}: {data.get('total_tickets')} tickets, {data.get('total_sales')} sales")


class TestSuperAdminCannotAccessCompanyRoutes:
    """Verify Super Admin isolation from company-specific resources"""
    
    def test_super_admin_cannot_access_company_branches(self, super_admin_token):
        """Super Admin should be denied access to company branches"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/branches", headers=headers)
        # Should fail because Super Admin has no company_id
        assert response.status_code in [403, 401], \
            f"Expected 403/401, got {response.status_code}. Super Admin should not access company routes."
        print("Confirmed: Super Admin blocked from company branches")


class TestCompanyAdminCannotAccessSuperAdminRoutes:
    """Verify Company Admin cannot access Super Admin routes"""
    
    def test_company_admin_cannot_access_super_lottery_catalog(self, company_admin_token):
        """Company Admin should be denied access to Super Admin lottery catalog"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/super/lottery-catalog", headers=headers)
        assert response.status_code == 403, \
            f"Expected 403, got {response.status_code}. Company Admin should not access Super Admin routes."
        print("Confirmed: Company Admin blocked from Super Admin lottery catalog")
        
    def test_company_admin_cannot_access_super_global_schedules(self, company_admin_token):
        """Company Admin should be denied access to Super Admin global schedules"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/super/global-schedules", headers=headers)
        assert response.status_code == 403
        print("Confirmed: Company Admin blocked from Super Admin global schedules")
        
    def test_company_admin_cannot_access_super_global_results(self, company_admin_token):
        """Company Admin should be denied access to Super Admin global results"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/super/global-results", headers=headers)
        assert response.status_code == 403
        print("Confirmed: Company Admin blocked from Super Admin global results")


# Run with: pytest test_rbac_and_new_features.py -v --tb=short
