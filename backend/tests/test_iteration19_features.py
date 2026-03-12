"""
Iteration 19 Feature Tests
Tests for:
1. Super Admin create company form - Commission field removed (API level)
2. Super Admin create company - Logo upload endpoint works
3. DELETE /api/saas/companies/{id} - Company deletion works
4. Company Settings - name/logo/phone/address modification
5. Company Admin cannot modify email/password
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vendor-flags.preview.emergentagent.com').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "jefferson@jmstudio.com"
SUPER_ADMIN_PASSWORD = "JMStudio@2026!"
COMPANY_ADMIN_EMAIL = "admin@lotopam.com"
COMPANY_ADMIN_PASSWORD = "Admin123!"


@pytest.fixture
def super_admin_token():
    """Get Super Admin auth token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Super Admin login failed: {response.status_code}")
    return response.json().get("token")


@pytest.fixture
def company_admin_token():
    """Get Company Admin auth token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": COMPANY_ADMIN_EMAIL, "password": COMPANY_ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Company Admin login failed: {response.status_code}")
    return response.json().get("token")


class TestSuperAdminCompanyLogoUpload:
    """Test logo upload for Super Admin company creation"""

    def test_logo_upload_endpoint_exists(self, super_admin_token):
        """Test POST /api/saas/companies/{id}/logo endpoint exists"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First get list of companies
        response = requests.get(f"{BASE_URL}/api/saas/companies", headers=headers)
        assert response.status_code == 200
        companies = response.json()
        
        if len(companies) == 0:
            pytest.skip("No companies to test logo upload")
        
        company_id = companies[0]["company_id"]
        
        # Create a dummy image file (1x1 PNG)
        png_header = b'\x89PNG\r\n\x1a\n'
        png_data = png_header + b'\x00' * 100  # Minimal valid-ish PNG
        
        # Actually create a proper small PNG
        import struct
        import zlib
        
        def create_minimal_png():
            width, height = 1, 1
            
            def png_chunk(chunk_type, data):
                chunk = chunk_type + data
                crc = zlib.crc32(chunk) & 0xffffffff
                return struct.pack('>I', len(data)) + chunk + struct.pack('>I', crc)
            
            png = b'\x89PNG\r\n\x1a\n'
            png += png_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            raw_data = b'\x00' + b'\x00\x00\x00'  # Filter byte + RGB
            compressed = zlib.compress(raw_data)
            png += png_chunk(b'IDAT', compressed)
            png += png_chunk(b'IEND', b'')
            return png
        
        png_data = create_minimal_png()
        
        files = {
            'file': ('test-logo.png', io.BytesIO(png_data), 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/saas/companies/{company_id}/logo",
            headers=headers,
            files=files
        )
        
        # Should return 200 (or 201) on success, or 400 for validation error
        assert response.status_code in [200, 201, 400], f"Unexpected status: {response.status_code}, response: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "logo_url" in data or "message" in data

    def test_logo_upload_rejects_invalid_file_type(self, super_admin_token):
        """Test logo upload rejects non-image files"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Get a company ID
        response = requests.get(f"{BASE_URL}/api/saas/companies", headers=headers)
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No companies available")
        
        company_id = response.json()[0]["company_id"]
        
        # Try to upload a text file
        files = {
            'file': ('test.txt', io.BytesIO(b'This is not an image'), 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/saas/companies/{company_id}/logo",
            headers=headers,
            files=files
        )
        
        # Should reject with 400
        assert response.status_code == 400, f"Should reject non-image files: {response.status_code}"


class TestSuperAdminDeleteCompany:
    """Test DELETE /api/saas/companies/{id} endpoint"""

    def test_delete_company_endpoint_exists(self, super_admin_token):
        """Test DELETE endpoint exists and returns proper response"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First, create a test company to delete
        unique_suffix = str(int(os.urandom(4).hex(), 16))[:8]
        test_company_data = {
            "company_name": f"TEST_DELETE_COMPANY_{unique_suffix}",
            "contact_email": f"test_delete_{unique_suffix}@test.com",
            "admin_password": "TestPass123!",
            "admin_name": "Test Admin",
            "plan_id": "Starter",
            "timezone": "America/Port-au-Prince",
            "currency": "HTG",
            "max_agents": 10,
            "max_daily_sales": 100000.0
        }
        
        # Create company
        create_response = requests.post(
            f"{BASE_URL}/api/saas/companies/full-create",
            headers=headers,
            json=test_company_data
        )
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create test company: {create_response.text}")
        
        company_id = create_response.json()["company_id"]
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/saas/companies/{company_id}",
            headers=headers
        )
        
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.status_code}, {delete_response.text}"
        
        delete_data = delete_response.json()
        assert "message" in delete_data
        assert company_id in str(delete_data) or "supprimé" in delete_data.get("message", "").lower() or "archivé" in delete_data.get("message", "").lower()

    def test_delete_nonexistent_company_returns_404(self, super_admin_token):
        """Test deleting non-existent company returns 404"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        response = requests.delete(
            f"{BASE_URL}/api/saas/companies/nonexistent_company_id_12345",
            headers=headers
        )
        
        assert response.status_code == 404


class TestCompanyAdminSettingsUpdate:
    """Test Company Admin can modify name/logo/phone/address"""

    def test_company_profile_get(self, company_admin_token):
        """Test GET /api/company/profile returns company settings"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/company/profile", headers=headers)
        
        assert response.status_code == 200, f"Failed to get profile: {response.status_code}"
        
        data = response.json()
        # Verify expected fields exist
        assert "company_id" in data
        assert "company_name" in data or "name" in data

    def test_company_profile_update_name(self, company_admin_token):
        """Test Company Admin can update company name"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # First get current name
        get_response = requests.get(f"{BASE_URL}/api/company/profile", headers=headers)
        assert get_response.status_code == 200
        
        original_name = get_response.json().get("company_name", "LotoPam")
        
        # Update with new name
        new_name = f"{original_name} Updated"
        update_response = requests.put(
            f"{BASE_URL}/api/company/profile",
            headers=headers,
            json={"company_name": new_name}
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.status_code}, {update_response.text}"
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/company/profile", headers=headers)
        updated_name = verify_response.json().get("company_name")
        
        # Revert to original
        requests.put(
            f"{BASE_URL}/api/company/profile",
            headers=headers,
            json={"company_name": original_name}
        )
        
        assert updated_name == new_name, f"Name not updated: expected {new_name}, got {updated_name}"

    def test_company_profile_update_phone(self, company_admin_token):
        """Test Company Admin can update phone"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        update_response = requests.put(
            f"{BASE_URL}/api/company/profile",
            headers=headers,
            json={"company_phone": "+509 1234-5678"}
        )
        
        assert update_response.status_code == 200, f"Phone update failed: {update_response.status_code}"

    def test_company_profile_update_address(self, company_admin_token):
        """Test Company Admin can update address"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        update_response = requests.put(
            f"{BASE_URL}/api/company/profile",
            headers=headers,
            json={"company_address": "123 Rue Test, Port-au-Prince"}
        )
        
        assert update_response.status_code == 200, f"Address update failed: {update_response.status_code}"

    def test_company_logo_upload_endpoint(self, company_admin_token):
        """Test Company Admin can upload logo via /api/company/logo/upload"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Create minimal PNG
        import struct
        import zlib
        
        def create_minimal_png():
            width, height = 10, 10
            
            def png_chunk(chunk_type, data):
                chunk = chunk_type + data
                crc = zlib.crc32(chunk) & 0xffffffff
                return struct.pack('>I', len(data)) + chunk + struct.pack('>I', crc)
            
            png = b'\x89PNG\r\n\x1a\n'
            png += png_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            raw_data = b''
            for _ in range(height):
                raw_data += b'\x00' + b'\xff\x00\x00' * width  # Filter + RGB red
            compressed = zlib.compress(raw_data)
            png += png_chunk(b'IDAT', compressed)
            png += png_chunk(b'IEND', b'')
            return png
        
        png_data = create_minimal_png()
        
        files = {
            'file': ('company-logo.png', io.BytesIO(png_data), 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/company/logo/upload",
            headers=headers,
            files=files
        )
        
        # Should work for company admin
        assert response.status_code in [200, 201], f"Logo upload failed: {response.status_code}, {response.text}"


class TestCompanyAdminCannotModifyCredentials:
    """Test Company Admin cannot modify login email/password"""

    def test_company_profile_no_email_field(self, company_admin_token):
        """Verify company_email in profile is NOT the login email"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Get profile
        response = requests.get(f"{BASE_URL}/api/company/profile", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        # company_email is contact email, not login email
        # The login email is stored in users collection, not companies collection
        # Modifying company_email does NOT change login credentials
        
        # Try to update company_email (this is company contact, not login)
        update_response = requests.put(
            f"{BASE_URL}/api/company/profile",
            headers=headers,
            json={"company_email": "new_contact@company.com"}
        )
        
        # This should succeed because company_email is just contact info
        assert update_response.status_code == 200
        
        # But the login should still work with original credentials
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COMPANY_ADMIN_EMAIL, "password": COMPANY_ADMIN_PASSWORD}
        )
        
        assert login_response.status_code == 200, "Login should still work - company_email change doesn't affect login"

    def test_no_password_change_endpoint_for_company_admin(self, company_admin_token):
        """Verify there's no self-service password change that affects login"""
        headers = {"Authorization": f"Bearer {company_admin_token}"}
        
        # Try to call user profile update (if it exists) - should not allow password change
        # Or verify the endpoint doesn't exist / doesn't accept password
        
        # Try common password change patterns
        endpoints_to_try = [
            ("/api/user/password", {"current_password": COMPANY_ADMIN_PASSWORD, "new_password": "NewPassword123!"}),
            ("/api/auth/change-password", {"old_password": COMPANY_ADMIN_PASSWORD, "new_password": "NewPassword123!"}),
            ("/api/company/profile", {"password": "NewPassword123!"}),
        ]
        
        for endpoint, payload in endpoints_to_try:
            response = requests.put(
                f"{BASE_URL}{endpoint}",
                headers=headers,
                json=payload
            )
            
            # Either 404 (endpoint doesn't exist) or 400/422 (field not accepted)
            # or 200 but password field ignored
            if response.status_code == 200:
                # Verify login still works with original password
                login_check = requests.post(
                    f"{BASE_URL}/api/auth/login",
                    json={"email": COMPANY_ADMIN_EMAIL, "password": COMPANY_ADMIN_PASSWORD}
                )
                assert login_check.status_code == 200, f"Password may have changed via {endpoint}!"


class TestSuperAdminCompanyCreateForm:
    """Test Super Admin company creation form doesn't require commission field"""

    def test_create_company_without_commission(self, super_admin_token):
        """Test company can be created without default_commission_rate in payload"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        unique_suffix = str(int(os.urandom(4).hex(), 16))[:8]
        
        # Create company WITHOUT commission field
        company_data = {
            "company_name": f"TEST_NO_COMMISSION_{unique_suffix}",
            "contact_email": f"test_nocomm_{unique_suffix}@test.com",
            "admin_password": "TestPass123!",
            "admin_name": "Test Admin",
            "plan_id": "Starter",
            "timezone": "America/Port-au-Prince",
            "currency": "HTG",
            "max_agents": 10,
            "max_daily_sales": 100000.0
            # NOTE: No default_commission_rate field!
        }
        
        response = requests.post(
            f"{BASE_URL}/api/saas/companies/full-create",
            headers=headers,
            json=company_data
        )
        
        assert response.status_code == 200, f"Should create without commission: {response.status_code}, {response.text}"
        
        # Clean up - delete the test company
        if response.status_code == 200:
            company_id = response.json().get("company_id")
            if company_id:
                requests.delete(
                    f"{BASE_URL}/api/saas/companies/{company_id}",
                    headers=headers
                )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
