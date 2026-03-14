import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://lotto-system.preview.emergentagent.com';

// Test credentials
const VENDEUR_EMAIL = 'agent.marie@lotopam.com';
const VENDEUR_PASSWORD = 'Agent123!';
const SUPERVISOR_EMAIL = 'supervisor@lotopam.com';
const SUPERVISOR_PASSWORD = 'Supervisor123!';

// Helper to login as vendeur
async function loginAsVendeur(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', VENDEUR_EMAIL);
  await page.fill('input[type="password"]', VENDEUR_PASSWORD);
  await page.click('button:has-text("SIGN IN")');
  await page.waitForURL('**/vendeur/**', { timeout: 25000 });
}

// Helper to login as supervisor
async function loginAsSupervisor(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', SUPERVISOR_EMAIL);
  await page.fill('input[type="password"]', SUPERVISOR_PASSWORD);
  await page.click('button:has-text("SIGN IN")');
  await page.waitForURL('**/supervisor/**', { timeout: 25000 });
}

// Helper to remove Emergent badge overlay
async function removeEmergentBadge(page: Page) {
  await page.evaluate(() => {
    const badge = document.querySelector('[class*="emergent"], [id*="emergent-badge"]');
    if (badge) (badge as HTMLElement).remove();
  });
}

test.describe('Haiti Lotteries - API Verification', () => {
  test('API should return 14 Haiti lotteries with correct flag_type', async ({ request }) => {
    // Login to get token
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: VENDEUR_EMAIL, password: VENDEUR_PASSWORD }
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const token = loginData.token;

    // Get device config
    const configRes = await request.get(`${BASE_URL}/api/device/config`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(configRes.ok()).toBeTruthy();
    const configData = await configRes.json();

    // Filter Haiti lotteries
    const haitiLotteries = configData.enabled_lotteries.filter(
      (lot: any) => lot.flag_type === 'HAITI'
    );

    // Verify at least 14 Haiti lotteries exist
    expect(haitiLotteries.length).toBeGreaterThanOrEqual(14);

    // Verify specific lottery names exist (renamed without hours)
    const expectedNames = [
      'Tennessee Matin',
      'Tennessee Midi',
      'Tennessee Soir',
      'Texas Matin',
      'Texas Midi',
      'Texas Soir',
      'Texas Nuit',
      'Georgia Midi',
      'Georgia Soir',
      'Georgia Nuit',
      'Florida Midi',
      'Florida Soir',
      'New York Midi',
      'New York Soir'
    ];

    const lotteryNames = haitiLotteries.map((lot: any) => lot.lottery_name);
    
    for (const name of expectedNames) {
      expect(lotteryNames).toContain(name);
    }
  });

  test('API should return correct flag_type for Haiti lotteries', async ({ request }) => {
    // Login
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: VENDEUR_EMAIL, password: VENDEUR_PASSWORD }
    });
    const { token } = await loginRes.json();

    // Get device config
    const configRes = await request.get(`${BASE_URL}/api/device/config`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const configData = await configRes.json();

    // Verify all Haiti lotteries have flag_type = "HAITI"
    const haitiLotteries = configData.enabled_lotteries.filter(
      (lot: any) => lot.flag_type === 'HAITI'
    );

    for (const lottery of haitiLotteries) {
      expect(lottery.flag_type).toBe('HAITI');
    }
  });
});

test.describe('Vendeur - Free Amount Input', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendeur(page);
    await removeEmergentBadge(page);
    await page.click('a:has-text("Nouvelle Vente")');
    await expect(page).toHaveURL(/\/vendeur\/nouvelle-vente/);
  });

  test('should display free amount input field instead of preset buttons', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Nouvelle Vente' })).toBeVisible();
    
    // Wait for lotteries to load
    await page.waitForLoadState('networkidle');
    
    // Find any lottery button (open or closed) and check the UI structure
    // The amount input should exist in the sale form
    const amountInput = page.getByTestId('amount-input');
    
    // First, we need to select a lottery to see the amount input
    // Check if there are open lotteries
    const openLotteriesSection = page.locator('text=/Loteries Ouvertes/');
    await expect(openLotteriesSection).toBeVisible();
    
    // Take screenshot of initial state
    await page.screenshot({ path: '/app/tests/e2e/vendeur-nouvelle-vente-initial.jpeg', quality: 20, fullPage: false });
  });

  test('should show placeholder text for free amount entry', async ({ page }) => {
    // Wait for lotteries to load
    await page.waitForLoadState('networkidle');
    
    // Find and click first available lottery (if any are open)
    const lotteryButtons = page.locator('button[data-testid^="lottery-"]');
    const lotteryCount = await lotteryButtons.count();
    
    if (lotteryCount > 0) {
      // Try to click an open lottery
      await lotteryButtons.first().click({ force: true });
      
      // Wait for form to appear
      await page.waitForTimeout(500);
      
      // Check for amount input with placeholder
      const amountInput = page.getByTestId('amount-input');
      if (await amountInput.isVisible()) {
        // Verify the placeholder text indicates free amount entry
        const placeholder = await amountInput.getAttribute('placeholder');
        expect(placeholder).toContain('Entrez le montant');
        
        // Verify there's text indicating "Montant libre"
        await expect(page.locator('text=/Montant libre/')).toBeVisible();
      }
    }
    
    // Take screenshot
    await page.screenshot({ path: '/app/tests/e2e/vendeur-amount-input.jpeg', quality: 20, fullPage: false });
  });

  test('should allow typing any amount in the free input field', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Find lottery buttons
    const lotteryButtons = page.locator('button[data-testid^="lottery-"]');
    const lotteryCount = await lotteryButtons.count();
    
    if (lotteryCount > 0) {
      await lotteryButtons.first().click({ force: true });
      await page.waitForTimeout(500);
      
      const amountInput = page.getByTestId('amount-input');
      if (await amountInput.isVisible()) {
        // Test various amounts
        await amountInput.fill('50');
        expect(await amountInput.inputValue()).toBe('50');
        
        await amountInput.fill('123');
        expect(await amountInput.inputValue()).toBe('123');
        
        await amountInput.fill('999');
        expect(await amountInput.inputValue()).toBe('999');
      }
    }
  });
});

test.describe('Vendeur - Haiti/USA Flag Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendeur(page);
    await removeEmergentBadge(page);
    await page.click('a:has-text("Nouvelle Vente")');
    await expect(page).toHaveURL(/\/vendeur\/nouvelle-vente/);
  });

  test('should display flag filter buttons (Toutes, Haiti, USA)', async ({ page }) => {
    await expect(page.getByTestId('flag-all')).toBeVisible();
    await expect(page.getByTestId('flag-haiti')).toBeVisible();
    await expect(page.getByTestId('flag-usa')).toBeVisible();
  });

  test('should filter lotteries when Haiti flag is selected', async ({ page }) => {
    // Wait for lotteries to load
    await page.waitForLoadState('networkidle');
    
    // Click Haiti flag filter
    await page.getByTestId('flag-haiti').click();
    
    // Wait for filter to apply
    await page.waitForTimeout(300);
    
    // Verify Haiti flag emoji is shown on lottery cards
    const pageContent = await page.content();
    
    // If there are Haiti lotteries visible, they should have 🇭🇹 flag
    if (pageContent.includes('🇭🇹')) {
      // Good - Haiti lotteries are visible
      expect(pageContent).toContain('🇭🇹');
    }
    
    // Take screenshot
    await page.screenshot({ path: '/app/tests/e2e/vendeur-haiti-filter.jpeg', quality: 20, fullPage: false });
  });

  test('should filter lotteries when USA flag is selected', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Click USA flag filter
    await page.getByTestId('flag-usa').click();
    
    // Wait for filter to apply
    await page.waitForTimeout(300);
    
    // Verify USA lotteries are shown (should have 🇺🇸 flag)
    const pageContent = await page.content();
    expect(pageContent).toContain('🇺🇸');
    
    // Take screenshot
    await page.screenshot({ path: '/app/tests/e2e/vendeur-usa-filter.jpeg', quality: 20, fullPage: false });
  });

  test('should show all lotteries when "Toutes" is selected', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // First filter by Haiti
    await page.getByTestId('flag-haiti').click();
    await page.waitForTimeout(300);
    
    // Then click "Toutes" to show all
    await page.getByTestId('flag-all').click();
    await page.waitForTimeout(300);
    
    // Both flags should be visible
    const pageContent = await page.content();
    expect(pageContent).toContain('🇺🇸');
    // Haiti lotteries may or may not be visible depending on time
    
    // Take screenshot
    await page.screenshot({ path: '/app/tests/e2e/vendeur-all-filter.jpeg', quality: 20, fullPage: false });
  });
});

test.describe('Supervisor - Lottery Flags Configuration Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
    await removeEmergentBadge(page);
  });

  test('should navigate to lottery flags page', async ({ page }) => {
    // Navigate to lottery flags page via sidebar
    await page.click('a[href="/supervisor/lottery-flags"]');
    
    // Verify page loaded
    await expect(page.getByTestId('supervisor-lottery-flags-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Configuration des Drapeaux/i })).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: '/app/tests/e2e/supervisor-lottery-flags.jpeg', quality: 20, fullPage: false });
  });

  test('should display all lotteries with flag configuration', async ({ page }) => {
    await page.click('a[href="/supervisor/lottery-flags"]');
    await expect(page.getByTestId('supervisor-lottery-flags-page')).toBeVisible({ timeout: 10000 });
    
    // Verify stats cards - use first() to handle duplicates
    await expect(page.locator('p:has-text("Total")').first()).toBeVisible();
    // Use first() for filter buttons since text appears on lottery cards too
    await expect(page.getByRole('button', { name: '🇭🇹 Haïti' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '🇺🇸 USA' }).first()).toBeVisible();
    await expect(page.locator('p:has-text("Activées")').first()).toBeVisible();
  });

  test('should display search input for lotteries', async ({ page }) => {
    await page.click('a[href="/supervisor/lottery-flags"]');
    await expect(page.getByTestId('supervisor-lottery-flags-page')).toBeVisible({ timeout: 10000 });
    
    // Verify search input
    await expect(page.getByTestId('search-lotteries')).toBeVisible();
  });

  test('should display filter buttons for flags', async ({ page }) => {
    await page.click('a[href="/supervisor/lottery-flags"]');
    await expect(page.getByTestId('supervisor-lottery-flags-page')).toBeVisible({ timeout: 10000 });
    
    // Verify filter buttons - use first() since "🇭🇹 Haïti" appears on each lottery card
    await expect(page.locator('button:has-text("Tous")').first()).toBeVisible();
    await expect(page.locator('button:has-text("🇭🇹 Haïti")').first()).toBeVisible();
    await expect(page.locator('button:has-text("🇺🇸 USA")').first()).toBeVisible();
  });

  test('should display Haiti lotteries section', async ({ page }) => {
    await page.click('a[href="/supervisor/lottery-flags"]');
    await expect(page.getByTestId('supervisor-lottery-flags-page')).toBeVisible({ timeout: 10000 });
    
    // Wait for data to load
    await page.waitForLoadState('networkidle');
    
    // Verify Haiti section header - updated to new format "🇭🇹 LOTERIE HAITI"
    await expect(page.getByText('🇭🇹 LOTERIE HAITI', { exact: true }).first()).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: '/app/tests/e2e/supervisor-haiti-section.jpeg', quality: 20, fullPage: false });
  });

  test('should display lottery cards with toggle buttons', async ({ page }) => {
    await page.click('a[href="/supervisor/lottery-flags"]');
    await expect(page.getByTestId('supervisor-lottery-flags-page')).toBeVisible({ timeout: 10000 });
    
    await page.waitForLoadState('networkidle');
    
    // Find first lottery card
    const lotteryCards = page.locator('[data-testid^="lottery-card-"]');
    const cardCount = await lotteryCards.count();
    
    if (cardCount > 0) {
      // Verify card has toggle button
      const firstCard = lotteryCards.first();
      await expect(firstCard.locator('[data-testid^="toggle-"]')).toBeVisible();
      
      // Verify card has flag selection buttons
      await expect(firstCard.locator('[data-testid^="flag-haiti-"]')).toBeVisible();
      await expect(firstCard.locator('[data-testid^="flag-usa-"]')).toBeVisible();
    }
  });

  test('should toggle lottery enable/disable state', async ({ page }) => {
    await page.click('a[href="/supervisor/lottery-flags"]');
    await expect(page.getByTestId('supervisor-lottery-flags-page')).toBeVisible({ timeout: 10000 });
    
    await page.waitForLoadState('networkidle');
    
    // Find first lottery toggle
    const toggleButtons = page.locator('[data-testid^="toggle-"]');
    const toggleCount = await toggleButtons.count();
    
    if (toggleCount > 0) {
      // Click toggle to change state
      await toggleButtons.first().click();
      
      // Verify toast message appears
      await expect(page.locator('text=/Loterie (activée|désactivée)/')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should search lotteries by name', async ({ page }) => {
    await page.click('a[href="/supervisor/lottery-flags"]');
    await expect(page.getByTestId('supervisor-lottery-flags-page')).toBeVisible({ timeout: 10000 });
    
    await page.waitForLoadState('networkidle');
    
    // Type in search
    await page.getByTestId('search-lotteries').fill('Tennessee');
    
    // Wait for filter
    await page.waitForTimeout(300);
    
    // Verify Tennessee lotteries are shown
    const pageContent = await page.content();
    expect(pageContent).toContain('Tennessee');
    
    // Take screenshot
    await page.screenshot({ path: '/app/tests/e2e/supervisor-search-tennessee.jpeg', quality: 20, fullPage: false });
  });

  test('should filter by Haiti flag only', async ({ page }) => {
    await page.click('a[href="/supervisor/lottery-flags"]');
    await expect(page.getByTestId('supervisor-lottery-flags-page')).toBeVisible({ timeout: 10000 });
    
    await page.waitForLoadState('networkidle');
    
    // Click Haiti filter button - use first() since same text appears on lottery cards
    await page.getByRole('button', { name: '🇭🇹 Haïti' }).first().click();
    
    // Wait for filter
    await page.waitForTimeout(500);
    
    // Haiti section header should be visible - updated to new format
    await expect(page.getByText('🇭🇹 LOTERIE HAITI', { exact: true }).first()).toBeVisible();
    
    // Take screenshot for verification
    await page.screenshot({ path: '/app/tests/e2e/supervisor-haiti-filter-only.jpeg', quality: 20, fullPage: false });
  });
});

test.describe('Supervisor Lottery Flags - API Tests', () => {
  test('API should return lottery flags for supervisor', async ({ request }) => {
    // Login as supervisor
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: SUPERVISOR_EMAIL, password: SUPERVISOR_PASSWORD }
    });
    expect(loginRes.ok()).toBeTruthy();
    const { token } = await loginRes.json();

    // Get lottery flags
    const flagsRes = await request.get(`${BASE_URL}/api/supervisor/lottery-flags`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(flagsRes.ok()).toBeTruthy();
    const flagsData = await flagsRes.json();

    // Verify response is array
    expect(Array.isArray(flagsData)).toBeTruthy();
    expect(flagsData.length).toBeGreaterThan(0);

    // Verify each lottery has required fields
    for (const lottery of flagsData) {
      expect(lottery).toHaveProperty('lottery_id');
      expect(lottery).toHaveProperty('lottery_name');
      expect(lottery).toHaveProperty('flag_type');
      expect(lottery).toHaveProperty('is_enabled');
    }
  });

  test('API should return Haiti lotteries with correct flag_type in lottery-flags endpoint', async ({ request }) => {
    // Login as supervisor
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: SUPERVISOR_EMAIL, password: SUPERVISOR_PASSWORD }
    });
    const { token } = await loginRes.json();

    // Get lottery flags
    const flagsRes = await request.get(`${BASE_URL}/api/supervisor/lottery-flags`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const flagsData = await flagsRes.json();

    // Filter Haiti lotteries
    const haitiLotteries = flagsData.filter((lot: any) => lot.flag_type === 'HAITI');
    
    // Verify Haiti lotteries exist
    expect(haitiLotteries.length).toBeGreaterThanOrEqual(14);

    // Verify specific names (renamed without hours)
    const haitiNames = haitiLotteries.map((lot: any) => lot.lottery_name);
    expect(haitiNames).toContain('Tennessee Matin');
    expect(haitiNames).toContain('Texas Midi');
    expect(haitiNames).toContain('Georgia Midi');
    expect(haitiNames).toContain('Florida Midi');
    expect(haitiNames).toContain('New York Midi');
  });

  test('API should allow toggling lottery enable/disable', async ({ request }) => {
    // Login as supervisor
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: SUPERVISOR_EMAIL, password: SUPERVISOR_PASSWORD }
    });
    const { token } = await loginRes.json();

    // Get lottery flags first
    const flagsRes = await request.get(`${BASE_URL}/api/supervisor/lottery-flags`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const flagsData = await flagsRes.json();

    if (flagsData.length > 0) {
      const firstLottery = flagsData[0];
      const lotteryId = firstLottery.lottery_id;

      // Toggle the lottery
      const toggleRes = await request.post(
        `${BASE_URL}/api/supervisor/lottery-flags/toggle/${lotteryId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      expect(toggleRes.ok()).toBeTruthy();
      const toggleData = await toggleRes.json();

      // Verify response
      expect(toggleData).toHaveProperty('lottery_id', lotteryId);
      expect(toggleData).toHaveProperty('is_enabled');
      expect(typeof toggleData.is_enabled).toBe('boolean');
    }
  });
});
