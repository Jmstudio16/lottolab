import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://lotto-system.preview.emergentagent.com';

// Super Admin credentials
const SUPER_ADMIN_EMAIL = 'jefferson@jmstudio.com';
const SUPER_ADMIN_PASSWORD = 'JMStudio@2026!';

// Agent credentials
const AGENT_EMAIL = 'agent.marie@lotopam.com';
const AGENT_PASSWORD = 'password';

// Helper to login as Super Admin
async function loginAsSuperAdmin(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', SUPER_ADMIN_EMAIL);
  await page.fill('input[type="password"]', SUPER_ADMIN_PASSWORD);
  await page.click('button:has-text("SIGN IN")');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

// Helper to login as Agent
async function loginAsAgent(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASSWORD);
  await page.click('button:has-text("SIGN IN")');
  // Agent redirects to new sale page /agent/pos
  await page.waitForURL('**/agent/**', { timeout: 15000 });
}

// Helper to remove Emergent badge overlay
async function removeEmergentBadge(page: Page) {
  await page.evaluate(() => {
    const badge = document.querySelector('[class*="emergent"], [id*="emergent-badge"]');
    if (badge) badge.remove();
  });
}

// ===========================================================================
// SUPER ADMIN RESULTS PAGE TESTS
// ===========================================================================

test.describe('Super Admin Results Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await removeEmergentBadge(page);
  });

  test('should navigate to Results Management page', async ({ page }) => {
    // Look for RESULT MANAGEMENT link in sidebar 
    const resultsLink = page.locator('a:has-text("RESULT MANAGEMENT")');
    await resultsLink.click({ timeout: 10000 });
    
    // Wait for the results page to load
    await expect(page.getByTestId('result-management-page')).toBeVisible({ timeout: 15000 });
    
    // Verify page header
    await expect(page.locator('text=LOTTERY RESULT MANAGEMENT')).toBeVisible();
  });

  test('should display publish result button', async ({ page }) => {
    // Navigate to Results page
    const resultsLink = page.locator('a:has-text("RESULT MANAGEMENT")');
    await resultsLink.click({ timeout: 10000 });
    
    // Wait for page load
    await expect(page.getByTestId('result-management-page')).toBeVisible({ timeout: 15000 });
    
    // Verify publish button exists
    const publishBtn = page.getByTestId('publish-result-btn');
    await expect(publishBtn).toBeVisible();
    await expect(publishBtn).toContainText('PUBLIER');
  });

  test('should open publish result modal', async ({ page }) => {
    // Navigate to Results page
    const resultsLink = page.locator('a:has-text("RESULT MANAGEMENT")');
    await resultsLink.click({ timeout: 10000 });
    await expect(page.getByTestId('result-management-page')).toBeVisible({ timeout: 15000 });
    
    // Click publish button
    await page.getByTestId('publish-result-btn').click();
    
    // Wait for modal to open
    await expect(page.locator('text=Publier un Nouveau Résultat')).toBeVisible({ timeout: 5000 });
    
    // Verify form elements
    await expect(page.locator('text=Loterie *')).toBeVisible();
    await expect(page.locator('text=Date du Tirage *')).toBeVisible();
    await expect(page.locator('text=Numéros Gagnants *')).toBeVisible();
  });

  test('should display stats cards on results page', async ({ page }) => {
    // Navigate to Results page
    const resultsLink = page.locator('a:has-text("RESULT MANAGEMENT")');
    await resultsLink.click({ timeout: 10000 });
    await expect(page.getByTestId('result-management-page')).toBeVisible({ timeout: 15000 });
    
    // Verify stats cards are visible
    await expect(page.locator('text=Résultats Publiés')).toBeVisible();
    await expect(page.locator('text=Loteries Actives')).toBeVisible();
    await expect(page.locator('text=Tickets Gagnants')).toBeVisible();
    await expect(page.locator('text=Tickets Traités')).toBeVisible();
  });

  test('should display filter controls', async ({ page }) => {
    // Navigate to Results page
    const resultsLink = page.locator('a:has-text("RESULT MANAGEMENT")');
    await resultsLink.click({ timeout: 10000 });
    await expect(page.getByTestId('result-management-page')).toBeVisible({ timeout: 15000 });
    
    // Verify filter elements
    await expect(page.locator('input[placeholder*="Rechercher"]')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.locator('text=Effacer')).toBeVisible();
  });
});

// ===========================================================================
// AGENT NEW SALE PAGE TESTS (Agent redirects to new sale page on login)
// ===========================================================================

test.describe('Agent New Sale Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
  });

  test('should display new sale page after login', async ({ page }) => {
    // Agent redirects to new sale page
    await expect(page.getByTestId('agent-new-sale-page')).toBeVisible({ timeout: 15000 });
    
    // Verify page header using role
    await expect(page.getByRole('heading', { name: 'Nouvelle Vente' })).toBeVisible();
  });

  test('should display lottery list', async ({ page }) => {
    await expect(page.getByTestId('agent-new-sale-page')).toBeVisible({ timeout: 15000 });
    
    // Verify lottery cards are displayed
    await expect(page.locator('[data-testid^="lottery-card-"]').first()).toBeVisible({ timeout: 10000 });
    
    // Verify multiple lotteries exist
    const lotteryCount = await page.locator('[data-testid^="lottery-card-"]').count();
    expect(lotteryCount).toBeGreaterThan(0);
  });

  test('should display lottery status badges', async ({ page }) => {
    await expect(page.getByTestId('agent-new-sale-page')).toBeVisible({ timeout: 15000 });
    
    // Wait for lottery cards
    await expect(page.locator('[data-testid^="lottery-card-"]').first()).toBeVisible({ timeout: 10000 });
    
    // Check for status badges (Ouvert, Fermé, or time remaining)
    const hasBadges = await page.locator('[data-testid^="lottery-card-"] .bg-emerald-500, [data-testid^="lottery-card-"] .bg-red-500').count();
    expect(hasBadges).toBeGreaterThan(0);
  });

  test('should display Haiti timezone indicator', async ({ page }) => {
    await expect(page.getByTestId('agent-new-sale-page')).toBeVisible({ timeout: 15000 });
    
    // Look for Haiti timezone indicator
    await expect(page.locator('text=(Haiti)')).toBeVisible();
  });

  test('should display sidebar menu options', async ({ page }) => {
    await expect(page.getByTestId('agent-new-sale-page')).toBeVisible({ timeout: 15000 });
    
    // Verify sidebar menu items
    await expect(page.locator('a:has-text("Tableau de bord")')).toBeVisible();
    await expect(page.locator('a:has-text("Nouvelle Vente")')).toBeVisible();
    await expect(page.locator('a:has-text("Mes Tickets")')).toBeVisible();
    await expect(page.locator('a:has-text("Rechercher Fiches")')).toBeVisible();
    await expect(page.locator('a:has-text("Tirages Disponibles")')).toBeVisible();
    await expect(page.locator('a:has-text("Résultats")')).toBeVisible();
  });

  test('should navigate to dashboard from sidebar', async ({ page }) => {
    await expect(page.getByTestId('agent-new-sale-page')).toBeVisible({ timeout: 15000 });
    
    // Click dashboard link
    await page.click('a:has-text("Tableau de bord")', { force: true });
    
    // Wait for dashboard page
    await expect(page.getByTestId('agent-dashboard')).toBeVisible({ timeout: 15000 });
    
    // Verify dashboard elements
    await expect(page.locator('text=Bonjour')).toBeVisible();
  });

  test('should display agent info in sidebar', async ({ page }) => {
    await expect(page.getByTestId('agent-new-sale-page')).toBeVisible({ timeout: 15000 });
    
    // Verify agent info is displayed - "Marie Dupont" from screenshot
    await expect(page.locator('text=Marie Dupont')).toBeVisible();
    await expect(page.getByRole('complementary').getByText('LotoPam Center')).toBeVisible();
  });
});

// ===========================================================================
// AGENT DASHBOARD TESTS
// ===========================================================================

test.describe('Agent Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    // Navigate to dashboard from new sale page
    await page.click('a:has-text("Tableau de bord")', { force: true });
  });

  test('should display agent dashboard', async ({ page }) => {
    // Wait for dashboard to load
    await expect(page.getByTestId('agent-dashboard')).toBeVisible({ timeout: 15000 });
    
    // Verify welcome header
    await expect(page.locator('text=Bonjour')).toBeVisible();
  });

  test('should display quick action buttons', async ({ page }) => {
    await expect(page.getByTestId('agent-dashboard')).toBeVisible({ timeout: 15000 });
    
    // Verify quick actions are present
    await expect(page.locator('button:has-text("Nouvelle Vente")')).toBeVisible();
    await expect(page.locator('button:has-text("Mes Tickets")')).toBeVisible();
    await expect(page.locator('button:has-text("Résultats")')).toBeVisible();
  });

  test('should display stats cards', async ({ page }) => {
    await expect(page.getByTestId('agent-dashboard')).toBeVisible({ timeout: 15000 });
    
    // Verify stats cards
    await expect(page.locator("text=Tickets Aujourd'hui")).toBeVisible();
    await expect(page.locator("text=Ventes Aujourd'hui")).toBeVisible();
    await expect(page.locator('text=Gains Payés')).toBeVisible();
    await expect(page.locator('text=Net')).toBeVisible();
  });

  test('should display recent tickets section', async ({ page }) => {
    await expect(page.getByTestId('agent-dashboard')).toBeVisible({ timeout: 15000 });
    
    // Verify recent tickets section
    await expect(page.locator('text=Derniers Tickets')).toBeVisible();
  });

  test('should display latest results section', async ({ page }) => {
    await expect(page.getByTestId('agent-dashboard')).toBeVisible({ timeout: 15000 });
    
    // Verify latest results section
    await expect(page.locator('text=Derniers Résultats')).toBeVisible();
  });
});

// ===========================================================================
// SUPER ADMIN LOGIN TEST
// ===========================================================================

test.describe('Super Admin Login', () => {
  test('should login as super admin', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN_EMAIL);
    await page.fill('input[type="password"]', SUPER_ADMIN_PASSWORD);
    await page.click('button:has-text("SIGN IN")');
    
    // Should redirect to super admin dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Verify dashboard loaded - use specific selector
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('text=Super Admin Overview')).toBeVisible();
  });
});
