import { test, expect } from '@playwright/test';

const BASE_URL = 'https://lotto-system.preview.emergentagent.com';

// Credentials
const SUPER_ADMIN = { email: 'jefferson@jmstudio.com', password: 'JMStudio@2026!' };
const COMPANY_ADMIN = { email: 'admin@lotopam.com', password: 'Admin123!' };

test.describe('LOTTOLAB Golden Path - Full Flow Test', () => {
  
  test.beforeEach(async ({ page }) => {
    // Remove emergent badge
    await page.addLocatorHandler(
      page.locator('[class*="emergent"], [id*="emergent"]'),
      async (badge) => { await badge.evaluate(el => el.remove()); }
    );
  });

  test('Super Admin full journey: login -> companies -> view stats -> logout', async ({ page }) => {
    // Step 1: Login as Super Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Step 2: Verify Super Admin dashboard loads
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('SUPER ADMIN', { exact: true })).toBeVisible();
    
    // Step 3: Navigate to Companies
    await page.click('a:has-text("Companies"), button:has-text("Companies")');
    await expect(page.locator('text=Entreprises SaaS')).toBeVisible({ timeout: 10000 });
    
    // Step 4: Verify companies table
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const companyRows = page.locator('table tbody tr');
    expect(await companyRows.count()).toBeGreaterThan(0);
    
    // Step 5: Verify stats panel shows counts
    await expect(page.getByText('Total', { exact: true })).toBeVisible();
    await expect(page.getByText('Actives', { exact: true })).toBeVisible();
    
    // Step 6: Check action buttons are present
    const actionButtons = page.locator('table tbody tr').first().locator('button');
    expect(await actionButtons.count()).toBeGreaterThanOrEqual(4); // View, Edit, Suspend, Delete
    
    // Step 7: Logout
    await page.click('button:has-text("Logout"), button:has-text("Déconnexion")');
    await expect(page.locator('text=WELCOME BACK')).toBeVisible({ timeout: 10000 });
  });

  test('Company Admin full journey: login -> dashboard -> view subscription -> navigate menus', async ({ page }) => {
    // Step 1: Login as Company Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', COMPANY_ADMIN.email);
    await page.fill('input[type="password"]', COMPANY_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Step 2: Verify Company Admin dashboard
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('COMPANY ADMIN', { exact: true })).toBeVisible();
    
    // Step 3: Verify subscription counter
    const subscriptionCounter = page.getByTestId('subscription-counter');
    await expect(subscriptionCounter).toBeVisible();
    await expect(subscriptionCounter.locator('text=/jours|Expiré/')).toBeVisible();
    
    // Step 4: Navigate to Company Users
    await page.click('a:has-text("Company Users")');
    await page.waitForLoadState('domcontentloaded');
    
    // Step 5: Navigate back to Dashboard
    await page.click('a:has-text("Dashboard")');
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });
    
    // Step 6: Logout
    await page.click('button:has-text("Logout"), button:has-text("Déconnexion")');
    await expect(page.locator('text=WELCOME BACK')).toBeVisible({ timeout: 10000 });
  });

  test('Blocked login for invalid credentials', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Try with invalid credentials
    await page.fill('input[placeholder*="email"]', 'invalid@user.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button:has-text("SIGN IN")');
    
    // Should show error or stay on login page
    await page.waitForTimeout(2000);
    
    // Should not navigate to dashboard
    const url = page.url();
    expect(url).not.toContain('/dashboard');
  });

});

test.describe('LOTTOLAB Staff Management UI', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.addLocatorHandler(
      page.locator('[class*="emergent"], [id*="emergent"]'),
      async (badge) => { await badge.evaluate(el => el.remove()); }
    );
  });

  test('should navigate to Company Users page', async ({ page }) => {
    // Login as Company Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', COMPANY_ADMIN.email);
    await page.fill('input[type="password"]', COMPANY_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Navigate to Company Users
    await page.click('a:has-text("Company Users")');
    await page.waitForLoadState('domcontentloaded');
    
    // Take screenshot
    await page.screenshot({ path: 'company-users.jpeg', quality: 20, fullPage: false });
  });

});
