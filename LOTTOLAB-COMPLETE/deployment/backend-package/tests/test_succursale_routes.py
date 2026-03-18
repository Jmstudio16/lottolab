"""
Test Succursale (Branch) Management Routes
Tests the new Company Admin restructure:
- Super Admin → Company Admin → Succursales → Agents
- Agents MUST belong to ONE succursale

Endpoints tested:
- GET /api/company/succursales - list all succursales
- POST /api/company/succursales - create succursale with supervisor
- GET /api/company/succursales/{id} - get succursale details with agents
- POST /api/company/succursales/{id}/agents - create agent WITHIN a succursale  
- DELETE /api/company/succursales/{id}/agents/{agent_id} - delete agent
- DELETE /api/company/succursales/{id} - delete succursale (only if no active agents)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin123!"
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"


class TestSuccursaleRoutes:
    """Test suite for Succursale management"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        """Login as Company Admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Company Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, company_admin_token):
        """Auth headers for Company Admin"""
        return {"Authorization": f"Bearer {company_admin_token}"}
    
    def test_01_get_all_succursales(self, auth_headers):
        """GET /api/company/succursales - returns list of succursales for company"""
        response = requests.get(f"{BASE_URL}/api/company/succursales", headers=auth_headers)
        
        assert response.status_code == 200, f"Get succursales failed: {response.text}"
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} succursales")
        
        # If there are succursales, verify structure
        if len(data) > 0:
            succ = data[0]
            assert "succursale_id" in succ, "Missing succursale_id"
            assert "nom_succursale" in succ, "Missing nom_succursale"
            assert "nom_bank" in succ, "Missing nom_bank"
            assert "status" in succ, "Missing status"
            assert "agent_count" in succ, "Missing agent_count"
            print(f"First succursale: {succ.get('nom_succursale')} - {succ.get('agent_count')} agents")
    
    def test_02_create_succursale_success(self, auth_headers):
        """POST /api/company/succursales - create succursale with supervisor"""
        unique_id = uuid.uuid4().hex[:6]
        
        payload = {
            "nom_succursale": f"TEST_Succursale_{unique_id}",
            "nom_bank": "Test Bank Central",
            "message": "Bienvenue dans notre succursale de test",
            "allow_sub_supervisor": True,
            "mariage_gratuit": False,
            "supervisor_nom": "TestSuper",
            "supervisor_prenom": "User",
            "supervisor_pseudo": f"testsup_{unique_id}",
            "supervisor_password": "TestPass123!",
            "supervisor_password_confirm": "TestPass123!"
        }
        
        response = requests.post(f"{BASE_URL}/api/company/succursales", 
                                 json=payload, headers=auth_headers)
        
        assert response.status_code == 200, f"Create succursale failed: {response.text}"
        data = response.json()
        
        assert "succursale_id" in data, "Missing succursale_id in response"
        assert "supervisor_id" in data, "Missing supervisor_id in response"
        assert "message" in data, "Missing message in response"
        assert data["message"] == "Succursale créée avec succès", f"Wrong message: {data['message']}"
        
        print(f"Created succursale: {data['succursale_id']}")
        print(f"Created supervisor: {data['supervisor_id']}")
        
        # Store for later tests
        TestSuccursaleRoutes.created_succursale_id = data["succursale_id"]
        TestSuccursaleRoutes.supervisor_pseudo = payload["supervisor_pseudo"]
    
    def test_03_create_succursale_password_mismatch(self, auth_headers):
        """POST /api/company/succursales - should fail with password mismatch"""
        unique_id = uuid.uuid4().hex[:6]
        
        payload = {
            "nom_succursale": f"TEST_Fail_{unique_id}",
            "nom_bank": "Test Bank",
            "supervisor_nom": "Test",
            "supervisor_prenom": "User",
            "supervisor_pseudo": f"testfail_{unique_id}",
            "supervisor_password": "Password123!",
            "supervisor_password_confirm": "DifferentPassword123!"  # Mismatch
        }
        
        response = requests.post(f"{BASE_URL}/api/company/succursales", 
                                 json=payload, headers=auth_headers)
        
        assert response.status_code == 400, f"Should fail with 400: {response.status_code}"
        data = response.json()
        assert "correspondent" in data["detail"].lower() or "password" in data["detail"].lower(), \
            f"Wrong error message: {data['detail']}"
        print(f"Correctly rejected: {data['detail']}")
    
    def test_04_get_succursale_detail(self, auth_headers):
        """GET /api/company/succursales/{id} - get succursale details with agents list"""
        succursale_id = getattr(TestSuccursaleRoutes, 'created_succursale_id', None)
        if not succursale_id:
            pytest.skip("No succursale created in previous test")
        
        response = requests.get(f"{BASE_URL}/api/company/succursales/{succursale_id}", 
                               headers=auth_headers)
        
        assert response.status_code == 200, f"Get succursale detail failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert data["succursale_id"] == succursale_id, "Wrong succursale_id"
        assert "nom_succursale" in data, "Missing nom_succursale"
        assert "nom_bank" in data, "Missing nom_bank"
        assert "agents" in data, "Missing agents list"
        assert isinstance(data["agents"], list), "Agents should be a list"
        assert "supervisor" in data or "supervisor_id" in data, "Missing supervisor info"
        
        print(f"Succursale details: {data['nom_succursale']}")
        print(f"Agents count: {len(data['agents'])}")
        print(f"Allow sub-supervisor: {data.get('allow_sub_supervisor')}")
        print(f"Mariage gratuit: {data.get('mariage_gratuit')}")
    
    def test_05_create_agent_in_succursale(self, auth_headers):
        """POST /api/company/succursales/{id}/agents - create agent WITHIN a succursale"""
        succursale_id = getattr(TestSuccursaleRoutes, 'created_succursale_id', None)
        if not succursale_id:
            pytest.skip("No succursale created in previous test")
        
        unique_id = uuid.uuid4().hex[:6]
        
        payload = {
            "device_id": f"DEV_{unique_id}",
            "zone_adresse": "Zone Test 123",
            "nom_agent": "TestAgent",
            "prenom_agent": "POS",
            "telephone": "+509-1234-5678",
            "identifiant": f"testagent_{unique_id}",
            "mot_de_passe": "AgentPass123!",
            "percent_agent": 5.0,
            "percent_superviseur": 2.0,
            "limite_credit": 25000.0,
            "limite_balance_gain": 50000.0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/agents",
            json=payload, 
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Create agent failed: {response.text}"
        data = response.json()
        
        assert "agent_id" in data, "Missing agent_id in response"
        assert "identifiant" in data, "Missing identifiant in response"
        assert data["succursale_id"] == succursale_id, "Wrong succursale_id"
        assert data["message"] == "Agent créé avec succès dans la succursale"
        
        print(f"Created agent: {data['agent_id']}")
        print(f"Identifiant: {data['identifiant']}")
        
        # Store for cleanup
        TestSuccursaleRoutes.created_agent_id = data["agent_id"]
        TestSuccursaleRoutes.agent_identifiant = payload["identifiant"]
    
    def test_06_verify_agent_in_succursale_detail(self, auth_headers):
        """Verify the created agent appears in succursale details"""
        succursale_id = getattr(TestSuccursaleRoutes, 'created_succursale_id', None)
        agent_id = getattr(TestSuccursaleRoutes, 'created_agent_id', None)
        
        if not succursale_id or not agent_id:
            pytest.skip("No succursale or agent created")
        
        response = requests.get(f"{BASE_URL}/api/company/succursales/{succursale_id}", 
                               headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Find our agent in the list
        agents = data.get("agents", [])
        our_agent = next((a for a in agents if a.get("user_id") == agent_id), None)
        
        assert our_agent is not None, f"Agent {agent_id} not found in succursale agents"
        assert our_agent["status"] == "ACTIVE", "Agent should be ACTIVE"
        
        print(f"Agent verified in succursale: {our_agent.get('name')}")
        print(f"Agent status: {our_agent.get('status')}")
    
    def test_07_create_agent_duplicate_device_id(self, auth_headers):
        """POST /api/company/succursales/{id}/agents - should fail with duplicate device_id"""
        succursale_id = getattr(TestSuccursaleRoutes, 'created_succursale_id', None)
        if not succursale_id:
            pytest.skip("No succursale created")
        
        # Try to use the same device_id as the first agent
        # First, get an existing device_id from the succursale
        response = requests.get(f"{BASE_URL}/api/company/succursales/{succursale_id}", 
                               headers=auth_headers)
        data = response.json()
        
        if not data.get("agents") or not data["agents"][0].get("device_id"):
            pytest.skip("No agents with device_id in succursale")
        
        existing_device_id = data["agents"][0]["device_id"]
        
        payload = {
            "device_id": existing_device_id,  # Duplicate
            "zone_adresse": "Zone Duplicate",
            "nom_agent": "Duplicate",
            "prenom_agent": "Agent",
            "telephone": "+509-9999-9999",
            "identifiant": f"dupagent_{uuid.uuid4().hex[:6]}",
            "mot_de_passe": "DupPass123!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/agents",
            json=payload, 
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Should fail with 400: {response.status_code}"
        assert "DEVICE ID" in response.json()["detail"], f"Wrong error: {response.text}"
        print(f"Correctly rejected duplicate device_id: {response.json()['detail']}")
    
    def test_08_delete_agent_from_succursale(self, auth_headers):
        """DELETE /api/company/succursales/{id}/agents/{agent_id} - delete agent works"""
        succursale_id = getattr(TestSuccursaleRoutes, 'created_succursale_id', None)
        agent_id = getattr(TestSuccursaleRoutes, 'created_agent_id', None)
        
        if not succursale_id or not agent_id:
            pytest.skip("No succursale or agent created")
        
        response = requests.delete(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/agents/{agent_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Delete agent failed: {response.text}"
        data = response.json()
        assert data["message"] == "Agent supprimé"
        
        print(f"Deleted agent: {agent_id}")
        
        # Verify agent no longer appears in active list
        response = requests.get(f"{BASE_URL}/api/company/succursales/{succursale_id}", 
                               headers=auth_headers)
        data = response.json()
        agents = data.get("agents", [])
        
        # Agent should not be in list (soft deleted)
        active_agent = next((a for a in agents if a.get("user_id") == agent_id), None)
        assert active_agent is None, "Deleted agent should not appear in active list"
        print("Agent confirmed removed from succursale")
    
    def test_09_delete_succursale_success(self, auth_headers):
        """DELETE /api/company/succursales/{id} - delete succursale (after agents removed)"""
        succursale_id = getattr(TestSuccursaleRoutes, 'created_succursale_id', None)
        
        if not succursale_id:
            pytest.skip("No succursale created")
        
        response = requests.delete(
            f"{BASE_URL}/api/company/succursales/{succursale_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Delete succursale failed: {response.text}"
        data = response.json()
        assert data["message"] == "Succursale supprimée"
        
        print(f"Deleted succursale: {succursale_id}")
    
    def test_10_delete_succursale_with_active_agents_fails(self, auth_headers):
        """DELETE /api/company/succursales/{id} - should fail if has active agents"""
        # First find a succursale with active agents
        response = requests.get(f"{BASE_URL}/api/company/succursales", headers=auth_headers)
        succursales = response.json()
        
        # Find one with agents
        succ_with_agents = next(
            (s for s in succursales if s.get("agent_count", 0) > 0 and s.get("status") == "ACTIVE"), 
            None
        )
        
        if not succ_with_agents:
            pytest.skip("No succursale with active agents to test")
        
        succursale_id = succ_with_agents["succursale_id"]
        
        response = requests.delete(
            f"{BASE_URL}/api/company/succursales/{succursale_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Should fail with 400: {response.status_code}"
        assert "agent" in response.json()["detail"].lower(), f"Wrong error: {response.text}"
        print(f"Correctly rejected: {response.json()['detail']}")


class TestSuccursaleReports:
    """Test succursale reports endpoint"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        """Login as Company Admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, company_admin_token):
        return {"Authorization": f"Bearer {company_admin_token}"}
    
    def test_get_succursale_reports(self, auth_headers):
        """GET /api/company/succursales/{id}/reports - get sales report for succursale"""
        # First get a succursale
        response = requests.get(f"{BASE_URL}/api/company/succursales", headers=auth_headers)
        succursales = response.json()
        
        if not succursales:
            pytest.skip("No succursales to test reports")
        
        succursale_id = succursales[0]["succursale_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/reports",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Get reports failed: {response.text}"
        data = response.json()
        
        # Verify report structure
        assert "succursale_id" in data
        assert "nom_succursale" in data
        assert "total_sales" in data
        assert "total_tickets" in data
        assert "total_winnings" in data
        assert "by_agent" in data
        
        print(f"Report for: {data['nom_succursale']}")
        print(f"Total sales: {data['total_sales']}")
        print(f"Total tickets: {data['total_tickets']}")


class TestUnauthorizedAccess:
    """Test authorization checks"""
    
    def test_access_without_auth(self):
        """Should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/company/succursales")
        # Should be 401 or 403
        assert response.status_code in [401, 403], f"Should deny access: {response.status_code}"
        print(f"Correctly denied unauthorized access: {response.status_code}")
    
    def test_access_with_invalid_token(self):
        """Should return 401 with invalid token"""
        headers = {"Authorization": "Bearer invalid_token_123"}
        response = requests.get(f"{BASE_URL}/api/company/succursales", headers=headers)
        assert response.status_code == 401, f"Should return 401: {response.status_code}"
        print("Correctly rejected invalid token")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
