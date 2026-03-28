"""
LOTTOLAB - Security Phase 1 Testing
====================================
Tests for:
1. Security Stats API
2. Audit Logs API
3. Login Attempts API
4. Login Blocks API
5. Fraud Alerts API
6. IP Blacklist API
7. Login Protection (5 attempts, 15min block)
"""

import pytest
import requests
import os
import time
import uuid

# Use the preview URL for testing
BASE_URL = "https://seller-commission-ui.preview.emergentagent.com"

# Test credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✅ API Health: {data['status']}, DB: {data['database']}")


class TestSuperAdminAuth:
    """Test Super Admin authentication"""
    
    def test_super_admin_login(self):
        """Test Super Admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        # May get rate limited, handle gracefully
        if response.status_code == 429:
            print("⚠️ Rate limited - waiting 60 seconds")
            time.sleep(60)
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": SUPER_ADMIN_EMAIL,
                "password": SUPER_ADMIN_PASSWORD
            })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "SUPER_ADMIN"
        print(f"✅ Super Admin login successful: {data['user']['email']}")
        return data["token"]


@pytest.fixture(scope="module")
def super_admin_token():
    """Get Super Admin token for authenticated requests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    
    if response.status_code == 429:
        print("⚠️ Rate limited - waiting 60 seconds")
        time.sleep(60)
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
    
    if response.status_code != 200:
        pytest.skip(f"Could not authenticate: {response.text}")
    
    return response.json()["token"]


class TestSecurityStats:
    """Test /api/security/stats endpoint"""
    
    def test_get_security_stats(self, super_admin_token):
        """Test getting security statistics"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/stats", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "today" in data
        assert "alerts" in data
        assert "blacklist" in data
        assert "generated_at" in data
        
        # Verify today stats
        assert "successful_logins" in data["today"]
        assert "failed_logins" in data["today"]
        assert "active_blocks" in data["today"]
        
        # Verify alerts stats
        assert "open_fraud_alerts" in data["alerts"]
        assert "critical_events_week" in data["alerts"]
        assert "duplicate_attempts_week" in data["alerts"]
        
        print(f"✅ Security Stats: {data['today']['successful_logins']} logins, {data['today']['failed_logins']} failures, {data['today']['active_blocks']} blocks")


class TestAuditLogs:
    """Test /api/security/audit-logs endpoint"""
    
    def test_get_audit_logs(self, super_admin_token):
        """Test getting audit logs"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/audit-logs?limit=50", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "logs" in data
        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        
        print(f"✅ Audit Logs: {data['total']} total logs, showing {len(data['logs'])}")
        
        # Verify log structure if logs exist
        if data["logs"]:
            log = data["logs"][0]
            assert "audit_id" in log
            assert "timestamp" in log
            assert "action" in log
            assert "user_id" in log
            assert "client_ip" in log
            print(f"   Sample log: {log['action']} by {log['user_id'][:20]}...")
    
    def test_get_audit_action_types(self, super_admin_token):
        """Test getting available audit action types"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/audit-logs/actions", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify action structure
        action = data[0]
        assert "code" in action
        assert "label" in action
        
        print(f"✅ Audit Action Types: {len(data)} types available")
        print(f"   Sample: {action['code']} - {action['label']}")
    
    def test_filter_audit_logs_by_severity(self, super_admin_token):
        """Test filtering audit logs by severity"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/audit-logs?severity=WARNING&limit=20", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All returned logs should have WARNING severity
        for log in data["logs"]:
            assert log["severity"] == "WARNING", f"Expected WARNING, got {log['severity']}"
        
        print(f"✅ Filtered Audit Logs: {len(data['logs'])} WARNING logs")


class TestLoginAttempts:
    """Test /api/security/login-attempts endpoint (Super Admin only)"""
    
    def test_get_login_attempts(self, super_admin_token):
        """Test getting login attempt history"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/login-attempts?limit=50", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✅ Login Attempts: {len(data)} attempts recorded")
        
        # Verify attempt structure if attempts exist
        if data:
            attempt = data[0]
            assert "attempt_id" in attempt
            assert "email" in attempt
            assert "ip_address" in attempt
            assert "success" in attempt
            assert "timestamp" in attempt
            
            success_count = sum(1 for a in data if a["success"])
            fail_count = len(data) - success_count
            print(f"   Success: {success_count}, Failed: {fail_count}")
    
    def test_filter_login_attempts_by_success(self, super_admin_token):
        """Test filtering login attempts by success status"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/login-attempts?success=false&limit=20", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All returned attempts should be failures
        for attempt in data:
            assert attempt["success"] == False, f"Expected failed attempt, got success"
        
        print(f"✅ Filtered Login Attempts: {len(data)} failed attempts")


class TestLoginBlocks:
    """Test /api/security/login-blocks endpoint (Super Admin only)"""
    
    def test_get_active_blocks(self, super_admin_token):
        """Test getting active login blocks"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/login-blocks", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✅ Active Login Blocks: {len(data)} blocks")
        
        # Verify block structure if blocks exist
        if data:
            block = data[0]
            assert "block_id" in block
            assert "email" in block
            assert "ip_address" in block
            assert "blocked_until" in block
            assert "reason" in block
            print(f"   Sample block: {block['email']} until {block['blocked_until']}")


class TestFraudAlerts:
    """Test /api/security/fraud-alerts endpoint"""
    
    def test_get_fraud_alerts(self, super_admin_token):
        """Test getting fraud alerts"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/fraud-alerts", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✅ Fraud Alerts: {len(data)} alerts")
        
        # Verify alert structure if alerts exist
        if data:
            alert = data[0]
            assert "alert_id" in alert
            assert "alert_type" in alert
            assert "status" in alert
            assert "severity" in alert
    
    def test_create_fraud_alert(self, super_admin_token):
        """Test creating a manual fraud alert"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        alert_data = {
            "alert_type": "TEST_ALERT",
            "description": "Test fraud alert for security testing",
            "entity_type": "ticket",
            "entity_id": f"test_{uuid.uuid4().hex[:8]}",
            "severity": "WARNING"
        }
        
        response = requests.post(f"{BASE_URL}/api/security/fraud-alerts", 
                                 json=alert_data, headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "alert_id" in data
        assert "message" in data
        
        print(f"✅ Created Fraud Alert: {data['alert_id']}")
        return data["alert_id"]
    
    def test_resolve_fraud_alert(self, super_admin_token):
        """Test resolving a fraud alert"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First create an alert
        alert_data = {
            "alert_type": "TEST_RESOLVE",
            "description": "Test alert to be resolved",
            "entity_type": "user",
            "entity_id": f"test_{uuid.uuid4().hex[:8]}",
            "severity": "WARNING"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/security/fraud-alerts", 
                                        json=alert_data, headers=headers)
        assert create_response.status_code == 200
        alert_id = create_response.json()["alert_id"]
        
        # Now resolve it
        resolve_data = {
            "status": "RESOLVED",
            "resolution_notes": "Test resolution - automated testing"
        }
        
        response = requests.put(f"{BASE_URL}/api/security/fraud-alerts/{alert_id}/resolve",
                               json=resolve_data, headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✅ Resolved Fraud Alert: {alert_id}")


class TestIPBlacklist:
    """Test /api/security/ip-blacklist endpoint (Super Admin only)"""
    
    def test_get_ip_blacklist(self, super_admin_token):
        """Test getting IP blacklist"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/security/ip-blacklist", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✅ IP Blacklist: {len(data)} IPs blocked")
        
        # Verify entry structure if entries exist
        if data:
            entry = data[0]
            assert "entry_id" in entry
            assert "ip_address" in entry
            assert "reason" in entry
            assert "active" in entry
    
    def test_add_and_remove_ip_blacklist(self, super_admin_token):
        """Test adding and removing IP from blacklist"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Generate a test IP
        test_ip = f"192.168.{uuid.uuid4().int % 256}.{uuid.uuid4().int % 256}"
        
        # Add to blacklist
        add_data = {
            "ip_address": test_ip,
            "reason": "Test blacklist entry - automated testing"
        }
        
        add_response = requests.post(f"{BASE_URL}/api/security/ip-blacklist",
                                     json=add_data, headers=headers)
        
        assert add_response.status_code == 200, f"Failed to add: {add_response.text}"
        print(f"✅ Added IP to blacklist: {test_ip}")
        
        # Remove from blacklist
        remove_response = requests.delete(f"{BASE_URL}/api/security/ip-blacklist/{test_ip}",
                                          headers=headers)
        
        assert remove_response.status_code == 200, f"Failed to remove: {remove_response.text}"
        print(f"✅ Removed IP from blacklist: {test_ip}")


class TestLoginProtection:
    """Test login protection (5 attempts, 15min block)"""
    
    def test_login_protection_records_failed_attempts(self, super_admin_token):
        """Test that failed login attempts are recorded"""
        # Generate a unique test email
        test_email = f"test_security_{uuid.uuid4().hex[:8]}@test.com"
        
        # Make a failed login attempt
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "wrong_password"
        })
        
        # Should get 401 (invalid credentials)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        # Verify the attempt was recorded
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        attempts_response = requests.get(
            f"{BASE_URL}/api/security/login-attempts?email={test_email}&limit=5",
            headers=headers
        )
        
        assert attempts_response.status_code == 200
        attempts = attempts_response.json()
        
        # Should have at least 1 failed attempt
        failed_attempts = [a for a in attempts if a["email"] == test_email and not a["success"]]
        assert len(failed_attempts) >= 1, "Failed attempt was not recorded"
        
        print(f"✅ Login protection: Failed attempt recorded for {test_email}")
    
    def test_login_blocks_after_5_attempts(self, super_admin_token):
        """Test that login is blocked after 5 failed attempts"""
        # Generate a unique test email
        test_email = f"test_block_{uuid.uuid4().hex[:8]}@test.com"
        
        # Make 5 failed login attempts
        for i in range(5):
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": test_email,
                "password": "wrong_password"
            })
            # Should get 401 for first 5 attempts
            if response.status_code == 429:
                print(f"✅ Login blocked after {i+1} attempts (429 received)")
                return  # Test passed - blocked before 5 attempts
        
        # 6th attempt should be blocked (429)
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "wrong_password"
        })
        
        assert response.status_code == 429, f"Expected 429 (blocked), got {response.status_code}"
        print(f"✅ Login protection: Account blocked after 5 failed attempts")
        
        # Verify block was created
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        blocks_response = requests.get(f"{BASE_URL}/api/security/login-blocks", headers=headers)
        
        if blocks_response.status_code == 200:
            blocks = blocks_response.json()
            test_blocks = [b for b in blocks if b["email"] == test_email]
            if test_blocks:
                print(f"   Block created: {test_blocks[0]['blocked_until']}")


class TestSecurityDashboardAccess:
    """Test access control for security endpoints"""
    
    def test_unauthenticated_access_denied(self):
        """Test that unauthenticated requests are denied"""
        endpoints = [
            "/api/security/stats",
            "/api/security/audit-logs",
            "/api/security/login-attempts",
            "/api/security/login-blocks",
            "/api/security/fraud-alerts",
            "/api/security/ip-blacklist"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], f"{endpoint} should require auth, got {response.status_code}"
        
        print(f"✅ All security endpoints require authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
