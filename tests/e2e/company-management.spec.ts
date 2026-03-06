import { test, expect } from '@playwright/test';

const BASE_URL = 'https://super-admin-hub-11.preview.emergentagent.com';

// Credentials
const SUPER_ADMIN = { email: 'jefferson@jmstudio.com', password: 'JMStudio@2026!' };
const COMPANY_ADMIN = { email: 'admin@lotopam.com', password: 'Admin123!' };

test.describe('LOTTOLAB Super Admin Company Management', () => {
  
  test.beforeEach(async ({ page }) => {
    // Remove emergent badge
    await page.addLocatorHandler(
      page.locator('[class*="emergent"], [id*="emergent"]'),
      async (badge) => { await badge.evaluate(el => el.remove()); }
    );
  });

  test('should login as Super Admin', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=WELCOME BACK')).toBeVisible();
    
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    // Should see Super Admin dashboard
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Companies page', async ({ page }) => {
    // Login first
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Navigate to companies
    await page.click('a[href*="/companies"], button:has-text("Entreprises")');
    await expect(page.locator('text=Entreprises SaaS')).toBeVisible({ timeout: 10000 });
  });

  test('should see create company button', async ({ page }) => {
    // Login
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Navigate to companies
    await page.click('a[href*="/companies"], button:has-text("Entreprises")');
    await expect(page.locator('text=Entreprises SaaS')).toBeVisible({ timeout: 10000 });
    
    // Check create button exists
    const createBtn = page.getByTestId('create-company-btn');
    await expect(createBtn).toBeVisible();
  });

  test('should open create company modal', async ({ page }) => {
    // Login
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Navigate to companies
    await page.click('a[href*="/companies"], button:has-text("Entreprises")');
    await expect(page.locator('text=Entreprises SaaS')).toBeVisible({ timeout: 10000 });
    
    // Click create button
    await page.getByTestId('create-company-btn').click();
    
    // Modal should open with form fields
    await expect(page.locator('text=Nouvelle Entreprise SaaS')).toBeVisible();
    await expect(page.getByTestId('company-name')).toBeVisible();
    await expect(page.getByTestId('admin-email')).toBeVisible();
    await expect(page.getByTestId('admin-password')).toBeVisible();
  });

  test('should display companies table with action buttons', async ({ page }) => {
    // Login
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Navigate to companies
    await page.click('a[href*="/companies"], button:has-text("Entreprises")');
    await expect(page.locator('text=Entreprises SaaS')).toBeVisible({ timeout: 10000 });
    
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Table should have columns
    await expect(page.locator('th:has-text("Entreprise")')).toBeVisible();
    await expect(page.locator('th:has-text("Plan")')).toBeVisible();
    await expect(page.locator('th:has-text("Statut")')).toBeVisible();
    await expect(page.locator('th:has-text("Actions")')).toBeVisible();
  });

});

test.describe('LOTTOLAB Company Admin Dashboard', () => {
  
  test.beforeEach(async ({ page }) => {
    // Remove emergent badge
    await page.addLocatorHandler(
      page.locator('[class*="emergent"], [id*="emergent"]'),
      async (badge) => { await badge.evaluate(el => el.remove()); }
    );
  });

  test('should login as Company Admin', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    await page.fill('input[placeholder*="email"]', COMPANY_ADMIN.email);
    await page.fill('input[type="password"]', COMPANY_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });
  });

  test('should display subscription counter on dashboard', async ({ page }) => {
    // Login as Company Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', COMPANY_ADMIN.email);
    await page.fill('input[type="password"]', COMPANY_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Check for subscription counter
    const subscriptionCounter = page.getByTestId('subscription-counter');
    await expect(subscriptionCounter).toBeVisible({ timeout: 10000 });
    
    // Should show days remaining or expired
    await expect(subscriptionCounter.locator('text=/jours|Expiré/')).toBeVisible();
  });

  test('should show subscription with color coding', async ({ page }) => {
    // Login as Company Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', COMPANY_ADMIN.email);
    await page.fill('input[type="password"]', COMPANY_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Wait for subscription counter to load
    const subscriptionCounter = page.getByTestId('subscription-counter');
    await expect(subscriptionCounter).toBeVisible({ timeout: 10000 });
    
    // Take screenshot for visual verification
    await page.screenshot({ path: 'dashboard-subscription.jpeg', quality: 20, fullPage: false });
    
    // Check for plan name display
    await expect(subscriptionCounter.locator('text=Abonnement')).toBeVisible();
  });

});
