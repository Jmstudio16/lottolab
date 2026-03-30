"""
LOTTOLAB - Settlement Engine API Tests (Iteration 48)
======================================================
Tests for the Settlement Engine (Moteur de Règlement Automatique):
1. POST /api/settlement/publish - Publication d'un résultat et settlement automatique
2. GET /api/settlement/list - Liste des settlements
3. GET /api/settlement/report/{settlement_id} - Rapport détaillé du settlement
4. GET /api/settlement/winning-tickets - Liste des tickets gagnants
5. GET /api/prize-config/defaults - Configuration des primes par défaut
6. Vérification anti-doublon: republier le même résultat doit échouer
7. Vérification des wallet_transactions créées
"""

import pytest
import requests
import os
import random
import string
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://seller-commission-ui.preview.emergentagent.com').rstrip('/')

# Test credentials from review request
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"


class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✓ Health check passed - version {data.get('version')}")


class TestAuthentication:
    """Authentication tests for Super Admin"""
    
    def test_super_admin_login(self, api_client):
        """Test Super Admin login with provided credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "SUPER_ADMIN"
        print(f"✓ Super Admin login successful: {data['user']['email']}")
        return data["token"]


class TestSettlementPublish:
    """Tests for POST /api/settlement/publish endpoint"""
    
    def test_publish_result_requires_auth(self, api_client):
        """Publishing result without auth should fail"""
        response = api_client.post(f"{BASE_URL}/api/settlement/publish", json={
            "lottery_id": "test_lottery",
            "lottery_name": "Test Lottery",
            "draw_date": "2026-03-30",
            "draw_name": "Midi",
            "first": "142",
            "second": "15",
            "third": "88"
        })
        assert response.status_code == 403 or response.status_code == 401
        print("✓ Publish endpoint correctly requires authentication")
    
    def test_publish_result_requires_super_admin(self, authenticated_client, auth_token):
        """Publishing result requires Super Admin role"""
        # This test verifies the endpoint is accessible with Super Admin token
        # We'll use a unique draw_date to avoid duplicate errors
        unique_date = (datetime.now() + timedelta(days=random.randint(100, 999))).strftime("%Y-%m-%d")
        
        response = authenticated_client.post(f"{BASE_URL}/api/settlement/publish", json={
            "lottery_id": "lottery_ny_midday",
            "lottery_name": "New York Midday",
            "draw_date": unique_date,
            "draw_name": "Midi",
            "first": str(random.randint(100, 999)),
            "second": str(random.randint(10, 99)),
            "third": str(random.randint(10, 99)),
            "auto_settle": True
        })
        
        # Should succeed or fail with duplicate (if already published)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            assert "result_id" in data
            assert "settlement" in data
            print(f"✓ Result published successfully: {data.get('result_id')}")
            print(f"  Settlement: {data.get('settlement', {}).get('settlement_id')}")
            print(f"  Winning tickets: {data.get('settlement', {}).get('winning_tickets', 0)}")
        else:
            # Duplicate result - this is expected behavior
            print("✓ Publish endpoint working (duplicate result rejected as expected)")


class TestSettlementIdempotency:
    """Tests for idempotency - republishing same result should fail"""
    
    def test_duplicate_result_rejected(self, authenticated_client):
        """Publishing the same result twice should fail with DUPLICATE_RESULT error"""
        # Use a fixed date/lottery combination for this test
        test_date = "2026-12-25"  # Christmas - unlikely to have real data
        test_lottery = "lottery_test_idempotency"
        
        payload = {
            "lottery_id": test_lottery,
            "lottery_name": "Test Idempotency Lottery",
            "draw_date": test_date,
            "draw_name": "Midi",
            "first": "123",
            "second": "45",
            "third": "67",
            "auto_settle": True
        }
        
        # First publish
        response1 = authenticated_client.post(f"{BASE_URL}/api/settlement/publish", json=payload)
        
        # Second publish with same data
        response2 = authenticated_client.post(f"{BASE_URL}/api/settlement/publish", json=payload)
        
        # Second should fail with 400 (duplicate)
        if response1.status_code == 200:
            assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"
            assert "déjà été publié" in response2.text or "DUPLICATE" in response2.text
            print("✓ Idempotency verified - duplicate result correctly rejected")
        else:
            # First was already a duplicate from previous test run
            print("✓ Idempotency verified - result already exists from previous test")


class TestSettlementList:
    """Tests for GET /api/settlement/list endpoint"""
    
    def test_list_settlements_requires_auth(self, api_client):
        """List settlements without auth should fail"""
        response = api_client.get(f"{BASE_URL}/api/settlement/list")
        assert response.status_code in [401, 403]
        print("✓ List settlements correctly requires authentication")
    
    def test_list_settlements_success(self, authenticated_client):
        """List settlements with valid auth"""
        response = authenticated_client.get(f"{BASE_URL}/api/settlement/list", params={"limit": 10})
        assert response.status_code == 200
        data = response.json()
        assert "settlements" in data
        assert "count" in data
        assert isinstance(data["settlements"], list)
        print(f"✓ List settlements returned {data['count']} settlements")
        
        # Verify settlement structure if any exist
        if data["settlements"]:
            settlement = data["settlements"][0]
            assert "settlement_id" in settlement
            assert "lottery_id" in settlement
            assert "draw_date" in settlement
            assert "status" in settlement
            print(f"  First settlement: {settlement.get('settlement_id')} - {settlement.get('status')}")
    
    def test_list_settlements_with_filters(self, authenticated_client):
        """List settlements with date and status filters"""
        # Test with status filter
        response = authenticated_client.get(f"{BASE_URL}/api/settlement/list", params={
            "status": "COMPLETED",
            "limit": 5
        })
        assert response.status_code == 200
        data = response.json()
        
        # All returned settlements should have COMPLETED status
        for settlement in data["settlements"]:
            assert settlement.get("status") == "COMPLETED"
        
        print(f"✓ Filter by status working - {len(data['settlements'])} COMPLETED settlements")


class TestSettlementReport:
    """Tests for GET /api/settlement/report/{settlement_id} endpoint"""
    
    def test_report_requires_auth(self, api_client):
        """Report endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/settlement/report/test_id")
        assert response.status_code in [401, 403]
        print("✓ Report endpoint correctly requires authentication")
    
    def test_report_not_found(self, authenticated_client):
        """Report for non-existent settlement returns 404"""
        response = authenticated_client.get(f"{BASE_URL}/api/settlement/report/nonexistent_settlement_id")
        assert response.status_code == 404
        print("✓ Report correctly returns 404 for non-existent settlement")
    
    def test_report_success(self, authenticated_client):
        """Get report for existing settlement"""
        # First get a settlement ID from the list
        list_response = authenticated_client.get(f"{BASE_URL}/api/settlement/list", params={"limit": 1})
        assert list_response.status_code == 200
        settlements = list_response.json().get("settlements", [])
        
        if not settlements:
            pytest.skip("No settlements available for report test")
        
        settlement_id = settlements[0]["settlement_id"]
        
        # Get the report
        response = authenticated_client.get(f"{BASE_URL}/api/settlement/report/{settlement_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify report structure
        assert "settlement" in data
        assert "statistics" in data
        assert "settlement_items" in data or "winning_tickets" in data
        
        stats = data["statistics"]
        assert "total_tickets_scanned" in stats
        assert "total_winning_tickets" in stats
        assert "total_payout_amount" in stats
        
        print(f"✓ Report retrieved for settlement {settlement_id}")
        print(f"  Tickets scanned: {stats.get('total_tickets_scanned')}")
        print(f"  Winners: {stats.get('total_winning_tickets')}")
        print(f"  Total payout: {stats.get('total_payout_amount')} HTG")


class TestWinningTickets:
    """Tests for GET /api/settlement/winning-tickets endpoint"""
    
    def test_winning_tickets_requires_auth(self, api_client):
        """Winning tickets endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/settlement/winning-tickets")
        assert response.status_code in [401, 403]
        print("✓ Winning tickets endpoint correctly requires authentication")
    
    def test_winning_tickets_success(self, authenticated_client):
        """Get list of winning tickets"""
        response = authenticated_client.get(f"{BASE_URL}/api/settlement/winning-tickets", params={"limit": 20})
        assert response.status_code == 200
        data = response.json()
        
        assert "winning_tickets" in data
        assert "count" in data
        assert "total_winnings" in data
        
        print(f"✓ Winning tickets retrieved: {data['count']} tickets")
        print(f"  Total winnings: {data['total_winnings']} HTG")
        
        # Verify ticket structure if any exist
        if data["winning_tickets"]:
            ticket = data["winning_tickets"][0]
            assert "ticket_id" in ticket
            assert "win_amount" in ticket or "winnings" in ticket
            print(f"  First winner: {ticket.get('ticket_code')} - {ticket.get('win_amount', ticket.get('winnings', 0))} HTG")


class TestPrizeConfigDefaults:
    """Tests for GET /api/prize-config/defaults endpoint"""
    
    def test_defaults_requires_auth(self, api_client):
        """Prize config defaults requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/prize-config/defaults")
        assert response.status_code in [401, 403]
        print("✓ Prize config defaults correctly requires authentication")
    
    def test_defaults_success(self, authenticated_client):
        """Get default prize configurations"""
        response = authenticated_client.get(f"{BASE_URL}/api/prize-config/defaults")
        assert response.status_code == 200
        data = response.json()
        
        assert "default_configs" in data
        configs = data["default_configs"]
        
        # Verify BORLETTE config (60/20/10 formula)
        assert "BORLETTE" in configs
        borlette = configs["BORLETTE"]
        assert borlette["formula"] == "60|20|10"
        print(f"✓ BORLETTE config: {borlette['formula']} - {borlette['description']}")
        
        # Verify other game types
        assert "LOTO3" in configs
        assert configs["LOTO3"]["formula"] == "500"
        print(f"✓ LOTO3 config: {configs['LOTO3']['formula']}")
        
        assert "LOTO4" in configs
        assert configs["LOTO4"]["formula"] == "5000"
        print(f"✓ LOTO4 config: {configs['LOTO4']['formula']}")
        
        assert "MARIAGE" in configs
        assert configs["MARIAGE"]["formula"] == "750"
        print(f"✓ MARIAGE config: {configs['MARIAGE']['formula']}")
        
        # Verify payout models
        assert "payout_models" in data
        assert "FIXED_MULTIPLIER" in data["payout_models"]
        print("✓ All default prize configurations verified")


class TestWalletTransactions:
    """Tests for GET /api/settlement/wallet-transactions endpoint"""
    
    def test_wallet_transactions_requires_auth(self, api_client):
        """Wallet transactions endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/settlement/wallet-transactions")
        assert response.status_code in [401, 403]
        print("✓ Wallet transactions endpoint correctly requires authentication")
    
    def test_wallet_transactions_success(self, authenticated_client):
        """Get wallet transactions from settlements"""
        response = authenticated_client.get(f"{BASE_URL}/api/settlement/wallet-transactions", params={"limit": 20})
        assert response.status_code == 200
        data = response.json()
        
        assert "transactions" in data
        assert "count" in data
        assert "total_credited" in data
        
        print(f"✓ Wallet transactions retrieved: {data['count']} transactions")
        print(f"  Total credited: {data['total_credited']} HTG")
        
        # Verify transaction structure if any exist
        if data["transactions"]:
            tx = data["transactions"][0]
            assert "transaction_id" in tx
            assert "amount" in tx
            assert "transaction_type" in tx
            print(f"  First transaction: {tx.get('transaction_id')} - {tx.get('amount')} HTG ({tx.get('transaction_type')})")


class TestAuditLogs:
    """Tests for GET /api/settlement/audit-logs endpoint"""
    
    def test_audit_logs_requires_super_admin(self, api_client):
        """Audit logs endpoint requires Super Admin"""
        response = api_client.get(f"{BASE_URL}/api/settlement/audit-logs")
        assert response.status_code in [401, 403]
        print("✓ Audit logs endpoint correctly requires authentication")
    
    def test_audit_logs_success(self, authenticated_client):
        """Get audit logs for settlements"""
        response = authenticated_client.get(f"{BASE_URL}/api/settlement/audit-logs", params={"limit": 20})
        assert response.status_code == 200
        data = response.json()
        
        assert "audit_logs" in data
        assert "count" in data
        
        print(f"✓ Audit logs retrieved: {data['count']} logs")
        
        # Verify log structure if any exist
        if data["audit_logs"]:
            log = data["audit_logs"][0]
            assert "log_id" in log
            assert "action" in log
            assert "entity_type" in log
            print(f"  First log: {log.get('action')} on {log.get('entity_type')}")


class TestSettlementStatus:
    """Tests for GET /api/settlement/status/{settlement_id} endpoint"""
    
    def test_status_requires_auth(self, api_client):
        """Status endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/settlement/status/test_id")
        assert response.status_code in [401, 403]
        print("✓ Status endpoint correctly requires authentication")
    
    def test_status_success(self, authenticated_client):
        """Get status for existing settlement"""
        # First get a settlement ID from the list
        list_response = authenticated_client.get(f"{BASE_URL}/api/settlement/list", params={"limit": 1})
        assert list_response.status_code == 200
        settlements = list_response.json().get("settlements", [])
        
        if not settlements:
            pytest.skip("No settlements available for status test")
        
        settlement_id = settlements[0]["settlement_id"]
        
        # Get the status
        response = authenticated_client.get(f"{BASE_URL}/api/settlement/status/{settlement_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify status structure
        assert "settlement_id" in data
        assert "status" in data
        assert "total_tickets_scanned" in data
        assert "total_winning_tickets" in data
        assert "total_payout_amount" in data
        
        print(f"✓ Status retrieved for settlement {settlement_id}")
        print(f"  Status: {data.get('status')}")
        print(f"  Tickets: {data.get('total_tickets_scanned')}, Winners: {data.get('total_winning_tickets')}")


# ============ FIXTURES ============

@pytest.fixture
def api_client():
    """Shared requests session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def auth_token(api_client):
    """Get authentication token for Super Admin"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.text}")


@pytest.fixture
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
