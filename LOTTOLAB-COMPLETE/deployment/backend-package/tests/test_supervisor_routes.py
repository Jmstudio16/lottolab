"""
Test Supervisor Routes - Testing supervisor endpoints for agent management, tickets, and sales reports
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

SUPERVISOR_EMAIL = "supervisor@lotopam.com"
SUPERVISOR_PASSWORD = "Supervisor123!"

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def supervisor_token(api_client):
    """Get supervisor authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERVISOR_EMAIL,
        "password": SUPERVISOR_PASSWORD
    })
    assert response.status_code == 200, f"Supervisor login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in response"
    assert data.get("user", {}).get("role") == "BRANCH_SUPERVISOR", "User is not a supervisor"
    return data["token"]

@pytest.fixture
def authenticated_supervisor(api_client, supervisor_token):
    """Session with supervisor auth header"""
    api_client.headers.update({"Authorization": f"Bearer {supervisor_token}"})
    return api_client


class TestSupervisorLogin:
    """Test supervisor login and authentication"""
    
    def test_supervisor_login_success(self, api_client):
        """Test supervisor can login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERVISOR_EMAIL,
            "password": SUPERVISOR_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "BRANCH_SUPERVISOR"
        assert data["user"]["email"] == SUPERVISOR_EMAIL
        assert "redirect_path" in data
    
    def test_supervisor_login_invalid_password(self, api_client):
        """Test login fails with invalid password"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERVISOR_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400]


class TestSupervisorDashboardStats:
    """Test supervisor dashboard statistics endpoint"""
    
    def test_get_dashboard_stats(self, authenticated_supervisor):
        """Test GET /api/supervisor/dashboard-stats returns correct structure"""
        response = authenticated_supervisor.get(f"{BASE_URL}/api/supervisor/dashboard-stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_agents" in data
        assert "active_agents" in data
        assert "suspended_agents" in data
        assert "tickets_today" in data
        
        # Verify data types
        assert isinstance(data["total_agents"], int)
        assert isinstance(data["active_agents"], int)
        assert isinstance(data["suspended_agents"], int)
        assert isinstance(data["tickets_today"], int)
        
        # Verify logical consistency
        assert data["total_agents"] >= 0
        assert data["active_agents"] >= 0
        assert data["suspended_agents"] >= 0
        assert data["total_agents"] == data["active_agents"] + data["suspended_agents"]
    
    def test_dashboard_stats_requires_auth(self, api_client):
        """Test endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/supervisor/dashboard-stats")
        assert response.status_code in [401, 403]


class TestSupervisorAgents:
    """Test supervisor agents management endpoints"""
    
    def test_get_agents_list(self, authenticated_supervisor):
        """Test GET /api/supervisor/agents returns list of agents"""
        response = authenticated_supervisor.get(f"{BASE_URL}/api/supervisor/agents")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        
        if len(data) > 0:
            agent = data[0]
            # Verify agent structure
            assert "user_id" in agent
            assert "email" in agent
            assert "name" in agent or "full_name" in agent
            assert "role" in agent
            assert "status" in agent
            assert agent["role"] == "AGENT_POS"
    
    def test_get_agents_requires_auth(self, api_client):
        """Test endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/supervisor/agents")
        assert response.status_code in [401, 403]
    
    def test_get_agent_tickets(self, authenticated_supervisor):
        """Test GET /api/supervisor/agents/{agent_id}/tickets returns tickets"""
        # First get agents
        agents_response = authenticated_supervisor.get(f"{BASE_URL}/api/supervisor/agents")
        assert agents_response.status_code == 200
        agents = agents_response.json()
        
        if len(agents) > 0:
            agent_id = agents[0]["user_id"]
            
            # Get tickets for this agent
            tickets_response = authenticated_supervisor.get(
                f"{BASE_URL}/api/supervisor/agents/{agent_id}/tickets"
            )
            assert tickets_response.status_code == 200
            tickets = tickets_response.json()
            
            assert isinstance(tickets, list)
            
            if len(tickets) > 0:
                ticket = tickets[0]
                # Verify ticket structure
                assert "ticket_id" in ticket or "transaction_id" in ticket
                assert "ticket_code" in ticket
                assert "total_amount" in ticket
                assert "status" in ticket
                assert "created_at" in ticket


class TestSupervisorMyProfile:
    """Test supervisor profile endpoint"""
    
    def test_get_my_profile(self, authenticated_supervisor):
        """Test GET /api/supervisor/my-profile returns profile with commission"""
        response = authenticated_supervisor.get(f"{BASE_URL}/api/supervisor/my-profile")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "user_id" in data
        assert "name" in data
        assert "email" in data
        assert "role" in data
        assert "company_id" in data
        assert "commission_percent" in data
        assert "status" in data
        
        # Verify role
        assert data["role"] == "BRANCH_SUPERVISOR"
        
        # Verify commission is a valid percentage
        assert isinstance(data["commission_percent"], (int, float))
        assert 0 <= data["commission_percent"] <= 100
    
    def test_my_profile_requires_auth(self, api_client):
        """Test endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/supervisor/my-profile")
        assert response.status_code in [401, 403]


class TestSupervisorSalesReport:
    """Test supervisor sales report endpoint"""
    
    def test_get_sales_report(self, authenticated_supervisor):
        """Test GET /api/supervisor/sales-report returns detailed report"""
        response = authenticated_supervisor.get(f"{BASE_URL}/api/supervisor/sales-report")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "supervisor_commission" in data
        assert "agents" in data
        assert "totals" in data
        
        # Verify supervisor commission
        assert isinstance(data["supervisor_commission"], (int, float))
        assert 0 <= data["supervisor_commission"] <= 100
        
        # Verify agents list
        assert isinstance(data["agents"], list)
        
        if len(data["agents"]) > 0:
            agent_report = data["agents"][0]
            # Verify agent report structure
            assert "agent_id" in agent_report
            assert "agent_name" in agent_report
            assert "total_tickets" in agent_report
            assert "tickets_gagnants" in agent_report
            assert "total_ventes" in agent_report
            assert "total_paye" in agent_report
            assert "pourcentage_agent" in agent_report
            assert "comm_agent" in agent_report
            assert "pourcentage_sup" in agent_report
            assert "comm_sup" in agent_report
            assert "balance_final" in agent_report
        
        # Verify totals structure
        totals = data["totals"]
        assert "total_tickets" in totals
        assert "total_gagnants" in totals
        assert "total_ventes" in totals
        assert "total_paye" in totals
        assert "total_comm_agent" in totals
        assert "total_comm_sup" in totals
        assert "balance_final" in totals
    
    def test_sales_report_with_date_filter(self, authenticated_supervisor):
        """Test sales report with date range filter"""
        response = authenticated_supervisor.get(
            f"{BASE_URL}/api/supervisor/sales-report",
            params={
                "date_from": "2026-01-01",
                "date_to": "2026-12-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "date_from" in data
        assert "date_to" in data
        assert data["date_from"] == "2026-01-01"
        assert data["date_to"] == "2026-12-31"
    
    def test_sales_report_requires_auth(self, api_client):
        """Test endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/supervisor/sales-report")
        assert response.status_code in [401, 403]


class TestSupervisorAgentActions:
    """Test supervisor agent management actions (suspend/activate)"""
    
    def test_suspend_agent(self, authenticated_supervisor):
        """Test PUT /api/supervisor/agents/{agent_id}/suspend"""
        # First get agents
        agents_response = authenticated_supervisor.get(f"{BASE_URL}/api/supervisor/agents")
        assert agents_response.status_code == 200
        agents = agents_response.json()
        
        active_agents = [a for a in agents if a.get("status") == "ACTIVE"]
        
        if len(active_agents) > 0:
            agent_id = active_agents[0]["user_id"]
            
            # Suspend the agent
            suspend_response = authenticated_supervisor.put(
                f"{BASE_URL}/api/supervisor/agents/{agent_id}/suspend"
            )
            assert suspend_response.status_code == 200
            assert "suspendu" in suspend_response.json().get("message", "").lower() or "message" in suspend_response.json()
            
            # Reactivate the agent to restore state
            activate_response = authenticated_supervisor.put(
                f"{BASE_URL}/api/supervisor/agents/{agent_id}/activate"
            )
            assert activate_response.status_code == 200
        else:
            pytest.skip("No active agents available to test suspend")
    
    def test_activate_agent(self, authenticated_supervisor):
        """Test PUT /api/supervisor/agents/{agent_id}/activate"""
        # First get agents
        agents_response = authenticated_supervisor.get(f"{BASE_URL}/api/supervisor/agents")
        assert agents_response.status_code == 200
        agents = agents_response.json()
        
        if len(agents) > 0:
            agent_id = agents[0]["user_id"]
            original_status = agents[0].get("status")
            
            # Activate the agent (works even if already active)
            activate_response = authenticated_supervisor.put(
                f"{BASE_URL}/api/supervisor/agents/{agent_id}/activate"
            )
            assert activate_response.status_code == 200
            
            # Verify agent is active
            verify_response = authenticated_supervisor.get(f"{BASE_URL}/api/supervisor/agents")
            updated_agents = verify_response.json()
            updated_agent = next((a for a in updated_agents if a["user_id"] == agent_id), None)
            assert updated_agent is not None
            assert updated_agent["status"] == "ACTIVE"
        else:
            pytest.skip("No agents available to test activate")
    
    def test_update_agent_info(self, authenticated_supervisor):
        """Test PUT /api/supervisor/agents/{agent_id} - update agent details"""
        # First get agents
        agents_response = authenticated_supervisor.get(f"{BASE_URL}/api/supervisor/agents")
        assert agents_response.status_code == 200
        agents = agents_response.json()
        
        if len(agents) > 0:
            agent = agents[0]
            agent_id = agent["user_id"]
            original_commission = agent.get("commission_percent", 10)
            
            # Update commission
            new_commission = 15 if original_commission != 15 else 12
            update_response = authenticated_supervisor.put(
                f"{BASE_URL}/api/supervisor/agents/{agent_id}",
                json={"commission_percent": new_commission}
            )
            assert update_response.status_code == 200
            
            # Restore original commission
            restore_response = authenticated_supervisor.put(
                f"{BASE_URL}/api/supervisor/agents/{agent_id}",
                json={"commission_percent": original_commission}
            )
            assert restore_response.status_code == 200
        else:
            pytest.skip("No agents available to test update")


class TestSupervisorAccessControl:
    """Test that non-supervisors cannot access supervisor endpoints"""
    
    def test_company_admin_cannot_access_supervisor_endpoints(self, api_client):
        """Test company admin cannot access supervisor endpoints"""
        # Login as company admin
        login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@lotopam.com",
            "password": "Admin123!"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Company admin login not available")
        
        token = login_response.json().get("token")
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try to access supervisor endpoints
        response = api_client.get(f"{BASE_URL}/api/supervisor/agents")
        assert response.status_code == 403, "Company admin should not access supervisor endpoints"
