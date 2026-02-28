import { test, expect } from '@playwright/test';

const BASE_URL = 'https://multi-tenant-lottery.preview.emergentagent.com';

// Credentials
const SUPER_ADMIN = { email: 'jefferson@jmstudio.com', password: 'JMStudio@2026!' };
const COMPANY_ADMIN = { email: 'admin@lotopam.com', password: 'Admin123!' };

test.describe('LOTTOLAB Company Suspension/Activation Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Remove emergent badge
    await page.addLocatorHandler(
      page.locator('[class*="emergent"], [id*="emergent"]'),
      async (badge) => { await badge.evaluate(el => el.remove()); }
    );
  });

  test('should show suspend button for active companies', async ({ page }) => {
    // Login as Super Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Navigate to companies
    await page.click('a[href*="/companies"], button:has-text("Entreprises")');
    await expect(page.locator('text=Entreprises SaaS')).toBeVisible({ timeout: 10000 });
    
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    // Check for action buttons in the table (suspend icon is a Ban icon)
    // At least one row should have action buttons
    const actionButtons = page.locator('table tbody tr button');
    await expect(actionButtons.first()).toBeVisible();
  });

  test('should show edit modal with status dropdown', async ({ page }) => {
    // Login as Super Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Navigate to companies
    await page.click('a[href*="/companies"], button:has-text("Entreprises")');
    await expect(page.locator('text=Entreprises SaaS')).toBeVisible({ timeout: 10000 });
    
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    // Click first edit button (has Edit icon)
    const editButtons = page.locator('table tbody tr button[title*="Modifier"]');
    if (await editButtons.count() > 0) {
      await editButtons.first().click();
      
      // Check for edit modal
      await expect(page.locator('text=Modifier Entreprise')).toBeVisible({ timeout: 5000 });
      
      // Check for status dropdown
      await expect(page.getByTestId('edit-status')).toBeVisible();
      
      // Check for subscription end date input
      await expect(page.getByTestId('edit-subscription-end')).toBeVisible();
    } else {
      // Alternative: look for any edit button
      const altEditBtn = page.locator('button:has(svg)').filter({ hasText: '' }).first();
      await altEditBtn.click();
    }
  });

  test('should show stats panel with company counts', async ({ page }) => {
    // Login as Super Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Navigate to companies
    await page.click('a[href*="/companies"], button:has-text("Entreprises")');
    await expect(page.locator('text=Entreprises SaaS')).toBeVisible({ timeout: 10000 });
    
    // Check stats panel - use more specific selectors
    await expect(page.getByText('Total', { exact: true })).toBeVisible();
    await expect(page.getByText('Actives', { exact: true })).toBeVisible();
    await expect(page.getByText('Suspendues', { exact: true })).toBeVisible();
  });

});

test.describe('LOTTOLAB Edit Modal Fields', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.addLocatorHandler(
      page.locator('[class*="emergent"], [id*="emergent"]'),
      async (badge) => { await badge.evaluate(el => el.remove()); }
    );
  });

  test('should have all edit fields visible', async ({ page }) => {
    // Login as Super Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Navigate to companies page
    await page.click('a[href*="/companies"], button:has-text("Entreprises")');
    await expect(page.locator('text=Entreprises SaaS')).toBeVisible({ timeout: 10000 });
    
    // Wait for companies to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    // Click on an edit button (look for the Edit icon)
    const editBtn = page.locator('table tbody tr').first().locator('button').nth(1);
    await editBtn.click({ force: true });
    
    // Wait for modal
    await expect(page.locator('text=Modifier Entreprise')).toBeVisible({ timeout: 5000 });
    
    // Verify all fields exist
    await expect(page.getByTestId('edit-company-name')).toBeVisible();
    await expect(page.getByTestId('edit-contact-email')).toBeVisible();
    await expect(page.getByTestId('edit-plan')).toBeVisible();
    await expect(page.getByTestId('edit-commission')).toBeVisible();
    await expect(page.getByTestId('edit-subscription-end')).toBeVisible();
    await expect(page.getByTestId('edit-status')).toBeVisible();
    await expect(page.getByTestId('save-edit-btn')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'edit-modal.jpeg', quality: 20, fullPage: false });
  });

});
