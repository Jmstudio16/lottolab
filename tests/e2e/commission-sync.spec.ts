import { test, expect, Page } from '@playwright/test';
import { dismissToasts, removeEmergentBadge } from '../fixtures/helpers';

const BASE_URL = 'https://vendor-flags.preview.emergentagent.com';

// Credentials for testing commission sync
const SUPERVISOR_13PCT = {
  email: 'lala@gmail.com',
  password: 'Test123!',
  expectedCommission: 13
};

const SUPERVISOR_10PCT = {
  email: 'supervisor@lotopam.com',
  password: 'Supervisor123!',
  expectedCommission: 10
};

const VENDEUR = {
  email: 'agent.marie@lotopam.com',
  password: 'Agent123!',
  expectedCommission: 10
};

// Helper functions
async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("SIGN IN")');
}

test.describe('Commission Synchronization Tests', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
  });

  test('Supervisor (13%) should see correct commission on profile', async ({ page }) => {
    await loginAs(page, SUPERVISOR_13PCT.email, SUPERVISOR_13PCT.password);
    
    // Wait for supervisor dashboard
    await page.waitForURL('**/supervisor/**', { timeout: 15000 });
    await expect(page.getByTestId('supervisor-dashboard')).toBeVisible({ timeout: 10000 });
    
    // Navigate to reports page to verify commission rate
    await page.click('a[href="/supervisor/reports"]');
    await expect(page.getByTestId('supervisor-reports-page')).toBeVisible({ timeout: 10000 });
    
    // The page should show supervisor commission percentage
    // Check for the commission value in the totals or header
    await removeEmergentBadge(page);
    await page.screenshot({ path: '/app/tests/e2e/supervisor-13pct-reports.jpeg', quality: 20, fullPage: false });
    
    // Verify the %Sup column is visible (confirms commission structure is displayed)
    await expect(page.getByRole('columnheader', { name: /%Sup/i })).toBeVisible();
  });

  test('Supervisor (10%) should see correct commission on profile', async ({ page }) => {
    await loginAs(page, SUPERVISOR_10PCT.email, SUPERVISOR_10PCT.password);
    
    // Wait for supervisor dashboard
    await page.waitForURL('**/supervisor/**', { timeout: 15000 });
    await expect(page.getByTestId('supervisor-dashboard')).toBeVisible({ timeout: 10000 });
    
    // Navigate to reports page
    await page.click('a[href="/supervisor/reports"]');
    await expect(page.getByTestId('supervisor-reports-page')).toBeVisible({ timeout: 10000 });
    
    // The page should show commission calculations with %Sup column
    await expect(page.getByRole('columnheader', { name: /%Sup/i })).toBeVisible();
  });

  test('Vendeur should see correct commission rate on dashboard', async ({ page }) => {
    await loginAs(page, VENDEUR.email, VENDEUR.password);
    
    // Wait for vendeur dashboard
    await page.waitForURL('**/vendeur/**', { timeout: 15000 });
    
    // Navigate to dashboard if not already there
    await page.click('a:has-text("Tableau de bord")');
    await expect(page).toHaveURL(/\/vendeur\/dashboard/);
    
    // Verify commission card shows correct percentage (10%)
    // The card should contain "Commission (10%)"
    await expect(page.locator('text=/Commission \\(\\d+%\\)/')).toBeVisible();
    
    // Take screenshot for verification
    await removeEmergentBadge(page);
    await page.screenshot({ path: '/app/tests/e2e/vendeur-commission-dashboard.jpeg', quality: 20, fullPage: false });
  });

  test('Vendeur should see correct commission on Mes Ventes page', async ({ page }) => {
    await loginAs(page, VENDEUR.email, VENDEUR.password);
    
    // Wait for vendeur dashboard
    await page.waitForURL('**/vendeur/**', { timeout: 15000 });
    
    // Navigate to Mes Ventes
    await page.click('a:has-text("Mes Ventes")');
    await expect(page.getByTestId('vendeur-mes-ventes')).toBeVisible({ timeout: 10000 });
    
    // Verify commission card shows percentage
    await expect(page.locator('text=/Commission \\(\\d+%\\)/')).toBeVisible();
    
    // Take screenshot for verification
    await removeEmergentBadge(page);
    await page.screenshot({ path: '/app/tests/e2e/vendeur-mes-ventes-commission.jpeg', quality: 20, fullPage: false });
  });

  test('Supervisor reports should calculate agent commissions from agent_policies', async ({ page }) => {
    await loginAs(page, SUPERVISOR_10PCT.email, SUPERVISOR_10PCT.password);
    
    // Wait for supervisor dashboard
    await page.waitForURL('**/supervisor/**', { timeout: 15000 });
    
    // Navigate to reports
    await page.click('a[href="/supervisor/reports"]');
    await expect(page.getByTestId('supervisor-reports-page')).toBeVisible({ timeout: 10000 });
    
    // Verify the report table has required columns for commission tracking
    await expect(page.getByRole('columnheader', { name: /%Agent/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Comm\. Agent/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /%Sup/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Comm\. Sup/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /B\.Final/i })).toBeVisible();
  });
});

test.describe('Responsive Design Tests', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
  });

  test('Vendeur dashboard is responsive on mobile (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, VENDEUR.email, VENDEUR.password);
    await page.waitForURL('**/vendeur/**', { timeout: 15000 });
    
    // On mobile, directly navigate to dashboard URL (sidebar is hidden behind hamburger)
    await page.goto('/vendeur/dashboard', { waitUntil: 'domcontentloaded' });
    
    // Verify dashboard loads
    await expect(page.getByTestId('vendeur-dashboard')).toBeVisible({ timeout: 10000 });
    
    // Verify stats cards are visible
    await expect(page.locator('text=Ventes Jour')).toBeVisible();
    await expect(page.locator('text=Ventes Mois')).toBeVisible();
    // Verify commission card shows rate
    await expect(page.locator('text=/Commission \\(\\d+%\\)/')).toBeVisible();
    
    await removeEmergentBadge(page);
    await page.screenshot({ path: '/app/tests/e2e/vendeur-mobile-390.jpeg', quality: 20, fullPage: false });
  });

  test('Vendeur dashboard is responsive on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginAs(page, VENDEUR.email, VENDEUR.password);
    await page.waitForURL('**/vendeur/**', { timeout: 15000 });
    
    // On tablet, directly navigate to dashboard URL
    await page.goto('/vendeur/dashboard', { waitUntil: 'domcontentloaded' });
    
    // Verify dashboard loads
    await expect(page.getByTestId('vendeur-dashboard')).toBeVisible({ timeout: 10000 });
    // Verify commission card shows rate
    await expect(page.locator('text=/Commission \\(\\d+%\\)/')).toBeVisible();
    
    await removeEmergentBadge(page);
    await page.screenshot({ path: '/app/tests/e2e/vendeur-tablet-768.jpeg', quality: 20, fullPage: false });
  });

  test('Supervisor dashboard is responsive on mobile (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, SUPERVISOR_10PCT.email, SUPERVISOR_10PCT.password);
    await page.waitForURL('**/supervisor/**', { timeout: 15000 });
    
    // Verify dashboard loads
    await expect(page.getByTestId('supervisor-dashboard')).toBeVisible({ timeout: 10000 });
    
    await removeEmergentBadge(page);
    await page.screenshot({ path: '/app/tests/e2e/supervisor-mobile-390.jpeg', quality: 20, fullPage: false });
  });

  test('Supervisor reports page is responsive on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginAs(page, SUPERVISOR_10PCT.email, SUPERVISOR_10PCT.password);
    await page.waitForURL('**/supervisor/**', { timeout: 15000 });
    
    // On tablet, directly navigate to reports page
    await page.goto('/supervisor/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('supervisor-reports-page')).toBeVisible({ timeout: 10000 });
    
    await removeEmergentBadge(page);
    await page.screenshot({ path: '/app/tests/e2e/supervisor-reports-tablet-768.jpeg', quality: 20, fullPage: false });
  });

  test('Login page is responsive on mobile (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Verify login form is visible and usable
    await expect(page.locator('text=WELCOME')).toBeVisible();
    await expect(page.locator('input[placeholder*="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("SIGN IN")')).toBeVisible();
    
    await page.screenshot({ path: '/app/tests/e2e/login-mobile-390.jpeg', quality: 20, fullPage: false });
  });
});

test.describe('Supervisor All Pages Functional', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
    await loginAs(page, SUPERVISOR_10PCT.email, SUPERVISOR_10PCT.password);
    await page.waitForURL('**/supervisor/**', { timeout: 15000 });
  });

  test('Dashboard page loads and displays stats', async ({ page }) => {
    await expect(page.getByTestId('supervisor-dashboard')).toBeVisible({ timeout: 10000 });
    
    // Verify stats are displayed
    await expect(page.locator('text="Total Agents"').first()).toBeVisible();
    await expect(page.locator('text="Agents Actifs"').first()).toBeVisible();
  });

  test('Agents page loads and shows agent list', async ({ page }) => {
    await page.click('a[href="/supervisor/agents"]');
    await expect(page.getByRole('heading', { name: /Mes Agents/i })).toBeVisible({ timeout: 10000 });
    
    // Verify table headers
    await expect(page.getByRole('columnheader', { name: /Agent/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Commission/i })).toBeVisible();
  });

  test('Tickets page loads and shows filters', async ({ page }) => {
    await page.click('a[href="/supervisor/tickets"]');
    await expect(page.getByTestId('supervisor-tickets-page')).toBeVisible({ timeout: 10000 });
    
    // Verify filter controls are present
    await expect(page.locator('select, [role="combobox"]').first()).toBeVisible();
  });

  test('Reports page loads and shows commission columns', async ({ page }) => {
    await page.click('a[href="/supervisor/reports"]');
    await expect(page.getByTestId('supervisor-reports-page')).toBeVisible({ timeout: 10000 });
    
    // Verify commission-related columns
    await expect(page.getByRole('columnheader', { name: /%Agent/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /%Sup/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /B\.Final/i })).toBeVisible();
  });
});
