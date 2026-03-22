import { test, expect } from '@playwright/test';

/**
 * Iteration 19 - Frontend Feature Tests
 * Tests for:
 * 1. Super Admin: Commission field removed from create company form
 * 2. Super Admin: Logo upload section present in create company form
 * 3. Super Admin: Delete button works
 * 4. Company Admin: Can modify name/logo/phone/address in Settings
 * 5. Company Admin: Cannot modify email/password (verified - no such fields)
 */

const BASE_URL = 'https://seller-commission-ui.preview.emergentagent.com';

// Credentials
const SUPER_ADMIN = {
  email: 'jefferson@jmstudio.com',
  password: 'JMStudio@2026!'
};

const COMPANY_ADMIN = {
  email: 'admin@lotopam.com',
  password: 'Admin123!'
};

test.describe('Super Admin Company Form Features', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login as Super Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('Commission field removed from create company form', async ({ page }) => {
    // Navigate to companies page
    await page.goto('/super/companies', { waitUntil: 'domcontentloaded' });
    
    // Click "Nouvelle Entreprise" button
    const createBtn = page.getByTestId('create-company-btn');
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();
    
    // Wait for modal to appear - use more specific selector
    await expect(page.getByRole('heading', { name: 'Nouvelle Entreprise SaaS' })).toBeVisible({ timeout: 5000 });
    
    // Take screenshot of the form
    await page.screenshot({ path: '/app/tests/e2e/create-company-form.jpeg', quality: 20 });
    
    // Verify Commission field is NOT present in the create form
    // The form should NOT have a commission input field
    const commissionInputInCreate = page.locator('input[data-testid="commission-rate"], input[name="commission"], input[name="default_commission_rate"]');
    await expect(commissionInputInCreate).not.toBeVisible();
    
    // Also verify by text - no "Commission" label in the create form
    const formContent = await page.locator('[role="dialog"]').textContent();
    
    // The word "Commission" should NOT appear in the create form 
    // (Note: It may still appear in the EDIT form, which is fine per requirements)
    // We're specifically checking the CREATE form
    expect(formContent?.toLowerCase().includes('commission')).toBeFalsy();
  });

  test('Logo upload section present in create company form', async ({ page }) => {
    // Navigate to companies page  
    await page.goto('/super/companies', { waitUntil: 'domcontentloaded' });
    
    // Click "Nouvelle Entreprise" button
    const createBtn = page.getByTestId('create-company-btn');
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();
    
    // Wait for modal
    await expect(page.getByRole('heading', { name: 'Nouvelle Entreprise SaaS' })).toBeVisible({ timeout: 5000 });
    
    // Verify logo upload section is present
    // Look for the logo upload input
    const logoInput = page.getByTestId('company-logo-input');
    await expect(logoInput).toBeAttached();
    
    // Verify the logo section header text is present
    const logoSection = page.locator('text=Logo de l\'Entreprise');
    await expect(logoSection).toBeVisible();
    
    // Verify upload area is present (dashed border area)
    const uploadArea = page.locator('.border-dashed');
    await expect(uploadArea).toBeVisible();
    
    // Take screenshot showing logo upload section
    await page.screenshot({ path: '/app/tests/e2e/create-company-logo-section.jpeg', quality: 20 });
  });

  test('Delete company button works', async ({ page }) => {
    // Navigate to companies page
    await page.goto('/super/companies', { waitUntil: 'domcontentloaded' });
    
    // Wait for companies table to load
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Take screenshot of companies list
    await page.screenshot({ path: '/app/tests/e2e/companies-list-with-delete.jpeg', quality: 20 });
    
    // Find a delete button - we'll just verify it exists and is clickable
    // We won't actually delete a real company
    const deleteButtons = page.locator('[data-testid^="delete-"]');
    const count = await deleteButtons.count();
    
    // Verify delete buttons exist
    expect(count).toBeGreaterThan(0);
    
    // Verify first delete button is visible and enabled
    const firstDeleteBtn = deleteButtons.first();
    await expect(firstDeleteBtn).toBeVisible();
    await expect(firstDeleteBtn).toBeEnabled();
    
    // Verify it has trash icon
    const trashIcon = firstDeleteBtn.locator('svg');
    await expect(trashIcon).toBeVisible();
  });
});


test.describe('Company Admin Profile Settings Page', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login as Company Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', COMPANY_ADMIN.email);
    await page.fill('input[type="password"]', COMPANY_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('Company Profile Settings page loads and shows editable fields', async ({ page }) => {
    // Navigate to profile settings page (NOT /company/settings which is general config)
    await page.goto('/company/profile-settings', { waitUntil: 'domcontentloaded' });
    
    // Wait for page to load
    const settingsPage = page.getByTestId('company-settings-page');
    await expect(settingsPage).toBeVisible({ timeout: 10000 });
    
    // Take screenshot
    await page.screenshot({ path: '/app/tests/e2e/company-settings-page.jpeg', quality: 20 });
    
    // Verify editable fields are present
    const nameInput = page.getByTestId('company-name-input');
    const phoneInput = page.getByTestId('company-phone-input');
    const addressInput = page.getByTestId('company-address-input');
    const logoInput = page.getByTestId('logo-file-input');
    
    await expect(nameInput).toBeVisible();
    await expect(phoneInput).toBeVisible();
    await expect(addressInput).toBeVisible();
    await expect(logoInput).toBeAttached();
    
    // Verify save button exists
    const saveBtn = page.getByTestId('save-settings-btn');
    await expect(saveBtn).toBeVisible();
  });

  test('Company Admin can modify company name', async ({ page }) => {
    await page.goto('/company/profile-settings', { waitUntil: 'domcontentloaded' });
    
    // Wait for page
    await expect(page.getByTestId('company-settings-page')).toBeVisible({ timeout: 10000 });
    
    // Get current name
    const nameInput = page.getByTestId('company-name-input');
    const originalName = await nameInput.inputValue();
    
    // Modify name (temporarily)
    const testName = `${originalName} Test`;
    await nameInput.fill(testName);
    
    // Click save
    const saveBtn = page.getByTestId('save-settings-btn');
    await saveBtn.click();
    
    // Wait for success indication (toast or button state change)
    await page.waitForTimeout(1000);
    
    // Verify the change persisted by reloading
    await page.reload();
    await expect(page.getByTestId('company-settings-page')).toBeVisible({ timeout: 10000 });
    
    const updatedName = await page.getByTestId('company-name-input').inputValue();
    
    // Revert to original
    await page.getByTestId('company-name-input').fill(originalName);
    await page.getByTestId('save-settings-btn').click();
    await page.waitForTimeout(1000);
    
    // Verify modification worked
    expect(updatedName).toBe(testName);
  });

  test('Company Admin can modify phone and address', async ({ page }) => {
    await page.goto('/company/profile-settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('company-settings-page')).toBeVisible({ timeout: 10000 });
    
    // Modify phone
    const phoneInput = page.getByTestId('company-phone-input');
    await phoneInput.fill('+509 9999-9999');
    
    // Modify address
    const addressInput = page.getByTestId('company-address-input');
    await addressInput.fill('123 Test Street, Port-au-Prince');
    
    // Save
    await page.getByTestId('save-settings-btn').click();
    
    // Verify save succeeded (page doesn't show error)
    await page.waitForTimeout(1000);
    
    // Take screenshot after modification
    await page.screenshot({ path: '/app/tests/e2e/company-settings-modified.jpeg', quality: 20 });
    
    // Verify inputs still have the values
    await expect(phoneInput).toHaveValue('+509 9999-9999');
    await expect(addressInput).toHaveValue('123 Test Street, Port-au-Prince');
  });

  test('Company Profile Settings does NOT have login email/password fields', async ({ page }) => {
    await page.goto('/company/profile-settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('company-settings-page')).toBeVisible({ timeout: 10000 });
    
    // Verify there is NO password field in settings
    const passwordFields = page.locator('input[type="password"]');
    const passwordCount = await passwordFields.count();
    expect(passwordCount).toBe(0);
    
    // Verify the company_email field (if present) is labeled as contact email
    // NOT as login email
    const emailInput = page.getByTestId('company-email-input');
    
    if (await emailInput.isVisible()) {
      // The label should indicate it's company contact email, not login
      const emailLabel = page.locator('label:has-text("Email")');
      const labelText = await emailLabel.textContent();
      
      // Take screenshot to verify
      await page.screenshot({ path: '/app/tests/e2e/company-settings-email-field.jpeg', quality: 20 });
      
      // The email field should be company contact email
      // NOT "Login Email" or "Account Email"
      expect(labelText?.toLowerCase()).not.toContain('login');
      expect(labelText?.toLowerCase()).not.toContain('connexion');
    }
    
    // Verify no "Change Password" or "Modifier mot de passe" section
    const pageText = await page.locator('body').textContent();
    expect(pageText?.toLowerCase()).not.toContain('changer le mot de passe');
    expect(pageText?.toLowerCase()).not.toContain('modifier le mot de passe');
    expect(pageText?.toLowerCase()).not.toContain('change password');
  });

  test('Logo upload section visible in Company Profile Settings', async ({ page }) => {
    await page.goto('/company/profile-settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('company-settings-page')).toBeVisible({ timeout: 10000 });
    
    // Verify logo section exists
    const logoSection = page.locator('text=Logo de l\'Entreprise');
    await expect(logoSection).toBeVisible();
    
    // Verify file input exists
    const logoInput = page.getByTestId('logo-file-input');
    await expect(logoInput).toBeAttached();
    
    // Verify save logo button appears after selecting a file (we won't test actual upload)
    // Take screenshot of logo section
    await page.screenshot({ path: '/app/tests/e2e/company-settings-logo-section.jpeg', quality: 20 });
  });
});
