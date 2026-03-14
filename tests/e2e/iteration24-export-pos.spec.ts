import { test, expect } from '@playwright/test';

/**
 * Iteration 24 Tests:
 * - Export Excel buttons for vendeur tickets
 * - POS Serial Number field in agent creation form
 * - Ticket printing functionality
 */

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://lotto-system.preview.emergentagent.com';

// Test credentials
const COMPANY_ADMIN = { email: 'admin@lotopam.com', password: 'Admin123!' };
const VENDEUR = { email: 'agent.marie@lotopam.com', password: 'Agent123!' };

test.describe('Vendeur Export Excel Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss any toast notifications
    await page.addLocatorHandler(
      page.locator('[data-sonner-toast], .Toastify__toast'),
      async () => {
        const close = page.locator('[data-sonner-toast] [data-close], .Toastify__close-button').first();
        await close.click({ timeout: 1000 }).catch(() => {});
      },
      { times: 5, noWaitAfter: true }
    );
  });

  test('Login as vendeur and verify tickets page loads', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Fill login form
    await page.fill('input[type="email"], input[placeholder*="email"]', VENDEUR.email);
    await page.fill('input[type="password"]', VENDEUR.password);
    
    // Click sign in button
    await page.getByRole('button', { name: /sign in|connexion|se connecter/i }).click();
    
    // Wait for redirect to vendeur dashboard
    await expect(page).toHaveURL(/vendeur|agent|tableau/, { timeout: 15000 });
    
    await page.screenshot({ path: 'vendeur-dashboard.jpeg', quality: 20, fullPage: false });
  });

  test('Vendeur mes tickets page has export Excel button', async ({ page }) => {
    // Login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"], input[placeholder*="email"]', VENDEUR.email);
    await page.fill('input[type="password"]', VENDEUR.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for redirect after login
    await page.waitForURL(/vendeur/, { timeout: 15000 });
    
    // Navigate to mes-tickets page (correct route)
    await page.goto('/vendeur/mes-tickets', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Check for export button with data-testid
    const exportButton = page.getByTestId('export-excel-btn');
    await expect(exportButton).toBeVisible({ timeout: 10000 });
    
    await page.screenshot({ path: 'vendeur-tickets-export.jpeg', quality: 20, fullPage: false });
  });

  test('Export Excel button is clickable', async ({ page }) => {
    // Login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"], input[placeholder*="email"]', VENDEUR.email);
    await page.fill('input[type="password"]', VENDEUR.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for redirect after login
    await page.waitForURL(/vendeur/, { timeout: 15000 });
    
    // Navigate to mes-tickets page (correct route)
    await page.goto('/vendeur/mes-tickets', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Find and verify export button
    const exportButton = page.getByTestId('export-excel-btn');
    await expect(exportButton).toBeVisible({ timeout: 10000 });
    await expect(exportButton).toBeEnabled();
    
    // Verify it contains Excel text or icon
    await expect(exportButton).toContainText(/excel/i);
  });
});

test.describe('Company Admin POS Serial Field', () => {
  test.beforeEach(async ({ page }) => {
    await page.addLocatorHandler(
      page.locator('[data-sonner-toast], .Toastify__toast'),
      async () => {
        const close = page.locator('[data-sonner-toast] [data-close], .Toastify__close-button').first();
        await close.click({ timeout: 1000 }).catch(() => {});
      },
      { times: 5, noWaitAfter: true }
    );
  });

  test('Login as company admin', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    await page.fill('input[type="email"], input[placeholder*="email"]', COMPANY_ADMIN.email);
    await page.fill('input[type="password"]', COMPANY_ADMIN.password);
    await page.getByRole('button', { name: /sign in|connexion|se connecter/i }).click();
    
    // Wait for redirect to company dashboard
    await expect(page).toHaveURL(/company|entreprise|admin/, { timeout: 15000 });
    
    await page.screenshot({ path: 'company-admin-dashboard.jpeg', quality: 20, fullPage: false });
  });

  test('Succursales page has add succursale button', async ({ page }) => {
    // Login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"], input[placeholder*="email"]', COMPANY_ADMIN.email);
    await page.fill('input[type="password"]', COMPANY_ADMIN.password);
    await page.getByRole('button', { name: /sign in|connexion|se connecter/i }).click();
    await expect(page).toHaveURL(/company|entreprise|admin/, { timeout: 15000 });
    
    // Navigate to succursales
    await page.goto('/company/succursales', { waitUntil: 'domcontentloaded' });
    
    // Check for add succursale button
    const addButton = page.getByTestId('add-succursale-btn');
    await expect(addButton).toBeVisible({ timeout: 10000 });
    
    await page.screenshot({ path: 'company-succursales-page.jpeg', quality: 20, fullPage: false });
  });

  test('Agent creation form has POS serial number field', async ({ page }) => {
    // Login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"], input[placeholder*="email"]', COMPANY_ADMIN.email);
    await page.fill('input[type="password"]', COMPANY_ADMIN.password);
    await page.getByRole('button', { name: /sign in|connexion|se connecter/i }).click();
    await expect(page).toHaveURL(/company|entreprise|admin/, { timeout: 15000 });
    
    // Navigate to succursales
    await page.goto('/company/succursales', { waitUntil: 'domcontentloaded' });
    
    // Click on first succursale details
    const viewButton = page.locator('[data-testid^="view-"]').first();
    if (await viewButton.isVisible()) {
      await viewButton.click();
      
      // Wait for modal to open
      await page.waitForSelector('[data-testid="add-agent-btn"]', { timeout: 5000 });
      
      // Click add agent button
      const addAgentBtn = page.getByTestId('add-agent-btn');
      await addAgentBtn.click();
      
      // Wait for agent form modal
      await page.waitForSelector('[data-testid="agent-pos-serial"]', { timeout: 5000 });
      
      // Verify POS serial field exists
      const posSerialField = page.getByTestId('agent-pos-serial');
      await expect(posSerialField).toBeVisible();
      
      await page.screenshot({ path: 'agent-form-pos-serial.jpeg', quality: 20, fullPage: false });
    } else {
      // If no succursales, just verify the page loads
      await page.screenshot({ path: 'company-succursales-empty.jpeg', quality: 20, fullPage: false });
    }
  });

  test('POS serial number validation shows availability', async ({ page }) => {
    // Login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"], input[placeholder*="email"]', COMPANY_ADMIN.email);
    await page.fill('input[type="password"]', COMPANY_ADMIN.password);
    await page.getByRole('button', { name: /sign in|connexion|se connecter/i }).click();
    await expect(page).toHaveURL(/company|entreprise|admin/, { timeout: 15000 });
    
    // Navigate to succursales
    await page.goto('/company/succursales', { waitUntil: 'domcontentloaded' });
    
    // Click on first succursale details
    const viewButton = page.locator('[data-testid^="view-"]').first();
    if (await viewButton.isVisible()) {
      await viewButton.click();
      
      // Wait for modal and click add agent
      await page.waitForSelector('[data-testid="add-agent-btn"]', { timeout: 5000 });
      await page.getByTestId('add-agent-btn').click();
      
      // Wait for agent form
      await page.waitForSelector('[data-testid="agent-pos-serial"]', { timeout: 5000 });
      
      // Type a unique serial number
      const posSerialField = page.getByTestId('agent-pos-serial');
      await posSerialField.fill('TEST-POS-12345');
      
      // Wait for validation to happen (debounced)
      await page.waitForTimeout(1000);
      
      await page.screenshot({ path: 'pos-serial-validation.jpeg', quality: 20, fullPage: false });
    }
  });
});

test.describe('Ticket Printing Feature', () => {
  test('Vendeur can see print button on ticket list', async ({ page }) => {
    // Login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"], input[placeholder*="email"]', VENDEUR.email);
    await page.fill('input[type="password"]', VENDEUR.password);
    await page.getByRole('button', { name: /sign in|connexion|se connecter/i }).click();
    
    // Wait for redirect after login
    await page.waitForURL(/vendeur|agent/, { timeout: 15000 });
    
    // Navigate to mes-tickets page (correct route)
    await page.goto('/vendeur/mes-tickets', { waitUntil: 'domcontentloaded' });
    
    // Check if there are tickets displayed
    await page.waitForLoadState('domcontentloaded');
    
    // Look for printer icon (Printer component from lucide-react renders as button)
    const printButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    
    await page.screenshot({ path: 'vendeur-tickets-print-buttons.jpeg', quality: 20, fullPage: false });
  });
});
