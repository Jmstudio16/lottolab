"""
Iteration 55: Testing New Features
- POST /api/saas/master-lotteries - Création de loterie par Super Admin
- GET /api/saas/master-lotteries - Liste des loteries
- PUT /api/company/succursales/{id}/supervisor - Modification superviseur (email, mot de passe)
- GET /api/company/succursales/{id}/supervisor/credentials - Obtenir infos superviseur
- PUT /api/company/succursales/{id}/agents/{agent_id}/full - Modification agent (email, mot de passe)
- GET /api/company/succursales/{id}/agents/{agent_id}/credentials - Obtenir infos agent
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "LotoPAM2026!"


class TestSuperAdminAuth:
    """Test Super Admin authentication"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")  # API returns "token" not "access_token"
        pytest.skip(f"Super Admin login failed: {response.status_code}")
    
    def test_super_admin_login(self, super_admin_token):
        """Verify Super Admin can login"""
        assert super_admin_token is not None
        print(f"✓ Super Admin login successful")


class TestMasterLotteries:
    """Test Master Lotteries CRUD - Super Admin only"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")  # API returns "token" not "access_token"
        pytest.skip(f"Super Admin login failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def headers(self, super_admin_token):
        return {"Authorization": f"Bearer {super_admin_token}"}
    
    def test_get_master_lotteries(self, headers):
        """GET /api/saas/master-lotteries - List all master lotteries"""
        response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET master-lotteries: {len(data)} lotteries found")
    
    def test_create_master_lottery(self, headers):
        """POST /api/saas/master-lotteries - Create new lottery"""
        unique_id = uuid.uuid4().hex[:6]
        lottery_data = {
            "lottery_name": f"TEST_Lottery_{unique_id}",
            "state_code": f"T{unique_id[:2].upper()}",
            "state_name": f"Test State {unique_id}",
            "country": "HAITI",
            "game_type": "BORLETTE",
            "category": "STANDARD",
            "default_draw_times": ["12:00", "19:00"],
            "description": "Test lottery created by automated test",
            "is_active_global": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/saas/master-lotteries",
            json=lottery_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "lottery_id" in data
        assert data.get("message") == "Loterie créée"
        print(f"✓ POST master-lotteries: Created lottery {data['lottery_id']}")
        
        # Store for cleanup
        return data["lottery_id"]
    
    def test_create_lottery_validation(self, headers):
        """POST /api/saas/master-lotteries - Validation errors"""
        # Missing required fields
        response = requests.post(
            f"{BASE_URL}/api/saas/master-lotteries",
            json={"lottery_name": "Test"},  # Missing state_code, state_name, game_type
            headers=headers
        )
        assert response.status_code == 422  # Validation error
        print(f"✓ POST master-lotteries validation: Returns 422 for missing fields")
    
    def test_get_single_lottery(self, headers):
        """GET /api/saas/master-lotteries/{id} - Get single lottery"""
        # First get list to find a lottery
        list_response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=headers)
        lotteries = list_response.json()
        
        if len(lotteries) > 0:
            lottery_id = lotteries[0].get("lottery_id")
            response = requests.get(f"{BASE_URL}/api/saas/master-lotteries/{lottery_id}", headers=headers)
            assert response.status_code == 200
            data = response.json()
            assert data.get("lottery_id") == lottery_id
            print(f"✓ GET single lottery: {data.get('lottery_name')}")
        else:
            pytest.skip("No lotteries to test")
    
    def test_update_master_lottery(self, headers):
        """PUT /api/saas/master-lotteries/{id} - Update lottery"""
        # First create a lottery to update
        unique_id = uuid.uuid4().hex[:6]
        create_response = requests.post(
            f"{BASE_URL}/api/saas/master-lotteries",
            json={
                "lottery_name": f"TEST_Update_{unique_id}",
                "state_code": f"U{unique_id[:2].upper()}",
                "state_name": f"Update State {unique_id}",
                "country": "HAITI",
                "game_type": "LOTO3",
                "category": "STANDARD",
                "is_active_global": True
            },
            headers=headers
        )
        
        if create_response.status_code == 200:
            lottery_id = create_response.json()["lottery_id"]
            
            # Update the lottery
            update_response = requests.put(
                f"{BASE_URL}/api/saas/master-lotteries/{lottery_id}",
                json={
                    "lottery_name": f"TEST_Updated_{unique_id}",
                    "category": "PREMIUM",
                    "description": "Updated description"
                },
                headers=headers
            )
            
            assert update_response.status_code == 200
            assert update_response.json().get("message") == "Loterie mise à jour"
            print(f"✓ PUT master-lotteries: Updated lottery {lottery_id}")
        else:
            pytest.skip("Could not create lottery to update")


class TestCompanyAdminAuth:
    """Test Company Admin authentication"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        """Get Company Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")  # API returns "token" not "access_token"
        pytest.skip(f"Company Admin login failed: {response.status_code}")
    
    def test_company_admin_login(self, company_admin_token):
        """Verify Company Admin can login"""
        assert company_admin_token is not None
        print(f"✓ Company Admin login successful")


class TestSuccursaleSupervisorManagement:
    """Test Supervisor modification endpoints"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        """Get Company Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")  # API returns "token" not "access_token"
        pytest.skip(f"Company Admin login failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def headers(self, company_admin_token):
        return {"Authorization": f"Bearer {company_admin_token}"}
    
    @pytest.fixture(scope="class")
    def test_succursale(self, headers):
        """Create a fresh test succursale with valid supervisor"""
        # Always create a new succursale for testing to ensure supervisor exists
        unique_id = uuid.uuid4().hex[:6]
        create_response = requests.post(
            f"{BASE_URL}/api/company/succursales",
            json={
                "supervisor_nom": "TestSupervisor",
                "supervisor_prenom": "Test",
                "supervisor_email": f"test_supervisor_{unique_id}@test.com",
                "supervisor_telephone": "+509-1234-5678",
                "supervisor_password": "TestPass123!",
                "supervisor_password_confirm": "TestPass123!",
                "supervisor_commission_percent": 10,
                "allow_sub_supervisor": False,
                "superviseur_principal": True,
                "mariage_gratuit": False,
                "nom_succursale": f"Test Succursale {unique_id}",
                "nom_bank": f"Test Bank {unique_id}",
                "message": "Test message"
            },
            headers=headers
        )
        
        if create_response.status_code == 200:
            succursale_id = create_response.json()["succursale_id"]
            # Fetch the full succursale
            detail_response = requests.get(
                f"{BASE_URL}/api/company/succursales/{succursale_id}",
                headers=headers
            )
            if detail_response.status_code == 200:
                return detail_response.json()
        
        pytest.skip(f"Could not create test succursale: {create_response.status_code} - {create_response.text}")
    
    def test_get_succursales_list(self, headers):
        """GET /api/company/succursales - List all succursales"""
        response = requests.get(f"{BASE_URL}/api/company/succursales", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET succursales: {len(data)} succursales found")
    
    def test_get_supervisor_credentials(self, headers, test_succursale):
        """GET /api/company/succursales/{id}/supervisor/credentials"""
        succursale_id = test_succursale.get("succursale_id")
        
        response = requests.get(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/supervisor/credentials",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "user_id" in data
        assert "email" in data
        assert "name" in data
        assert "has_password" in data
        assert data["has_password"] == True
        
        print(f"✓ GET supervisor credentials: {data.get('email')}")
    
    def test_update_supervisor_name(self, headers, test_succursale):
        """PUT /api/company/succursales/{id}/supervisor - Update name"""
        succursale_id = test_succursale.get("succursale_id")
        
        response = requests.put(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/supervisor",
            json={
                "supervisor_nom": "UpdatedNom",
                "supervisor_prenom": "UpdatedPrenom"
            },
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ PUT supervisor name update: {data.get('message')}")
    
    def test_update_supervisor_email(self, headers, test_succursale):
        """PUT /api/company/succursales/{id}/supervisor - Update email"""
        succursale_id = test_succursale.get("succursale_id")
        unique_id = uuid.uuid4().hex[:6]
        new_email = f"updated_supervisor_{unique_id}@test.com"
        
        response = requests.put(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/supervisor",
            json={
                "supervisor_email": new_email
            },
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("email_changed") == True
        print(f"✓ PUT supervisor email update: Changed to {new_email}")
    
    def test_update_supervisor_password(self, headers, test_succursale):
        """PUT /api/company/succursales/{id}/supervisor - Update password"""
        succursale_id = test_succursale.get("succursale_id")
        
        response = requests.put(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/supervisor",
            json={
                "supervisor_password": "NewPassword123!",
                "supervisor_password_confirm": "NewPassword123!"
            },
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("password_changed") == True
        print(f"✓ PUT supervisor password update: Password changed")
    
    def test_update_supervisor_password_mismatch(self, headers, test_succursale):
        """PUT /api/company/succursales/{id}/supervisor - Password mismatch error"""
        succursale_id = test_succursale.get("succursale_id")
        
        response = requests.put(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/supervisor",
            json={
                "supervisor_password": "Password1",
                "supervisor_password_confirm": "Password2"
            },
            headers=headers
        )
        
        assert response.status_code == 400
        assert "correspondent" in response.json().get("detail", "").lower()
        print(f"✓ PUT supervisor password mismatch: Returns 400")


class TestSuccursaleAgentManagement:
    """Test Agent modification endpoints"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        """Get Company Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")  # API returns "token" not "access_token"
        pytest.skip(f"Company Admin login failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def headers(self, company_admin_token):
        return {"Authorization": f"Bearer {company_admin_token}"}
    
    @pytest.fixture(scope="class")
    def test_succursale_with_agent(self, headers):
        """Get or create a succursale with an agent"""
        # Get existing succursales
        response = requests.get(f"{BASE_URL}/api/company/succursales", headers=headers)
        if response.status_code == 200:
            succursales = response.json()
            for succ in succursales:
                # Get detail to check for agents
                detail_response = requests.get(
                    f"{BASE_URL}/api/company/succursales/{succ['succursale_id']}",
                    headers=headers
                )
                if detail_response.status_code == 200:
                    detail = detail_response.json()
                    if detail.get("agents") and len(detail["agents"]) > 0:
                        return detail
        
        # Need to create a succursale with an agent
        unique_id = uuid.uuid4().hex[:6]
        
        # Create succursale
        create_succ_response = requests.post(
            f"{BASE_URL}/api/company/succursales",
            json={
                "supervisor_nom": "AgentTestSupervisor",
                "supervisor_prenom": "Test",
                "supervisor_email": f"agent_test_supervisor_{unique_id}@test.com",
                "supervisor_telephone": "+509-1234-5678",
                "supervisor_password": "TestPass123!",
                "supervisor_password_confirm": "TestPass123!",
                "supervisor_commission_percent": 10,
                "allow_sub_supervisor": False,
                "superviseur_principal": True,
                "mariage_gratuit": False,
                "nom_succursale": f"Agent Test Succursale {unique_id}",
                "nom_bank": f"Agent Test Bank {unique_id}",
                "message": "Test message"
            },
            headers=headers
        )
        
        if create_succ_response.status_code != 200:
            pytest.skip("Could not create test succursale")
        
        succursale_id = create_succ_response.json()["succursale_id"]
        
        # Create agent in the succursale
        create_agent_response = requests.post(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/agents",
            json={
                "nom_agent": "TestAgent",
                "prenom_agent": "Test",
                "email": f"test_agent_{unique_id}@test.com",
                "telephone": "+509-9876-5432",
                "password": "AgentPass123!",
                "password_confirm": "AgentPass123!",
                "commission_percent": 5,
                "limite_credit": 50000,
                "limite_gain": 100000,
                "status": "ACTIVE"
            },
            headers=headers
        )
        
        if create_agent_response.status_code != 200:
            pytest.skip("Could not create test agent")
        
        # Fetch the full succursale with agent
        detail_response = requests.get(
            f"{BASE_URL}/api/company/succursales/{succursale_id}",
            headers=headers
        )
        
        if detail_response.status_code == 200:
            return detail_response.json()
        
        pytest.skip("Could not get succursale with agent")
    
    def test_get_agent_credentials(self, headers, test_succursale_with_agent):
        """GET /api/company/succursales/{id}/agents/{agent_id}/credentials"""
        succursale_id = test_succursale_with_agent.get("succursale_id")
        agents = test_succursale_with_agent.get("agents", [])
        
        if len(agents) == 0:
            pytest.skip("No agents in test succursale")
        
        agent_id = agents[0].get("user_id")
        
        response = requests.get(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/agents/{agent_id}/credentials",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "user_id" in data
        assert "email" in data
        assert "name" in data
        assert "has_password" in data
        assert "commission_percent" in data
        assert "limite_credit" in data
        assert "limite_gain" in data
        
        print(f"✓ GET agent credentials: {data.get('email')}")
    
    def test_update_agent_full_name(self, headers, test_succursale_with_agent):
        """PUT /api/company/succursales/{id}/agents/{agent_id}/full - Update name"""
        succursale_id = test_succursale_with_agent.get("succursale_id")
        agents = test_succursale_with_agent.get("agents", [])
        
        if len(agents) == 0:
            pytest.skip("No agents in test succursale")
        
        agent_id = agents[0].get("user_id")
        
        response = requests.put(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/agents/{agent_id}/full",
            json={
                "nom_agent": "UpdatedAgentNom",
                "prenom_agent": "UpdatedAgentPrenom"
            },
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ PUT agent full name update: {data.get('message')}")
    
    def test_update_agent_full_email(self, headers, test_succursale_with_agent):
        """PUT /api/company/succursales/{id}/agents/{agent_id}/full - Update email"""
        succursale_id = test_succursale_with_agent.get("succursale_id")
        agents = test_succursale_with_agent.get("agents", [])
        
        if len(agents) == 0:
            pytest.skip("No agents in test succursale")
        
        agent_id = agents[0].get("user_id")
        unique_id = uuid.uuid4().hex[:6]
        new_email = f"updated_agent_{unique_id}@test.com"
        
        response = requests.put(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/agents/{agent_id}/full",
            json={
                "email": new_email
            },
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("email_changed") == True
        print(f"✓ PUT agent full email update: Changed to {new_email}")
    
    def test_update_agent_full_password(self, headers, test_succursale_with_agent):
        """PUT /api/company/succursales/{id}/agents/{agent_id}/full - Update password"""
        succursale_id = test_succursale_with_agent.get("succursale_id")
        agents = test_succursale_with_agent.get("agents", [])
        
        if len(agents) == 0:
            pytest.skip("No agents in test succursale")
        
        agent_id = agents[0].get("user_id")
        
        response = requests.put(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/agents/{agent_id}/full",
            json={
                "password": "NewAgentPassword123!",
                "password_confirm": "NewAgentPassword123!"
            },
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("password_changed") == True
        print(f"✓ PUT agent full password update: Password changed")
    
    def test_update_agent_full_financial(self, headers, test_succursale_with_agent):
        """PUT /api/company/succursales/{id}/agents/{agent_id}/full - Update financial settings"""
        succursale_id = test_succursale_with_agent.get("succursale_id")
        agents = test_succursale_with_agent.get("agents", [])
        
        if len(agents) == 0:
            pytest.skip("No agents in test succursale")
        
        agent_id = agents[0].get("user_id")
        
        response = requests.put(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/agents/{agent_id}/full",
            json={
                "commission_percent": 7.5,
                "limite_credit": 75000,
                "limite_gain": 150000
            },
            headers=headers
        )
        
        assert response.status_code == 200
        print(f"✓ PUT agent full financial update: Commission, credit limit, gain limit updated")
    
    def test_update_agent_full_password_mismatch(self, headers, test_succursale_with_agent):
        """PUT /api/company/succursales/{id}/agents/{agent_id}/full - Password mismatch error"""
        succursale_id = test_succursale_with_agent.get("succursale_id")
        agents = test_succursale_with_agent.get("agents", [])
        
        if len(agents) == 0:
            pytest.skip("No agents in test succursale")
        
        agent_id = agents[0].get("user_id")
        
        response = requests.put(
            f"{BASE_URL}/api/company/succursales/{succursale_id}/agents/{agent_id}/full",
            json={
                "password": "Password1",
                "password_confirm": "Password2"
            },
            headers=headers
        )
        
        assert response.status_code == 400
        assert "correspondent" in response.json().get("detail", "").lower()
        print(f"✓ PUT agent full password mismatch: Returns 400")


class TestAccessControl:
    """Test access control - Company Admin cannot access Super Admin endpoints"""
    
    @pytest.fixture(scope="class")
    def company_admin_token(self):
        """Get Company Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")  # API returns "token" not "access_token"
        pytest.skip(f"Company Admin login failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def headers(self, company_admin_token):
        return {"Authorization": f"Bearer {company_admin_token}"}
    
    def test_company_admin_cannot_create_master_lottery(self, headers):
        """Company Admin should not be able to create master lotteries"""
        response = requests.post(
            f"{BASE_URL}/api/saas/master-lotteries",
            json={
                "lottery_name": "Unauthorized Lottery",
                "state_code": "UNA",
                "state_name": "Unauthorized State",
                "country": "HAITI",
                "game_type": "BORLETTE"
            },
            headers=headers
        )
        
        assert response.status_code == 403
        print(f"✓ Company Admin cannot create master lottery: Returns 403")
    
    def test_company_admin_can_read_master_lotteries(self, headers):
        """Company Admin should be able to read master lotteries"""
        response = requests.get(f"{BASE_URL}/api/saas/master-lotteries", headers=headers)
        
        # Company Admin can read but only active ones
        assert response.status_code == 200
        print(f"✓ Company Admin can read master lotteries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
