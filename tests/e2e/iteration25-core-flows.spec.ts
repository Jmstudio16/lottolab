import { test, expect } from '@playwright/test';

const BASE_URL = 'https://seller-commission-ui.preview.emergentagent.com';

// Credentials from requirements
const SUPER_ADMIN = { email: 'admin@lottolab.com', password: '123456' };
const COMPANY_ADMIN = { email: 'admin@lotopam.com', password: 'Admin123!' };

// Extended timeout for login redirects
const LOGIN_TIMEOUT = 15000;

test.describe('Iteration 25 - Core Authentication Flows', () => {
  
  test.beforeEach(async ({ page }) => {
    // Remove emergent badge overlay
    await page.addLocatorHandler(
      page.locator('[class*="emergent"], [id*="emergent"]'),
      async (badge) => { await badge.evaluate(el => el.remove()); }
    );
  });

  test('Super Admin login with admin@lottolab.com redirects to /super/dashboard', async ({ page }) => {
    // Go to login page
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Verify login page loads
    await expect(page.locator('text=WELCOME')).toBeVisible();
    await expect(page.getByTestId('login-email-input')).toBeVisible();
    await expect(page.getByTestId('login-password-input')).toBeVisible();
    
    // Fill credentials
    await page.getByTestId('login-email-input').fill(SUPER_ADMIN.email);
    await page.getByTestId('login-password-input').fill(SUPER_ADMIN.password);
    
    // Click sign in
    await page.getByTestId('login-submit-button').click();
    
    // Wait for dashboard content to appear with extended timeout
    await expect(page.locator('text=Super Admin Overview')).toBeVisible({ timeout: LOGIN_TIMEOUT });
    
    // Take screenshot
    await page.screenshot({ path: 'super-admin-login-success.jpeg', quality: 20, fullPage: false });
  });

  test('Super Admin dashboard displays statistics correctly', async ({ page }) => {
    // Login first
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('login-email-input').fill(SUPER_ADMIN.email);
    await page.getByTestId('login-password-input').fill(SUPER_ADMIN.password);
    await page.getByTestId('login-submit-button').click();
    
    // Wait for dashboard to load with extended timeout
    await expect(page.locator('text=Super Admin Overview')).toBeVisible({ timeout: LOGIN_TIMEOUT });
    
    // Verify stat cards are present (Total Companies, Active Companies, Total Agents, Tickets Today)
    await expect(page.locator('text=Total Companies')).toBeVisible();
    await expect(page.locator('text=Active Companies')).toBeVisible();
    await expect(page.locator('text=Total Agents')).toBeVisible();
    await expect(page.locator('text=Tickets Today')).toBeVisible();
    
    // Verify Recent Companies table is present
    await expect(page.locator('text=RECENT COMPANIES')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'super-admin-dashboard-stats.jpeg', quality: 20, fullPage: false });
  });

  test('Super Admin can logout and redirects to /login', async ({ page }) => {
    // Login first
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('login-email-input').fill(SUPER_ADMIN.email);
    await page.getByTestId('login-password-input').fill(SUPER_ADMIN.password);
    await page.getByTestId('login-submit-button').click();
    
    // Wait for dashboard to load
    await expect(page.locator('text=Super Admin Overview')).toBeVisible({ timeout: LOGIN_TIMEOUT });
    
    // Find and click logout button - it's in the sidebar
    const logoutBtn = page.locator('button:has-text("Logout")');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    
    // Verify redirect to login page - check for login form elements
    await expect(page.getByTestId('login-email-input')).toBeVisible({ timeout: LOGIN_TIMEOUT });
    await expect(page.locator('text=WELCOME')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'logout-redirect-login.jpeg', quality: 20, fullPage: false });
  });

  test('Invalid credentials shows error and stays on login page', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Fill invalid credentials
    await page.getByTestId('login-email-input').fill('invalid@email.com');
    await page.getByTestId('login-password-input').fill('wrongpassword');
    await page.getByTestId('login-submit-button').click();
    
    // Wait for response
    await page.waitForLoadState('networkidle');
    
    // Should still see login form
    await expect(page.getByTestId('login-email-input')).toBeVisible();
    await expect(page.locator('text=WELCOME')).toBeVisible();
    
    // Dashboard elements should NOT be visible
    await expect(page.locator('text=Super Admin Overview')).not.toBeVisible();
  });
});

test.describe('Iteration 25 - Landing Page', () => {
  
  test.beforeEach(async ({ page }) => {
    // Remove emergent badge overlay
    await page.addLocatorHandler(
      page.locator('[class*="emergent"], [id*="emergent"]'),
      async (badge) => { await badge.evaluate(el => el.remove()); }
    );
  });

  test('Landing page /home loads correctly', async ({ page }) => {
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Verify landing page has navigation with Fonctionnalités, Tarifs, Contact
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Fonctionnalités' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Tarifs' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Contact' })).toBeVisible();
    
    // Verify Connexion link in header (banner)
    await expect(page.getByRole('banner').getByRole('link', { name: 'Connexion' })).toBeVisible();
    
    // Verify main hero content
    await expect(page.locator('text=La Solution')).toBeVisible();
    await expect(page.locator('text=Complète de Loterie')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'landing-page-home.jpeg', quality: 20, fullPage: false });
  });

  test('Landing page Connexion link navigates to login', async ({ page }) => {
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Find and click Connexion link in header (banner)
    await page.getByRole('banner').getByRole('link', { name: 'Connexion' }).click();
    
    // Verify navigation to login page - check for login form
    await expect(page.getByTestId('login-email-input')).toBeVisible({ timeout: LOGIN_TIMEOUT });
    await expect(page.locator('text=WELCOME')).toBeVisible();
  });

  test('Landing page has WhatsApp floating button', async ({ page }) => {
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // The WhatsApp button is a fixed positioned button - use first() to avoid strict mode
    const fixedBottomRight = page.locator('.fixed.bottom-6.right-6').first();
    await expect(fixedBottomRight).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'landing-whatsapp-button.jpeg', quality: 20, fullPage: false });
  });
});

test.describe('Iteration 25 - API Health Check', () => {
  
  test('Health check API returns healthy status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.database).toBe('connected');
    expect(data.permissions).toBe('ok');
    expect(data.version).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });
});

test.describe('Iteration 25 - Company Admin Login', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.addLocatorHandler(
      page.locator('[class*="emergent"], [id*="emergent"]'),
      async (badge) => { await badge.evaluate(el => el.remove()); }
    );
  });

  test('Company Admin login redirects to /company/dashboard', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Fill Company Admin credentials
    await page.getByTestId('login-email-input').fill(COMPANY_ADMIN.email);
    await page.getByTestId('login-password-input').fill(COMPANY_ADMIN.password);
    await page.getByTestId('login-submit-button').click();
    
    // Wait for company dashboard - look for elements that indicate company dashboard
    // Company dashboard shows "Dashboard" title and company-specific elements
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: LOGIN_TIMEOUT });
    
    // Take screenshot
    await page.screenshot({ path: 'company-admin-login-success.jpeg', quality: 20, fullPage: false });
  });
});
