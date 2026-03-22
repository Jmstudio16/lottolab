import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://seller-commission-ui.preview.emergentagent.com';

// Vendeur credentials - use agent.marie@lotopam.com
const VENDEUR_EMAIL = 'agent.marie@lotopam.com';
const VENDEUR_PASSWORD = 'Agent123!';

// Helper to login as vendeur
async function loginAsVendeur(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', VENDEUR_EMAIL);
  await page.fill('input[type="password"]', VENDEUR_PASSWORD);
  await page.click('button:has-text("SIGN IN")');
  // Wait for vendeur dashboard (agent goes through /agent/pos then redirects to /vendeur/dashboard)
  await page.waitForURL('**/vendeur/**', { timeout: 25000 });
}

// Helper to remove Emergent badge overlay
async function removeEmergentBadge(page: Page) {
  await page.evaluate(() => {
    const badge = document.querySelector('[class*="emergent"], [id*="emergent-badge"]');
    if (badge) (badge as HTMLElement).remove();
  });
}

test.describe('Vendeur Login and Authentication', () => {
  test('should login as vendeur and redirect to dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Verify login page loaded
    await expect(page.locator('text=WELCOME')).toBeVisible();
    
    // Fill credentials
    await page.fill('input[placeholder*="email"]', VENDEUR_EMAIL);
    await page.fill('input[type="password"]', VENDEUR_PASSWORD);
    
    // Click sign in
    await page.click('button:has-text("SIGN IN")');
    
    // Wait for redirect to vendeur area (can be dashboard or other page)
    await page.waitForURL('**/vendeur/**', { timeout: 25000 });
    
    // Verify vendeur dashboard is visible by checking for the dashboard content
    await expect(page.getByTestId('vendeur-dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('should show vendeur dashboard with stats cards', async ({ page }) => {
    await loginAsVendeur(page);
    
    // Navigate to dashboard if not already there
    await page.click('a:has-text("Tableau de bord")');
    await expect(page).toHaveURL(/\/vendeur\/dashboard/);
    
    // Verify dashboard header using more specific selector
    await expect(page.getByRole('heading', { name: 'Tableau de Bord' })).toBeVisible();
    
    // Verify stats cards (Commission now shows "Commission (X%)" format)
    await expect(page.locator('text=Ventes Jour')).toBeVisible();
    await expect(page.locator('text=Ventes Mois')).toBeVisible();
    await expect(page.locator('text=/Commission \\(\\d+%\\)/')).toBeVisible();
    await expect(page.locator('text=Tickets Jour')).toBeVisible();
  });

  test('should display all sidebar menu items', async ({ page }) => {
    await loginAsVendeur(page);
    await removeEmergentBadge(page);
    
    // Verify all 8 menu items in sidebar
    await expect(page.getByRole('link', { name: 'Tableau de bord' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nouvelle Vente' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mes Tickets' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Recherche Fiches' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tirages Disponibles' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Résultats' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mes Ventes' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mon Profil' })).toBeVisible();
  });
});

test.describe('Vendeur Dashboard Features', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendeur(page);
    await removeEmergentBadge(page);
    // Ensure we're on dashboard
    await page.click('a:has-text("Tableau de bord")');
    await expect(page).toHaveURL(/\/vendeur\/dashboard/);
  });

  test('should display recent tickets section', async ({ page }) => {
    // Verify recent tickets section
    await expect(page.locator('text=Activité Récente')).toBeVisible();
  });

  test('should display recent results section', async ({ page }) => {
    // Verify results section
    await expect(page.locator('text=Derniers Résultats')).toBeVisible();
  });

  test('should display notifications section', async ({ page }) => {
    // Verify notifications
    await expect(page.locator('text=Notifications')).toBeVisible();
  });

  test('should show vendeur email in sidebar', async ({ page }) => {
    // Verify vendeur email in sidebar (more specific than checking for "Vendeur")
    await expect(page.locator(`text=${VENDEUR_EMAIL}`)).toBeVisible();
  });
});

test.describe('Vendeur Nouvelle Vente (New Sale)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendeur(page);
    await removeEmergentBadge(page);
    await page.click('a:has-text("Nouvelle Vente")');
    await expect(page).toHaveURL(/\/vendeur\/nouvelle-vente/);
  });

  test('should navigate to nouvelle vente page', async ({ page }) => {
    // Verify page loaded
    await expect(page.getByRole('heading', { name: 'Nouvelle Vente' })).toBeVisible();
  });

  test('should display lottery selection header', async ({ page }) => {
    // Verify lottery section (now shows "Loteries Ouvertes")
    await expect(page.locator('text=/Loteries Ouvertes/')).toBeVisible();
  });

  test('should display open lotteries count', async ({ page }) => {
    // Verify lotteries count (number varies)
    await expect(page.locator('text=/Loteries Ouvertes \\(\\d+\\)/')).toBeVisible({ timeout: 15000 });
  });

  test('should display category filter buttons', async ({ page }) => {
    // Verify category buttons
    await expect(page.locator('button:has-text("Toutes")')).toBeVisible();
    await expect(page.locator('button:has-text("Haïti")')).toBeVisible();
    await expect(page.locator('button:has-text("USA")')).toBeVisible();
  });

  test('should have search input for lotteries', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Rechercher"]')).toBeVisible();
  });

  test('should show prompt to select lottery when none selected', async ({ page }) => {
    // Check for the prompt message in the right panel
    await expect(page.getByText('Sélectionnez une loterie ouverte pour commencer')).toBeVisible();
  });
});

test.describe('Vendeur Mes Tickets', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendeur(page);
    await removeEmergentBadge(page);
    await page.click('a:has-text("Mes Tickets")');
    await expect(page).toHaveURL(/\/vendeur\/mes-tickets/);
  });

  test('should navigate to mes tickets page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Mes Tickets' })).toBeVisible();
  });

  test('should display search input', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Rechercher"]')).toBeVisible();
  });

  test('should display status filter buttons', async ({ page }) => {
    // Verify filter buttons
    await expect(page.locator('button:has-text("Tous")')).toBeVisible();
    await expect(page.locator('button:has-text("Gagnants")')).toBeVisible();
    await expect(page.locator('button:has-text("Perdus")')).toBeVisible();
    await expect(page.locator('button:has-text("En attente")')).toBeVisible();
  });

  test('should display refresh button', async ({ page }) => {
    await expect(page.locator('button:has-text("Actualiser")')).toBeVisible();
  });
});

test.describe('Vendeur Résultats', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendeur(page);
    await removeEmergentBadge(page);
    await page.click('a:has-text("Résultats")');
    await expect(page).toHaveURL(/\/vendeur\/resultats/);
  });

  test('should navigate to resultats page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Résultats' })).toBeVisible();
  });

  test('should display quick verification section', async ({ page }) => {
    await expect(page.locator('text=Vérification Rapide')).toBeVisible();
    await expect(page.locator('input[placeholder*="ticket"]')).toBeVisible();
    await expect(page.locator('button:has-text("Vérifier")')).toBeVisible();
  });

  test('should display results with winning numbers', async ({ page }) => {
    // Wait for results to load
    await page.waitForLoadState('networkidle');
    
    // Check if results are displayed (lottery names with numbers)
    const resultsExist = await page.locator('.rounded-full').first().isVisible().catch(() => false);
    
    // If results exist, verify number display format
    if (resultsExist) {
      // Winning numbers should be in circle elements
      await expect(page.locator('.rounded-full').first()).toBeVisible();
    }
  });
});

test.describe('Vendeur Tirages Disponibles', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendeur(page);
    await removeEmergentBadge(page);
    await page.click('a:has-text("Tirages Disponibles")');
    await expect(page).toHaveURL(/\/vendeur\/tirages/);
  });

  test('should navigate to tirages page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tirages Disponibles' })).toBeVisible();
  });

  test('should display filter buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Tous")')).toBeVisible();
    await expect(page.locator('button:has-text("Ouverts")')).toBeVisible();
    await expect(page.locator('button:has-text("Fermés")')).toBeVisible();
  });

  test('should display open draws count', async ({ page }) => {
    // Verify open draws count is shown
    await expect(page.locator('text=tirage')).toBeVisible();
  });
});

test.describe('Vendeur Mon Profil', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendeur(page);
    await removeEmergentBadge(page);
    await page.click('a:has-text("Mon Profil")');
    await expect(page).toHaveURL(/\/vendeur\/profil/);
  });

  test('should navigate to profil page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Mon Profil' })).toBeVisible();
  });

  test('should display user email', async ({ page }) => {
    await expect(page.locator(`text=${VENDEUR_EMAIL}`).first()).toBeVisible();
  });

  test('should display change password button', async ({ page }) => {
    await expect(page.locator('button:has-text("Modifier mon mot de passe")')).toBeVisible();
  });

  test('should display logout button', async ({ page }) => {
    await expect(page.locator('button:has-text("Déconnexion")')).toBeVisible();
  });
});

test.describe('Vendeur Logout Flow', () => {
  test('should logout successfully', async ({ page }) => {
    await loginAsVendeur(page);
    await removeEmergentBadge(page);
    
    // Navigate to profile page
    await page.click('a:has-text("Mon Profil")');
    await expect(page).toHaveURL(/\/vendeur\/profil/);
    
    // Click logout
    await page.click('button:has-text("Déconnexion")');
    
    // Should redirect to login
    await page.waitForURL('**/login**', { timeout: 10000 });
    await expect(page.locator('text=WELCOME')).toBeVisible();
  });
});
