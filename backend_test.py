#!/usr/bin/env python3
import requests
import sys
import json
from datetime import datetime

class LottoLabAPITester:
    def __init__(self, base_url="https://keno-raffle-feature.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=True):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_login(self, email, password):
        """Test login and get token"""
        print(f"\n📧 Testing login for {email}")
        success, response = self.run_test(
            f"Login ({email})",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password},
            auth_required=False
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_data = response.get('user', {})
            print(f"   ✅ Token acquired for role: {self.user_data.get('role')}")
            return True, response
        return False, {}

    def test_super_admin_flows(self):
        """Test Super Admin specific endpoints"""
        print(f"\n🔷 Testing Super Admin flows...")
        
        # Dashboard stats
        self.run_test("Super Dashboard Stats", "GET", "super/dashboard/stats", 200)
        
        # Get companies
        self.run_test("Get All Companies", "GET", "super/companies", 200)
        
        # Get all users
        self.run_test("Get All Users", "GET", "super/users", 200)
        
        # Get plans
        self.run_test("Get Plans", "GET", "super/plans", 200)
        
        # Get activity logs
        self.run_test("Get Activity Logs", "GET", "super/activity-logs", 200)

        # Test company creation
        company_data = {
            "name": f"Test Company {datetime.now().strftime('%H%M%S')}",
            "slug": f"test-company-{datetime.now().strftime('%H%M%S')}",
            "contact_email": "test@test.com",
            "currency": "USD",
            "plan": "Basic"
        }
        success, company = self.run_test("Create Company", "POST", "super/companies", 200, company_data)
        
        if success:
            company_id = company.get('company_id')
            if company_id:
                # Test user creation
                user_data = {
                    "email": f"testuser{datetime.now().strftime('%H%M%S')}@test.com",
                    "password": "TestPassword123!",
                    "name": "Test User",
                    "role": "COMPANY_ADMIN",
                    "company_id": company_id
                }
                self.run_test("Create User", "POST", "super/users", 200, user_data)

    def test_company_admin_flows(self):
        """Test Company Admin specific endpoints"""
        print(f"\n🔶 Testing Company Admin flows...")
        
        # Dashboard stats
        self.run_test("Company Dashboard Stats", "GET", "company/dashboard/stats", 200)
        
        # Get agents
        self.run_test("Get Company Agents", "GET", "company/agents", 200)
        
        # Get lotteries
        self.run_test("Get Company Lotteries", "GET", "company/lotteries", 200)
        
        # Get tickets
        self.run_test("Get Company Tickets", "GET", "company/tickets", 200)
        
        # Get results
        self.run_test("Get Company Results", "GET", "company/results", 200)

        # Test agent creation
        agent_data = {
            "name": f"Test Agent {datetime.now().strftime('%H%M%S')}",
            "username": f"testagent{datetime.now().strftime('%H%M%S')}",
            "password": "Agent123!",
            "phone": "+509-1234-0000",
            "can_void_ticket": False
        }
        self.run_test("Create Agent", "POST", "company/agents", 200, agent_data)

    def test_pos_flows(self):
        """Test POS specific endpoints"""
        print(f"\n🔵 Testing POS flows...")
        
        # Get open lotteries
        success, lotteries = self.run_test("Get Open Lotteries", "GET", "pos/lotteries/open", 200)
        
        # Get daily summary
        self.run_test("Get Daily Summary", "GET", "pos/summary/daily", 200)
        
        # Test ticket creation if we have open lotteries
        if success and lotteries and len(lotteries) > 0:
            lottery = lotteries[0]
            ticket_data = {
                "lottery_id": lottery["lottery_id"],
                "draw_datetime": lottery["next_draw"],
                "plays": [
                    {
                        "numbers": "1234",
                        "bet_type": "STRAIGHT",
                        "amount": 25.0
                    }
                ]
            }
            self.run_test("Create Ticket", "POST", "pos/tickets", 200, ticket_data)
            
            # Get my tickets
            self.run_test("Get My Tickets", "GET", "pos/tickets/my", 200)

    def test_shared_endpoints(self):
        """Test endpoints available to all users"""
        print(f"\n🔸 Testing shared endpoints...")
        
        # Get states
        self.run_test("Get States", "GET", "states", 200, auth_required=False)
        
        # Get all lotteries
        self.run_test("Get All Lotteries", "GET", "lotteries", 200, auth_required=False)

    def test_rbac_violations(self):
        """Test that RBAC is properly enforced"""
        print(f"\n🛡️ Testing RBAC violations...")
        
        current_role = self.user_data.get('role') if self.user_data else None
        
        if current_role == "AGENT_POS":
            # Agent should not access company admin endpoints
            self.run_test("RBAC: Agent accessing company stats", "GET", "company/dashboard/stats", 403)
            self.run_test("RBAC: Agent accessing super admin", "GET", "super/dashboard/stats", 403)
        
        elif current_role == "COMPANY_ADMIN":
            # Company admin should not access super admin endpoints
            self.run_test("RBAC: Company Admin accessing super stats", "GET", "super/dashboard/stats", 403)

def main():
    print("🎯 LOTTOLAB API Testing Suite")
    print("="*60)
    
    tester = LottoLabAPITester()
    overall_success = True
    
    # Test credentials from the review request
    test_credentials = [
        ("jefferson@jmstudio.com", "JMStudio@2026!", "SUPER_ADMIN"),
        ("admin@lotopam.com", "Admin123!", "COMPANY_ADMIN"),
        ("agent001@lottolab.com", "Agent123!", "AGENT_POS"),  # From review request
    ]

    # Test shared endpoints first (no auth required)
    print(f"\n🌐 Testing public endpoints...")
    tester.test_shared_endpoints()

    # Test each role
    for email, password, expected_role in test_credentials:
        print(f"\n" + "="*60)
        print(f"🎭 Testing {expected_role} Role")
        print(f"📧 Email: {email}")
        print("="*60)
        
        # Login
        login_success, login_response = tester.test_login(email, password)
        if not login_success:
            print(f"❌ Login failed for {email}, skipping role tests")
            overall_success = False
            continue
            
        # Verify role matches expectation
        actual_role = tester.user_data.get('role')
        if actual_role != expected_role:
            print(f"❌ Role mismatch - Expected: {expected_role}, Got: {actual_role}")
            overall_success = False
        
        # Verify redirect path
        expected_redirects = {
            "SUPER_ADMIN": "/super/dashboard",
            "COMPANY_ADMIN": "/company/dashboard", 
            "AGENT_POS": "/pos"
        }
        actual_redirect = login_response.get('redirect_path')
        expected_redirect = expected_redirects.get(expected_role)
        if actual_redirect != expected_redirect:
            print(f"❌ Redirect mismatch - Expected: {expected_redirect}, Got: {actual_redirect}")
        else:
            print(f"✅ Correct redirect path: {actual_redirect}")
        
        # Test role-specific endpoints
        if actual_role == "SUPER_ADMIN":
            tester.test_super_admin_flows()
        elif actual_role == "COMPANY_ADMIN":
            tester.test_company_admin_flows()
        elif actual_role == "AGENT_POS":
            tester.test_pos_flows()
        
        # Test RBAC violations
        tester.test_rbac_violations()
        
        # Reset token for next user
        tester.token = None
        tester.user_data = None

    # Print final summary
    print(f"\n" + "="*60)
    print(f"📊 TEST SUMMARY")
    print(f"="*60)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")

    if tester.failed_tests:
        print(f"\n❌ FAILED TESTS:")
        for test in tester.failed_tests:
            print(f"   • {test.get('test', 'Unknown')}")
            if 'error' in test:
                print(f"     Error: {test['error']}")
            else:
                print(f"     Expected: {test.get('expected')}, Got: {test.get('actual')}")

    if not overall_success:
        print(f"\n⚠️  Some critical issues found - check logs above")
        return 1
    
    print(f"\n🎉 All critical flows working!")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())