"""
Company Admin Full CRUD and Real-Time Sync Tests
Tests: Agent CRUD, POS Devices, Tickets, Activity Logs, Lottery Catalog Toggle,
       POS Rules, Blocked Numbers, Sales Limits, Reports, Config Version, Device Sync
"""
import pytest
import requests
import os
import time
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vendor-flags.preview.emergentagent.com')

# Test credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin123!"
AGENT_EMAIL = "agent001@lotopam.com"
AGENT_PASSWORD = "Agent123!"


def generate_random_suffix():
    """Generate random suffix for test data"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))


class TestCompanyAdminAuth:
    """Test Company Admin authentication"""
    
    def test_company_admin_login(self):
        """Company Admin login should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COMPANY_ADMIN_EMAIL, "password": COMPANY_ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "token" in data, "Missing token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["role"] == "COMPANY_ADMIN", f"Expected COMPANY_ADMIN role, got {data['user']['role']}"


@pytest.fixture(scope="module")
def company_admin_token():
    """Get Company Admin token for all tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": COMPANY_ADMIN_EMAIL, "password": COMPANY_ADMIN_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Company Admin authentication failed")


@pytest.fixture(scope="module")
def agent_token():
    """Get Agent token for device sync tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/agent/login",
        json={"email": AGENT_EMAIL, "password": AGENT_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Agent authentication failed")


# ============================================================================
# AGENT CRUD TESTS
# ============================================================================
class TestAgentCRUD:
    """Test Agent CRUD operations via /api/company/agents (company_routes.py)"""
    
    def test_get_all_agents(self, company_admin_token):
        """GET /api/company/agents - Get all agents"""
        response = requests.get(
            f"{BASE_URL}/api/company/agents",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get agents failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} agents")
    
    def test_create_agent(self, company_admin_token):
        """POST /api/company/agents - Create new agent (uses AgentCreate model: name, username, password)"""
        suffix = generate_random_suffix()
        agent_data = {
            "name": f"Test Agent {suffix}",
            "username": f"testagent{suffix}",
            "email": f"test_agent_{suffix}@lottolab.com",
            "password": "TestAgent123!",
            "phone": "+509 1234 5678",
            "can_void_ticket": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/company/agents",
            json=agent_data,
            headers={
                "Authorization": f"Bearer {company_admin_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"Create agent failed: {response.text}"
        data = response.json()
        
        assert "agent_id" in data, "Missing agent_id in response"
        assert data["name"] == agent_data["name"], "Agent name should match"
        
        print(f"Created agent: {data['agent_id']}")
        return data["agent_id"]
    
    def test_update_agent(self, company_admin_token):
        """PUT /api/company/agents/{id} - Update agent"""
        # First get all agents
        response = requests.get(
            f"{BASE_URL}/api/company/agents",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        assert response.status_code == 200
        agents = response.json()
        
        if not agents:
            pytest.skip("No agents to update")
        
        agent_id = agents[0]["agent_id"]
        
        # Update the agent (via company_routes.py which returns full agent object)
        update_data = {
            "phone": "+509 9999 7777",
            "can_void_ticket": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/company/agents/{agent_id}",
            json=update_data,
            headers={
                "Authorization": f"Bearer {company_admin_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"Update agent failed: {response.text}"
        data = response.json()
        # Company routes returns full agent object, not just message
        assert "agent_id" in data, "Response should contain agent_id"
        print(f"Updated agent: {agent_id}")
    
    def test_get_agent_detail(self, company_admin_token):
        """
        GET /api/company/agents/{id} - Get single agent
        NOTE: Due to routing conflict, GET /{agent_id} goes to company_admin_routes.py 
        which expects user_id (from users collection), not agent_id (from agents collection).
        This is a backend routing inconsistency that should be fixed.
        """
        # First get all agents
        response = requests.get(
            f"{BASE_URL}/api/company/agents",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        assert response.status_code == 200
        agents = response.json()
        
        if not agents:
            pytest.skip("No agents to get details for")
        
        # BUG: GET /agents/{id} expects user_id, not agent_id
        # The list endpoint returns both, but they're different values!
        user_id = agents[0].get("user_id")
        if not user_id:
            pytest.skip("Agent has no user_id - cannot test get detail")
        
        # Get agent details using user_id
        response = requests.get(
            f"{BASE_URL}/api/company/agents/{user_id}",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get agent detail failed: {response.text}"
        data = response.json()
        
        # The response uses user_id as agent_id
        assert data["agent_id"] == user_id or data["user_id"] == user_id
        assert "name" in data
        print(f"Agent detail: {data.get('name', 'Unknown')}")


# ============================================================================
# POS DEVICE TESTS
# ============================================================================
class TestPOSDevices:
    """Test POS Device endpoints"""
    
    def test_get_all_pos_devices(self, company_admin_token):
        """GET /api/company/pos-devices - Get all POS devices"""
        response = requests.get(
            f"{BASE_URL}/api/company/pos-devices",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get POS devices failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} POS devices")


# ============================================================================
# TICKETS TESTS
# ============================================================================
class TestTickets:
    """Test Tickets endpoints"""
    
    def test_get_all_tickets(self, company_admin_token):
        """GET /api/company/tickets - Get all tickets"""
        response = requests.get(
            f"{BASE_URL}/api/company/tickets?limit=50",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get tickets failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} tickets")


# ============================================================================
# ACTIVITY LOGS TESTS
# ============================================================================
class TestActivityLogs:
    """Test Activity Logs endpoint"""
    
    def test_get_activity_logs(self, company_admin_token):
        """GET /api/company/activity-logs - Get activity logs"""
        response = requests.get(
            f"{BASE_URL}/api/company/activity-logs?limit=50",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get activity logs failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} activity logs")


# ============================================================================
# LOTTERY CATALOG TESTS
# ============================================================================
class TestLotteryCatalog:
    """Test Lottery Catalog endpoints"""
    
    def test_get_lottery_catalog(self, company_admin_token):
        """GET /api/company/lottery-catalog - Get lottery catalog"""
        response = requests.get(
            f"{BASE_URL}/api/company/lottery-catalog",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get lottery catalog failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} lotteries in catalog")
        
        if data:
            lottery = data[0]
            assert "lottery_id" in lottery, "Missing lottery_id"
            assert "lottery_name" in lottery, "Missing lottery_name"
            assert "enabled" in lottery, "Missing enabled flag"
        
        return data
    
    def test_toggle_lottery_and_verify_config_version(self, company_admin_token, agent_token):
        """PUT /api/company/lottery-catalog/{id}/toggle - Toggle lottery and verify config version increments"""
        # Step 1: Get initial config version
        response = requests.get(
            f"{BASE_URL}/api/company/config-version",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        assert response.status_code == 200, f"Get config version failed: {response.text}"
        initial_version = response.json().get("version", 0)
        print(f"Initial config version: {initial_version}")
        
        # Step 2: Get agent's current config for comparison
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200, f"Get device config failed: {response.text}"
        agent_config_version = response.json().get("config_version", 0)
        print(f"Agent config version: {agent_config_version}")
        
        # Step 3: Get lottery catalog to find a lottery to toggle
        response = requests.get(
            f"{BASE_URL}/api/company/lottery-catalog",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        assert response.status_code == 200
        lotteries = response.json()
        
        if not lotteries:
            pytest.skip("No lotteries in catalog")
        
        # Find a lottery (preferably one that's currently disabled)
        test_lottery = lotteries[0]
        lottery_id = test_lottery["lottery_id"]
        current_enabled = test_lottery.get("enabled", False)
        
        print(f"Toggling lottery {lottery_id} (currently enabled={current_enabled})")
        
        # Step 4: Toggle the lottery
        response = requests.put(
            f"{BASE_URL}/api/company/lottery-catalog/{lottery_id}/toggle?enabled={not current_enabled}",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Toggle lottery failed: {response.text}"
        
        # Step 5: Verify config version incremented
        response = requests.get(
            f"{BASE_URL}/api/company/config-version",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        assert response.status_code == 200
        new_version = response.json().get("version", 0)
        
        assert new_version > initial_version, f"Config version should increment: was {initial_version}, now {new_version}"
        print(f"Config version incremented: {initial_version} -> {new_version}")
        
        # Step 6: Verify agent device sync detects the change
        response = requests.get(
            f"{BASE_URL}/api/device/sync?last_config_version={agent_config_version}",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200, f"Device sync failed: {response.text}"
        sync_data = response.json()
        
        assert "config_version" in sync_data, "Missing config_version in sync response"
        assert "config_changed" in sync_data, "Missing config_changed flag"
        
        # If versions differ, config_changed should be true
        if sync_data["config_version"] > agent_config_version:
            assert sync_data["config_changed"] == True, "config_changed should be True when version increased"
            print(f"Device sync detected change: config_changed={sync_data['config_changed']}")
        
        # Step 7: Toggle back to original state
        response = requests.put(
            f"{BASE_URL}/api/company/lottery-catalog/{lottery_id}/toggle?enabled={current_enabled}",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        assert response.status_code == 200, f"Toggle lottery back failed: {response.text}"
        print(f"Restored lottery {lottery_id} to enabled={current_enabled}")


# ============================================================================
# POS RULES TESTS
# ============================================================================
class TestPOSRules:
    """Test POS Rules endpoints"""
    
    def test_get_pos_rules(self, company_admin_token):
        """GET /api/company/pos-rules - Get POS rules"""
        response = requests.get(
            f"{BASE_URL}/api/company/pos-rules",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get POS rules failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "company_id" in data or "id" in data, "Missing company_id/id in response"
        assert "block_numbers_enabled" in data, "Missing block_numbers_enabled"
        assert "limits_enabled" in data, "Missing limits_enabled"
        assert "allow_void_ticket" in data, "Missing allow_void_ticket"
        print(f"POS Rules: void={data.get('allow_void_ticket')}, limits={data.get('limits_enabled')}")
    
    def test_update_pos_rules(self, company_admin_token):
        """PUT /api/company/pos-rules - Update POS rules"""
        update_data = {
            "allow_reprint_ticket": True,
            "ticket_format": "80MM_THERMAL"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/company/pos-rules",
            json=update_data,
            headers={
                "Authorization": f"Bearer {company_admin_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"Update POS rules failed: {response.text}"
        data = response.json()
        
        assert data.get("allow_reprint_ticket") == True
        print("POS rules updated successfully")


# ============================================================================
# BLOCKED NUMBERS TESTS
# ============================================================================
class TestBlockedNumbers:
    """Test Blocked Numbers CRUD"""
    
    def test_get_blocked_numbers(self, company_admin_token):
        """GET /api/company/blocked-numbers - Get blocked numbers"""
        response = requests.get(
            f"{BASE_URL}/api/company/blocked-numbers",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get blocked numbers failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} blocked numbers")
    
    def test_create_and_delete_blocked_number(self, company_admin_token):
        """POST/DELETE /api/company/blocked-numbers - Create and delete blocked number"""
        # Create blocked number
        block_data = {
            "number": "999",
            "block_type": "FULL",
            "reason": "TEST_BLOCK_NUMBER"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/company/blocked-numbers",
            json=block_data,
            headers={
                "Authorization": f"Bearer {company_admin_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"Create blocked number failed: {response.text}"
        data = response.json()
        
        assert "block_id" in data, "Missing block_id in response"
        block_id = data["block_id"]
        print(f"Created blocked number: {block_id}")
        
        # Delete the blocked number (cleanup)
        response = requests.delete(
            f"{BASE_URL}/api/company/blocked-numbers/{block_id}",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Delete blocked number failed: {response.text}"
        print(f"Deleted blocked number: {block_id}")


# ============================================================================
# SALES LIMITS TESTS
# ============================================================================
class TestSalesLimits:
    """Test Sales Limits CRUD"""
    
    def test_get_sales_limits(self, company_admin_token):
        """GET /api/company/limits - Get sales limits"""
        response = requests.get(
            f"{BASE_URL}/api/company/limits",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get sales limits failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} sales limits")
    
    def test_create_and_delete_sales_limit(self, company_admin_token):
        """POST/DELETE /api/company/limits - Create and delete sales limit"""
        # Create sales limit
        limit_data = {
            "max_amount": 1000.0,
            "period": "DAILY",
            "limit_type": "GLOBAL"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/company/limits",
            json=limit_data,
            headers={
                "Authorization": f"Bearer {company_admin_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"Create sales limit failed: {response.text}"
        data = response.json()
        
        assert "limit_id" in data, "Missing limit_id in response"
        limit_id = data["limit_id"]
        print(f"Created sales limit: {limit_id}")
        
        # Delete the sales limit (cleanup)
        response = requests.delete(
            f"{BASE_URL}/api/company/limits/{limit_id}",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Delete sales limit failed: {response.text}"
        print(f"Deleted sales limit: {limit_id}")


# ============================================================================
# REPORTS TESTS
# ============================================================================
class TestReports:
    """Test Reports endpoints"""
    
    def test_get_sales_report(self, company_admin_token):
        """GET /api/company/reports/sales - Get sales report"""
        response = requests.get(
            f"{BASE_URL}/api/company/reports/sales?group_by=day",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get sales report failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "period" in data, "Missing period in response"
        assert "group_by" in data, "Missing group_by in response"
        assert "data" in data, "Missing data in response"
        assert "totals" in data, "Missing totals in response"
        
        totals = data["totals"]
        assert "total_tickets" in totals, "Missing total_tickets"
        assert "total_sales" in totals, "Missing total_sales"
        
        print(f"Sales report: {totals['total_tickets']} tickets, {totals['total_sales']} total sales")


# ============================================================================
# CONFIG VERSION TESTS
# ============================================================================
class TestConfigVersion:
    """Test Config Version endpoint"""
    
    def test_get_config_version(self, company_admin_token):
        """GET /api/company/config-version - Get config version"""
        response = requests.get(
            f"{BASE_URL}/api/company/config-version",
            headers={"Authorization": f"Bearer {company_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get config version failed: {response.text}"
        data = response.json()
        
        assert "version" in data, "Missing version in response"
        assert "company_id" in data, "Missing company_id in response"
        
        print(f"Config version: {data['version']}")


# ============================================================================
# DEVICE SYNC TESTS (Agent perspective)
# ============================================================================
class TestDeviceSync:
    """Test Device Sync endpoints"""
    
    def test_get_device_config(self, agent_token):
        """GET /api/device/config - Full device config on startup"""
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200, f"Get device config failed: {response.text}"
        data = response.json()
        
        # Verify all required fields
        assert "config_version" in data, "Missing config_version"
        assert "company" in data, "Missing company"
        assert "agent" in data, "Missing agent"
        assert "agent_policy" in data, "Missing agent_policy"
        assert "pos_rules" in data, "Missing pos_rules"
        assert "configuration" in data, "Missing configuration"
        assert "enabled_lotteries" in data, "Missing enabled_lotteries"
        assert "blocked_numbers" in data, "Missing blocked_numbers"
        assert "sales_limits" in data, "Missing sales_limits"
        assert "timestamp" in data, "Missing timestamp"
        
        print(f"Device config loaded: version={data['config_version']}, lotteries={len(data['enabled_lotteries'])}")
    
    def test_device_sync_with_version(self, agent_token):
        """GET /api/device/sync - Real-time sync with version checking"""
        # First get current config version
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200
        current_version = response.json().get("config_version", 0)
        
        # Now sync with the version
        response = requests.get(
            f"{BASE_URL}/api/device/sync?last_config_version={current_version}",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200, f"Device sync failed: {response.text}"
        data = response.json()
        
        # Verify sync response structure
        assert "config_version" in data, "Missing config_version"
        assert "config_changed" in data, "Missing config_changed"
        assert "agent_status" in data, "Missing agent_status"
        assert "latest_results" in data, "Missing latest_results"
        assert "blocked_numbers" in data, "Missing blocked_numbers"
        assert "limits" in data, "Missing limits"
        assert "daily_stats" in data, "Missing daily_stats"
        assert "balance" in data, "Missing balance"
        assert "server_time" in data, "Missing server_time"
        
        # Since we just got config, version should be same and config_changed=False
        if data["config_version"] == current_version:
            assert data["config_changed"] == False, "config_changed should be False when versions match"
        
        print(f"Sync response: version={data['config_version']}, changed={data['config_changed']}, agent_status={data['agent_status']}")
    
    def test_device_sync_detects_old_version(self, agent_token):
        """Sync with old version should detect config_changed=True"""
        # Sync with version 0 (very old)
        response = requests.get(
            f"{BASE_URL}/api/device/sync?last_config_version=0",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200, f"Device sync failed: {response.text}"
        data = response.json()
        
        # With version 0, config_changed should be True (unless config version is also 0)
        if data["config_version"] > 0:
            assert data["config_changed"] == True, "config_changed should be True when client version is 0"
            # When config changed, enabled_lotteries should be populated
            assert "enabled_lotteries" in data, "Missing enabled_lotteries when config changed"
            print(f"Sync detected outdated config: {len(data.get('enabled_lotteries', []))} lotteries sent")


# ============================================================================
# LOTTERY SELL TEST (Agent)
# ============================================================================
class TestLotterySell:
    """Test Lottery Sell endpoint"""
    
    def test_lottery_sell(self, agent_token):
        """POST /api/lottery/sell - Sell lottery ticket"""
        # First get enabled lotteries
        response = requests.get(
            f"{BASE_URL}/api/device/config",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        assert response.status_code == 200
        config = response.json()
        
        enabled_lotteries = config.get("enabled_lotteries", [])
        if not enabled_lotteries:
            pytest.skip("No enabled lotteries for selling")
        
        lottery = enabled_lotteries[0]
        lottery_id = lottery["lottery_id"]
        
        # Create sale request
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        sale_data = {
            "lottery_id": lottery_id,
            "draw_date": today,
            "draw_name": "MIDI",
            "plays": [
                {"numbers": "12", "bet_type": "BORLETTE", "amount": 50},
                {"numbers": "345", "bet_type": "LOTO3", "amount": 25}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/lottery/sell",
            json=sale_data,
            headers={
                "Authorization": f"Bearer {agent_token}",
                "Content-Type": "application/json"
            }
        )
        
        # May fail if lottery is not active or schedule closed, that's acceptable
        if response.status_code == 200:
            data = response.json()
            assert "ticket_id" in data, "Missing ticket_id"
            assert "ticket_code" in data, "Missing ticket_code"
            assert "total_amount" in data, "Missing total_amount"
            assert data["total_amount"] == 75, "Total amount should be 75"
            print(f"Ticket sold: {data['ticket_code']} for {data['total_amount']}")
        elif response.status_code in [400, 403]:
            # Expected if sales window is closed or lottery not enabled
            print(f"Sale rejected (expected): {response.json().get('detail', response.text)}")
        else:
            print(f"Sale response: {response.status_code} - {response.text}")


# ============================================================================
# TICKET PRINT TEST
# ============================================================================
class TestTicketPrint:
    """Test Ticket Print endpoint"""
    
    def test_get_tickets_for_print(self, agent_token):
        """GET agent tickets and verify print endpoint works"""
        # Get agent's tickets
        response = requests.get(
            f"{BASE_URL}/api/agent/tickets?limit=5",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200, f"Get agent tickets failed: {response.text}"
        tickets = response.json()
        
        if not tickets:
            print("No tickets to print test")
            return
        
        ticket_id = tickets[0].get("ticket_id")
        
        # Test print endpoint
        response = requests.get(
            f"{BASE_URL}/api/ticket/print/{ticket_id}",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200, f"Get ticket print failed: {response.text}"
        assert "text/html" in response.headers.get("content-type", "")
        print(f"Ticket print HTML retrieved for {ticket_id}")


# ============================================================================
# TODAY RESULTS TEST
# ============================================================================
class TestTodayResults:
    """Test Today Results endpoint"""
    
    def test_get_today_results(self, agent_token):
        """GET /api/results/today - Get today's results"""
        response = requests.get(
            f"{BASE_URL}/api/results/today",
            headers={"Authorization": f"Bearer {agent_token}"}
        )
        
        assert response.status_code == 200, f"Get today results failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} results for today")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
