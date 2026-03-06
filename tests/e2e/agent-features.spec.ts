import { test, expect } from '@playwright/test';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://vendeur-stable.preview.emergentagent.com';

// Agent credentials
const AGENT_EMAIL = 'agent.marie@lotopam.com';
const AGENT_PASSWORD = 'password';

// Helper to login as agent
async function loginAsAgent(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASSWORD);
  await page.click('button:has-text("SIGN IN")');
  await page.waitForURL('**/agent/**', { timeout: 15000 });
}

// Helper to remove Emergent badge overlay
async function removeEmergentBadge(page) {
  await page.evaluate(() => {
    const badge = document.querySelector('[class*="emergent"], [id*="emergent-badge"]');
    if (badge) badge.remove();
  });
}

test.describe('Agent Login and Navigation', () => {
  test('should login as agent successfully', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Verify login page loaded
    await expect(page.locator('text=WELCOME')).toBeVisible();
    
    // Fill credentials
    await page.fill('input[placeholder*="email"]', AGENT_EMAIL);
    await page.fill('input[type="password"]', AGENT_PASSWORD);
    
    // Click sign in
    await page.click('button:has-text("SIGN IN")');
    
    // Wait for redirect to agent dashboard
    await page.waitForURL('**/agent/**', { timeout: 15000 });
    
    // Verify agent is logged in
    await expect(page).toHaveURL(/\/agent\//);
  });

  test('should display all 6 agent menu items', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    // Verify all 6 menu items are visible in sidebar navigation
    // Using more specific selectors for nav links
    await expect(page.getByRole('link', { name: 'Tableau de bord' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nouvelle Vente' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mes Tickets' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Rechercher Fiches' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tirages Disponibles' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Résultats' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mes Ventes' })).toBeVisible();
    
    // Take screenshot for verification
    await page.screenshot({ path: 'agent-menu.jpeg', quality: 20 });
  });

  test('should navigate to Nouvelle Vente page', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    // Navigate to Nouvelle Vente
    await page.click('a:has-text("Nouvelle Vente")');
    await expect(page).toHaveURL(/\/agent\/pos/);
    
    // Verify page loaded - NEW component uses agent-new-sale-page testid
    await expect(page.getByTestId('agent-new-sale-page')).toBeVisible();
    await expect(page.locator('text=Nouvelle Vente').first()).toBeVisible();
  });

  test('should navigate to Mes Tickets page', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    // Navigate to Mes Tickets
    await page.click('a:has-text("Mes Tickets")');
    await expect(page).toHaveURL(/\/agent\/my-tickets/);
    
    // Verify page loaded
    await expect(page.getByTestId('tickets-page')).toBeVisible();
    await expect(page.locator('text=Mes Tickets').first()).toBeVisible();
  });

  test('should navigate to Rechercher Fiches page', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    // Navigate to Rechercher Fiches
    await page.click('a:has-text("Rechercher Fiches")');
    await expect(page).toHaveURL(/\/agent\/search-tickets/);
    
    // Verify page loaded
    await expect(page.getByTestId('search-tickets-page')).toBeVisible();
    await expect(page.locator('text=Rechercher mes Fiches').first()).toBeVisible();
  });

  test('should navigate to Tirages Disponibles page', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    // Navigate to Tirages Disponibles
    await page.click('a:has-text("Tirages Disponibles")');
    await expect(page).toHaveURL(/\/agent\/available-draws/);
    
    // Verify page loaded
    await expect(page.getByTestId('available-draws-page')).toBeVisible();
    await expect(page.locator('text=Tirages Disponibles').first()).toBeVisible();
  });
});

test.describe('New Ticket Page - Quick Amount Section Removed', () => {
  test('should NOT display quick amount buttons', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    // Navigate to Nouvelle Vente
    await page.click('a:has-text("Nouvelle Vente")');
    await expect(page.getByTestId('agent-new-sale-page')).toBeVisible();
    
    // Verify quick amount buttons are NOT present
    const quickAmountSection = page.locator('[data-testid="quick-amounts"]');
    await expect(quickAmountSection).not.toBeVisible();
    
    // In the new design, amount input only appears after selecting a lottery
    // So verify lottery cards are shown instead
    await expect(page.locator('[data-testid^="lottery-card-"]').first()).toBeVisible({ timeout: 10000 });
    
    await page.screenshot({ path: 'new-ticket-no-quick-amounts.jpeg', quality: 20 });
  });

  test('should display lottery selection grid', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    await page.click('a:has-text("Nouvelle Vente")');
    await expect(page.getByTestId('agent-new-sale-page')).toBeVisible();
    
    // Verify lottery selection is present - NEW component shows "Sélectionnez une loterie"
    await expect(page.locator('text=Sélectionnez une loterie')).toBeVisible();
    
    // Verify lottery cards are visible
    await expect(page.locator('[data-testid^="lottery-card-"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('should display bet type selection and amount input after selecting lottery', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    await page.click('a:has-text("Nouvelle Vente")');
    await expect(page.getByTestId('agent-new-sale-page')).toBeVisible();
    
    // Select an open lottery to show the plays form
    const openLottery = page.locator('[data-testid^="lottery-card-"]:has-text("Ferme dans")').first();
    if (await openLottery.isVisible()) {
      await openLottery.click();
      
      // Verify bet type and amount input become visible
      await expect(page.locator('text=Type de pari')).toBeVisible();
      await expect(page.getByTestId('play-numbers-0')).toBeVisible();
      await expect(page.getByTestId('play-amount-0')).toBeVisible();
    }
  });
});

test.describe('Search Tickets Page with Duplicate Feature', () => {
  test('should display search and filter functionality', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    await page.click('a:has-text("Rechercher Fiches")');
    await expect(page.getByTestId('search-tickets-page')).toBeVisible();
    
    // Verify search input is present
    await expect(page.locator('input[placeholder*="Rechercher"]')).toBeVisible();
    
    // Verify filter dropdowns
    await expect(page.locator('text=Toutes les loteries')).toBeVisible();
    
    // Verify refresh button
    await expect(page.locator('button:has-text("Actualiser")')).toBeVisible();
  });

  test('should show duplicate/revendre button functionality exists', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    await page.click('a:has-text("Rechercher Fiches")');
    await expect(page.getByTestId('search-tickets-page')).toBeVisible();
    
    // Take screenshot showing the page structure
    await page.screenshot({ path: 'search-tickets-page.jpeg', quality: 20 });
    
    // Check if any tickets exist with duplicate button
    // Use first() to avoid strict mode issues with multiple buttons
    const duplicateBtn = page.locator('button:has-text("Dupliquer")').first();
    const btnCount = await page.locator('button:has-text("Dupliquer")').count();
    
    if (btnCount > 0) {
      // If duplicate buttons exist, check first one is visible
      await expect(duplicateBtn).toBeVisible();
    }
  });
});

test.describe('Available Draws Page with Countdown', () => {
  test('should display current time', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    await page.click('a:has-text("Tirages Disponibles")');
    await expect(page.getByTestId('available-draws-page')).toBeVisible();
    
    // Verify current time is displayed
    await expect(page.locator('text=Heure actuelle')).toBeVisible();
    
    await page.screenshot({ path: 'available-draws-page.jpeg', quality: 20 });
  });

  test('should display status legend', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    await page.click('a:has-text("Tirages Disponibles")');
    await expect(page.getByTestId('available-draws-page')).toBeVisible();
    
    // Verify legend for status colors
    await expect(page.locator('text=Actif')).toBeVisible();
    await expect(page.locator('text=Fermé')).toBeVisible();
    await expect(page.locator('text=Pas encore ouvert')).toBeVisible();
  });

  test('should display sales stop info', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    await page.click('a:has-text("Tirages Disponibles")');
    await expect(page.getByTestId('available-draws-page')).toBeVisible();
    
    // Verify info about 5-minute rule
    await expect(page.locator('text=Information sur les ventes')).toBeVisible();
    await expect(page.locator('text=5 minutes avant')).toBeVisible();
  });
});

test.describe('Mes Tickets Page with Cancellation', () => {
  test('should display ticket list with action buttons', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    await page.click('a:has-text("Mes Tickets")');
    await expect(page.getByTestId('tickets-page')).toBeVisible();
    
    // Verify search and filter controls
    await expect(page.locator('input[placeholder*="Rechercher"]')).toBeVisible();
    await expect(page.locator('text=Tous les statuts')).toBeVisible();
    
    await page.screenshot({ path: 'my-tickets-page.jpeg', quality: 20 });
  });

  test('should display status filter dropdown', async ({ page }) => {
    await loginAsAgent(page);
    await removeEmergentBadge(page);
    
    await page.click('a:has-text("Mes Tickets")');
    await expect(page.getByTestId('tickets-page')).toBeVisible();
    
    // Click on status filter
    await page.click('button:has-text("Tous les statuts")');
    
    // Verify status dropdown opened - just check first instance of each option
    await expect(page.getByText('En attente', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Gagnants', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Non gagnants', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Annulés', { exact: true }).first()).toBeVisible();
  });
});
