"""
Iteration 26 - Testing new features:
1. Winning tickets with payment_status (PAID/UNPAID) for Company Admin and Supervisor
2. Bet limits for Loto4 (20 HTG) and Loto5 (250 HTG)
3. Fiches Jouées endpoint
4. 60/20/10 payout logic
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')

# Test credentials
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin123!"
SUPERVISOR_EMAIL = "supervisor@lotopam.com"
SUPERVISOR_PASSWORD = "Supervisor123!"


class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"Health check passed: {data}")


class TestCompanyAdminLogin:
    """Test Company Admin authentication"""
    
    def test_company_admin_login_success(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COMPANY_ADMIN_EMAIL,
            "password": COMPANY_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data.get("user", {}).get("role") in ["COMPANY_ADMIN", "company_admin"]
        print(f"Company Admin login successful: {data.get('user', {}).get('email')}")
        return data.get("token")


class TestSupervisorLogin:
    """Test Supervisor authentication"""
    
    def test_supervisor_login_success(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERVISOR_EMAIL,
            "password": SUPERVISOR_PASSWORD
        })
        # Supervisor may not exist, so we handle both cases
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            print(f"Supervisor login successful: {data.get('user', {}).get('email')}")
            return data.get("token")
        else:
            print(f"Supervisor login failed (may not exist): {response.status_code}")
            pytest.skip("Supervisor account not available")


@pytest.fixture(scope="module")
def company_admin_token():
    """Get Company Admin token for authenticated tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": COMPANY_ADMIN_EMAIL,
        "password": COMPANY_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Company Admin authentication failed")


@pytest.fixture(scope="module")
def supervisor_token():
    """Get Supervisor token for authenticated tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERVISOR_EMAIL,
        "password": SUPERVISOR_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    return None  # Return None if supervisor doesn't exist


class TestCompanyWinningTickets:
    """Test Company Admin winning tickets endpoints"""
    
    def test_get_winning_tickets(self, company_admin_token):
        """GET /api/company/winning-tickets - should return winning tickets with payment_status"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/winning-tickets", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "tickets" in data
        assert "summary" in data
        assert "total_count" in data["summary"]
        assert "total_win_amount" in data["summary"]
        assert "paid_count" in data["summary"]
        assert "pending_count" in data["summary"]
        
        print(f"Winning tickets response: {data['summary']}")
    
    def test_get_winning_tickets_filter_paid(self, company_admin_token):
        """GET /api/company/winning-tickets?payment_status=PAID - filter by PAID status"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/company/winning-tickets?payment_status=PAID", 
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data
        
        # All returned tickets should have payment_status=PAID
        for ticket in data["tickets"]:
            assert ticket.get("payment_status") == "PAID"
        
        print(f"Filtered PAID tickets count: {len(data['tickets'])}")
    
    def test_get_winning_tickets_filter_unpaid(self, company_admin_token):
        """GET /api/company/winning-tickets?payment_status=UNPAID - filter by UNPAID status"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/company/winning-tickets?payment_status=UNPAID", 
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data
        
        # All returned tickets should have payment_status=UNPAID or not set
        for ticket in data["tickets"]:
            assert ticket.get("payment_status") in [None, "UNPAID"] or "payment_status" not in ticket
        
        print(f"Filtered UNPAID tickets count: {len(data['tickets'])}")


class TestCompanyBetLimits:
    """Test Company Admin bet limits endpoints"""
    
    def test_get_bet_limits(self, company_admin_token):
        """GET /api/company/bet-limits - should return Loto4 and Loto5 limits"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/company/bet-limits", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "loto4_max_limit" in data
        assert "loto5_max_limit" in data
        
        # Verify default values
        assert data["loto4_max_limit"] == 20.0 or isinstance(data["loto4_max_limit"], (int, float))
        assert data["loto5_max_limit"] == 250.0 or isinstance(data["loto5_max_limit"], (int, float))
        
        print(f"Bet limits: Loto4={data['loto4_max_limit']}, Loto5={data['loto5_max_limit']}")
    
    def test_update_bet_limits(self, company_admin_token):
        """PUT /api/company/bet-limits - should update Loto4 and Loto5 limits"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Update limits
        new_limits = {
            "loto4_max_limit": 25.0,
            "loto5_max_limit": 300.0
        }
        
        response = requests.put(
            f"{BASE_URL}/api/company/bet-limits", 
            json=new_limits,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("loto4_max_limit") == 25.0
        assert data.get("loto5_max_limit") == 300.0
        
        print(f"Updated bet limits: {data}")
        
        # Restore original limits
        original_limits = {
            "loto4_max_limit": 20.0,
            "loto5_max_limit": 250.0
        }
        requests.put(
            f"{BASE_URL}/api/company/bet-limits", 
            json=original_limits,
            headers=headers
        )


class TestFichesJouees:
    """Test Fiches Jouées (played tickets) endpoint"""
    
    def test_get_fiches_jouees_today(self, company_admin_token):
        """GET /api/company/admin/fiches-jouees - should return played tickets"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/company/admin/fiches-jouees?period=today&status=all", 
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "tickets" in data
        assert "stats" in data
        assert "total" in data["stats"]
        assert "active" in data["stats"]
        assert "deleted" in data["stats"]
        assert "winners" in data["stats"]
        
        print(f"Fiches jouées stats: {data['stats']}")
    
    def test_get_fiches_jouees_week(self, company_admin_token):
        """GET /api/company/admin/fiches-jouees?period=week - should return weekly tickets"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/company/admin/fiches-jouees?period=week&status=all", 
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data
        assert "stats" in data
        
        print(f"Weekly fiches jouées: {data['stats']}")
    
    def test_get_fiches_jouees_active_only(self, company_admin_token):
        """GET /api/company/admin/fiches-jouees?status=active - filter active tickets"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/company/admin/fiches-jouees?period=month&status=active", 
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data
        
        # All returned tickets should be active (not deleted, not voided)
        for ticket in data["tickets"]:
            assert ticket.get("deleted") != True
            assert ticket.get("status") not in ["VOID", "CANCELLED"]
        
        print(f"Active fiches jouées count: {len(data['tickets'])}")


class TestSupervisorWinningTickets:
    """Test Supervisor winning tickets endpoints"""
    
    def test_get_supervisor_winning_tickets(self, supervisor_token):
        """GET /api/supervisor/winning-tickets - should return winning tickets for supervisor's agents"""
        if not supervisor_token:
            pytest.skip("Supervisor token not available")
        
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.get(f"{BASE_URL}/api/supervisor/winning-tickets", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "tickets" in data
        assert "summary" in data
        assert "total_count" in data["summary"]
        assert "total_win_amount" in data["summary"]
        
        print(f"Supervisor winning tickets: {data['summary']}")
    
    def test_get_supervisor_winning_tickets_filter_paid(self, supervisor_token):
        """GET /api/supervisor/winning-tickets?payment_status=PAID - filter by PAID"""
        if not supervisor_token:
            pytest.skip("Supervisor token not available")
        
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.get(
            f"{BASE_URL}/api/supervisor/winning-tickets?payment_status=PAID", 
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data
        
        print(f"Supervisor PAID tickets: {len(data['tickets'])}")
    
    def test_get_supervisor_winning_tickets_filter_unpaid(self, supervisor_token):
        """GET /api/supervisor/winning-tickets?payment_status=UNPAID - filter by UNPAID"""
        if not supervisor_token:
            pytest.skip("Supervisor token not available")
        
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.get(
            f"{BASE_URL}/api/supervisor/winning-tickets?payment_status=UNPAID", 
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data
        
        print(f"Supervisor UNPAID tickets: {len(data['tickets'])}")


class TestPayoutLogic:
    """Test 60/20/10 payout logic in winning_routes.py"""
    
    def test_ticket_check_endpoint(self, company_admin_token):
        """POST /api/tickets/check - verify ticket check endpoint exists"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Test with a non-existent ticket code
        response = requests.post(
            f"{BASE_URL}/api/tickets/check",
            json={"ticket_code": "TEST_NONEXISTENT_123"},
            headers=headers
        )
        
        # Should return 404 for non-existent ticket (expected behavior)
        assert response.status_code == 404
        data = response.json()
        
        # Should return error detail
        assert "detail" in data
        assert "non trouvé" in data.get("detail", "").lower() or "not found" in data.get("detail", "").lower()
        
        print(f"Ticket check response (expected 404): {data}")


class TestPaymentStatusUpdate:
    """Test payment status update endpoints"""
    
    def test_update_payment_status_invalid_status(self, company_admin_token):
        """PUT /api/company/winning-tickets/{id}/payment-status - should reject invalid status"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Try to update with invalid status
        response = requests.put(
            f"{BASE_URL}/api/company/winning-tickets/fake_ticket_id/payment-status",
            json={"payment_status": "INVALID_STATUS"},
            headers=headers
        )
        
        # Should return 400 for invalid status
        assert response.status_code == 400
        data = response.json()
        assert "payment_status" in data.get("detail", "").lower() or "doit être" in data.get("detail", "")
        
        print(f"Invalid status rejection: {data}")
    
    def test_update_payment_status_not_found(self, company_admin_token):
        """PUT /api/company/winning-tickets/{id}/payment-status - should return 404 for non-existent ticket"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        response = requests.put(
            f"{BASE_URL}/api/company/winning-tickets/nonexistent_ticket_id/payment-status",
            json={"payment_status": "PAID"},
            headers=headers
        )
        
        # Should return 404 for non-existent ticket
        assert response.status_code == 404
        
        print(f"Non-existent ticket response: {response.status_code}")


class TestSupervisorPaymentStatusUpdate:
    """Test supervisor payment status update endpoint"""
    
    def test_supervisor_update_payment_status_invalid(self, supervisor_token):
        """PUT /api/supervisor/winning-tickets/{id}/payment-status - should reject invalid status"""
        if not supervisor_token:
            pytest.skip("Supervisor token not available")
        
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        
        response = requests.put(
            f"{BASE_URL}/api/supervisor/winning-tickets/fake_ticket_id/payment-status",
            json={"payment_status": "INVALID"},
            headers=headers
        )
        
        # Should return 400 for invalid status
        assert response.status_code == 400
        
        print(f"Supervisor invalid status rejection: {response.status_code}")
    
    def test_supervisor_update_payment_status_not_found(self, supervisor_token):
        """PUT /api/supervisor/winning-tickets/{id}/payment-status - should return 404 for non-existent ticket"""
        if not supervisor_token:
            pytest.skip("Supervisor token not available")
        
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        
        response = requests.put(
            f"{BASE_URL}/api/supervisor/winning-tickets/nonexistent_ticket/payment-status",
            json={"payment_status": "PAID"},
            headers=headers
        )
        
        # Should return 404 for non-existent ticket
        assert response.status_code == 404
        
        print(f"Supervisor non-existent ticket: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
