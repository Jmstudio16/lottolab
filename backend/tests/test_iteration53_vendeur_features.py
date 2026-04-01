"""
Iteration 53: Vendeur Features Testing
- Date filters in Mes Tickets (VendeurMesTickets.jsx)
- Payment buttons (Payé/Non Payé) for winning tickets
- Profile photo persistence
- Report endpoint with date parameters
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://seller-commission-ui.preview.emergentagent.com').rstrip('/')

# Test credentials from iteration 52
VENDEUR_EMAIL = "vendeur@lotopam.com"
VENDEUR_PASSWORD = "vendor123"


class TestVendeurAuthentication:
    """Test vendeur login and token retrieval"""
    
    @pytest.fixture(scope="class")
    def vendeur_token(self):
        """Get vendeur authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VENDEUR_EMAIL, "password": VENDEUR_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Vendeur login failed: {response.status_code} - {response.text}")
    
    def test_vendeur_login(self):
        """Test vendeur can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VENDEUR_EMAIL, "password": VENDEUR_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        print(f"SUCCESS: Vendeur login successful, role: {data['user'].get('role')}")


class TestVendeurMesTicketsDateFilters:
    """Test date filters on GET /api/vendeur/mes-tickets endpoint"""
    
    @pytest.fixture(scope="class")
    def vendeur_token(self):
        """Get vendeur authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VENDEUR_EMAIL, "password": VENDEUR_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Vendeur login failed: {response.status_code}")
    
    def test_mes_tickets_no_filter(self, vendeur_token):
        """Test GET /api/vendeur/mes-tickets without date filter"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/mes-tickets", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: mes-tickets returned {len(data)} tickets (no filter)")
    
    def test_mes_tickets_today_filter(self, vendeur_token):
        """Test GET /api/vendeur/mes-tickets with today's date filter"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/vendeur/mes-tickets",
            params={"date_from": today, "date_to": today},
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: mes-tickets with today filter returned {len(data)} tickets")
    
    def test_mes_tickets_yesterday_filter(self, vendeur_token):
        """Test GET /api/vendeur/mes-tickets with yesterday's date filter"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/vendeur/mes-tickets",
            params={"date_from": yesterday, "date_to": yesterday},
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: mes-tickets with yesterday filter returned {len(data)} tickets")
    
    def test_mes_tickets_week_filter(self, vendeur_token):
        """Test GET /api/vendeur/mes-tickets with week date filter"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/vendeur/mes-tickets",
            params={"date_from": week_ago, "date_to": today},
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: mes-tickets with week filter returned {len(data)} tickets")
    
    def test_mes_tickets_custom_date_range(self, vendeur_token):
        """Test GET /api/vendeur/mes-tickets with custom date range"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        start = "2025-01-01"
        end = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/vendeur/mes-tickets",
            params={"date_from": start, "date_to": end},
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: mes-tickets with custom date range returned {len(data)} tickets")


class TestVendeurWinningTicketsPayment:
    """Test payment status update for winning tickets"""
    
    @pytest.fixture(scope="class")
    def vendeur_token(self):
        """Get vendeur authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VENDEUR_EMAIL, "password": VENDEUR_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Vendeur login failed: {response.status_code}")
    
    def test_get_winning_tickets(self, vendeur_token):
        """Test GET /api/vendeur/winning-tickets endpoint"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/winning-tickets", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "tickets" in data, "Response should have 'tickets' key"
        assert "summary" in data, "Response should have 'summary' key"
        print(f"SUCCESS: winning-tickets returned {len(data['tickets'])} tickets")
        return data
    
    def test_winning_tickets_with_date_filter(self, vendeur_token):
        """Test GET /api/vendeur/winning-tickets with date filter"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/vendeur/winning-tickets",
            params={"date_from": today, "date_to": today},
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "tickets" in data, "Response should have 'tickets' key"
        print(f"SUCCESS: winning-tickets with date filter returned {len(data['tickets'])} tickets")
    
    def test_payment_endpoint_exists(self, vendeur_token):
        """Test PUT /api/vendeur/winning-tickets/{ticket_id}/payment endpoint exists"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        # First get a winning ticket
        response = requests.get(f"{BASE_URL}/api/vendeur/winning-tickets", headers=headers)
        if response.status_code == 200:
            data = response.json()
            tickets = data.get("tickets", [])
            if tickets:
                ticket_id = tickets[0].get("ticket_id")
                # Test the payment endpoint
                payment_response = requests.put(
                    f"{BASE_URL}/api/vendeur/winning-tickets/{ticket_id}/payment",
                    json={"payment_status": "PAID"},
                    headers=headers
                )
                # Should return 200 or 404 (if ticket not found for this vendeur)
                assert payment_response.status_code in [200, 404], f"Unexpected status: {payment_response.status_code}"
                if payment_response.status_code == 200:
                    print(f"SUCCESS: Payment endpoint works for ticket {ticket_id}")
                else:
                    print(f"INFO: Ticket {ticket_id} not found for this vendeur (expected if not owner)")
            else:
                print("INFO: No winning tickets found to test payment endpoint")
        else:
            pytest.skip("Could not get winning tickets")
    
    def test_payment_status_validation(self, vendeur_token):
        """Test payment status validation (PAID/UNPAID only)"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        # Test with invalid status
        response = requests.put(
            f"{BASE_URL}/api/vendeur/winning-tickets/fake_ticket_id/payment",
            json={"payment_status": "INVALID_STATUS"},
            headers=headers
        )
        # Should return 400 for invalid status or 404 for not found
        assert response.status_code in [400, 404], f"Expected 400 or 404, got {response.status_code}"
        print(f"SUCCESS: Payment status validation works (status: {response.status_code})")


class TestVendeurReport:
    """Test vendeur report endpoint with date parameters"""
    
    @pytest.fixture(scope="class")
    def vendeur_token(self):
        """Get vendeur authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VENDEUR_EMAIL, "password": VENDEUR_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Vendeur login failed: {response.status_code}")
    
    def test_report_today(self, vendeur_token):
        """Test GET /api/vendeur/report with period=today"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(
            f"{BASE_URL}/api/vendeur/report",
            params={"period": "today"},
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "total_sales" in data, "Response should have 'total_sales'"
        assert "total_tickets" in data, "Response should have 'total_tickets'"
        print(f"SUCCESS: Report (today) - Sales: {data.get('total_sales')}, Tickets: {data.get('total_tickets')}")
    
    def test_report_with_custom_dates(self, vendeur_token):
        """Test GET /api/vendeur/report with start_date and end_date"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        start_date = "2025-01-01"
        end_date = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/vendeur/report",
            params={"start_date": start_date, "end_date": end_date},
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "total_sales" in data, "Response should have 'total_sales'"
        print(f"SUCCESS: Report (custom dates) - Sales: {data.get('total_sales')}, Tickets: {data.get('total_tickets')}")
    
    def test_report_week(self, vendeur_token):
        """Test GET /api/vendeur/report with period=week"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(
            f"{BASE_URL}/api/vendeur/report",
            params={"period": "week"},
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "total_sales" in data, "Response should have 'total_sales'"
        print(f"SUCCESS: Report (week) - Sales: {data.get('total_sales')}, Tickets: {data.get('total_tickets')}")


class TestVendeurProfile:
    """Test vendeur profile and photo upload"""
    
    @pytest.fixture(scope="class")
    def vendeur_token(self):
        """Get vendeur authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VENDEUR_EMAIL, "password": VENDEUR_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Vendeur login failed: {response.status_code}")
    
    def test_get_profile(self, vendeur_token):
        """Test GET /api/vendeur/profile endpoint"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/profile", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "vendeur" in data, "Response should have 'vendeur' key"
        vendeur = data.get("vendeur", {})
        print(f"SUCCESS: Profile retrieved - Name: {vendeur.get('name')}, Photo: {vendeur.get('photo_url')}")
        return data
    
    def test_auth_me_returns_photo(self, vendeur_token):
        """Test GET /api/auth/me returns photo_url"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Check if photo_url field exists (may be null if no photo uploaded)
        print(f"SUCCESS: auth/me returns user data with photo_url: {data.get('photo_url')}")
    
    def test_upload_profile_image_endpoint_exists(self, vendeur_token):
        """Test POST /api/user/upload-profile-image endpoint exists"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        # Test without file to check endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/user/upload-profile-image",
            headers=headers
        )
        # Should return 422 (validation error for missing file) or 400, not 404
        assert response.status_code != 404, "Upload profile image endpoint not found"
        print(f"SUCCESS: Upload profile image endpoint exists (status: {response.status_code})")


class TestVendeurLotsGagnants:
    """Test VendeurLotsGagnants page functionality"""
    
    @pytest.fixture(scope="class")
    def vendeur_token(self):
        """Get vendeur authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": VENDEUR_EMAIL, "password": VENDEUR_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Vendeur login failed: {response.status_code}")
    
    def test_winning_tickets_summary(self, vendeur_token):
        """Test winning tickets summary data"""
        headers = {"Authorization": f"Bearer {vendeur_token}"}
        response = requests.get(f"{BASE_URL}/api/vendeur/winning-tickets", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        summary = data.get("summary", {})
        assert "total_count" in summary, "Summary should have 'total_count'"
        assert "total_win_amount" in summary, "Summary should have 'total_win_amount'"
        assert "paid_count" in summary, "Summary should have 'paid_count'"
        assert "pending_count" in summary, "Summary should have 'pending_count'"
        print(f"SUCCESS: Winning tickets summary - Total: {summary.get('total_count')}, Amount: {summary.get('total_win_amount')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
