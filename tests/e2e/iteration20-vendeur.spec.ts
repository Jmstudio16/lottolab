import { test, expect } from '@playwright/test';

const VENDEUR_EMAIL = 'agent.marie@lotopam.com';
const VENDEUR_PASSWORD = 'Agent123!';
const EXPECTED_COMPANY = 'LotoPam Center';

test.describe('Iteration 20 - Vendeur Pages', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login as Vendeur
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', VENDEUR_EMAIL);
    await page.fill('input[type="password"]', VENDEUR_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to agent/vendeur area
    await page.waitForURL(/\/(agent|vendeur)/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');
  });

  test('Mes Tickets page loads without error', async ({ page }) => {
    await page.goto('/vendeur/mes-tickets', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    
    // Check page title
    await expect(page.getByRole('heading', { name: 'Mes Tickets' })).toBeVisible();
    
    // Check ticket count text is visible
    await expect(page.getByText(/ticket\(s\) au total/)).toBeVisible();
    
    // Check filter buttons are present
    await expect(page.getByRole('button', { name: 'Tous' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gagnants' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'En attente' })).toBeVisible();
    
    // Check search input exists
    await expect(page.getByPlaceholder(/Rechercher par numéro/i)).toBeVisible();
  });

  test('Mes Tickets page displays tickets list', async ({ page }) => {
    await page.goto('/vendeur/mes-tickets', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for tickets to load (check for either tickets or "Aucun ticket" message)
    const hasTickets = await page.locator('.font-mono.font-semibold').first().isVisible().catch(() => false);
    const noTickets = await page.getByText('Aucun ticket trouvé').isVisible().catch(() => false);
    
    expect(hasTickets || noTickets).toBeTruthy();
  });

  test('Mes Ventes page loads without error', async ({ page }) => {
    await page.goto('/vendeur/mes-ventes', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    
    // Check page title
    await expect(page.getByRole('heading', { name: 'Mes Ventes' })).toBeVisible();
    
    // Check subtitle
    await expect(page.getByText('Analyse de vos performances')).toBeVisible();
    
    // Check period filter buttons
    await expect(page.getByRole('button', { name: "Aujourd'hui" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cette semaine' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ce mois' })).toBeVisible();
  });

  test('Mes Ventes page displays statistics cards', async ({ page }) => {
    await page.goto('/vendeur/mes-ventes', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for data to load
    await page.waitForTimeout(2000);
    
    // Check stats cards are present
    await expect(page.getByText('Total Ventes')).toBeVisible();
    await expect(page.getByText('Tickets Vendus')).toBeVisible();
    await expect(page.getByText('Moyenne/Ticket')).toBeVisible();
    await expect(page.getByText(/Commission/)).toBeVisible();
    
    // Check charts are present
    await expect(page.getByText('Ventes par Jour')).toBeVisible();
    await expect(page.getByText('Ventes par Loterie')).toBeVisible();
  });

  test('Profil page loads without error', async ({ page }) => {
    await page.goto('/vendeur/profil', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    
    // Check page title
    await expect(page.getByRole('heading', { name: 'Mon Profil' })).toBeVisible();
    
    // Check subtitle
    await expect(page.getByText('Informations de votre compte vendeur')).toBeVisible();
  });

  test('Profil page displays company info', async ({ page }) => {
    await page.goto('/vendeur/profil', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for profile to load
    await page.waitForTimeout(2000);
    
    // Check company section
    await expect(page.getByText('Compagnie')).toBeVisible();
    await expect(page.getByText(EXPECTED_COMPANY)).toBeVisible();
  });

  test('Profil page displays succursale info', async ({ page }) => {
    await page.goto('/vendeur/profil', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check succursale section
    await expect(page.getByText('Succursale')).toBeVisible();
    // Succursale name should be visible
    await expect(page.getByText('Point de Vente Delmas')).toBeVisible();
  });

  test('Profil page displays supervisor info', async ({ page }) => {
    await page.goto('/vendeur/profil', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check supervisor section
    await expect(page.getByText('Superviseur')).toBeVisible();
    await expect(page.getByText('Jean Pierre')).toBeVisible();
  });

  test('Profil page displays vendor ID', async ({ page }) => {
    await page.goto('/vendeur/profil', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check ID Vendeur section
    await expect(page.getByText('ID Vendeur')).toBeVisible();
    // The user ID should be visible (starts with user_)
    await expect(page.locator('text=/user_[a-z0-9]+/i')).toBeVisible();
  });

  test('Profil page displays device info', async ({ page }) => {
    await page.goto('/vendeur/profil', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check device section - can show device ID or "NON ASSIGNÉ"
    await expect(page.getByText('ID Appareil')).toBeVisible();
    const hasDevice = await page.getByText('NON ASSIGNÉ').isVisible().catch(() => false);
    const hasDeviceId = await page.locator('text=/dev_[a-z0-9]+/i').isVisible().catch(() => false);
    expect(hasDevice || hasDeviceId).toBeTruthy();
  });

  test('Profil page displays commission rate', async ({ page }) => {
    await page.goto('/vendeur/profil', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check commission badge and section
    await expect(page.getByText('Commission:')).toBeVisible();
    await expect(page.getByText('Votre taux de commission')).toBeVisible();
    // Commission rate should be displayed (e.g., "10%")
    await expect(page.locator('text=/\\d+%/')).toBeVisible();
  });

  test('VendeurLayout shows company name in header', async ({ page }) => {
    await page.goto('/vendeur/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check company name is displayed in sidebar header
    await expect(page.getByText(EXPECTED_COMPANY).first()).toBeVisible();
    
    // Check "Espace Vendeur" text
    await expect(page.getByText('Espace Vendeur')).toBeVisible();
  });

  test('Profil page has photo upload area', async ({ page }) => {
    await page.goto('/vendeur/profil', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check profile photo area exists (circular avatar)
    const avatarArea = page.locator('.rounded-full.bg-gradient-to-br');
    await expect(avatarArea.first()).toBeVisible();
  });

  test('Navigation between vendeur pages works', async ({ page }) => {
    await page.goto('/vendeur/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to Mes Tickets
    await page.click('text=Mes Tickets');
    await expect(page).toHaveURL(/\/vendeur\/mes-tickets/);
    await expect(page.getByRole('heading', { name: 'Mes Tickets' })).toBeVisible();
    
    // Navigate to Mes Ventes
    await page.click('text=Mes Ventes');
    await expect(page).toHaveURL(/\/vendeur\/mes-ventes/);
    await expect(page.getByRole('heading', { name: 'Mes Ventes' })).toBeVisible();
    
    // Navigate to Profil
    await page.click('text=Mon Profil');
    await expect(page).toHaveURL(/\/vendeur\/profil/);
    await expect(page.getByRole('heading', { name: 'Mon Profil' })).toBeVisible();
  });

  test('French is used by default in UI', async ({ page }) => {
    await page.goto('/vendeur/profil', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check French labels are used
    await expect(page.getByText('Compagnie')).toBeVisible();
    await expect(page.getByText('Succursale')).toBeVisible();
    await expect(page.getByText('Superviseur')).toBeVisible();
    await expect(page.getByText('Téléphone')).toBeVisible();
    await expect(page.getByText('Déconnexion')).toBeVisible();
  });
});
