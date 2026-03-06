import { test, expect } from '@playwright/test';

const BASE_URL = 'https://vendeur-dashboard.preview.emergentagent.com';

// Credentials
const SUPER_ADMIN = { email: 'jefferson@jmstudio.com', password: 'JMStudio@2026!' };
const COMPANY_ADMIN = { email: 'admin@lotopam.com', password: 'Admin123!' };

test.describe('Company Admin Succursales Page', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login as Company Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', COMPANY_ADMIN.email);
    await page.fill('input[type="password"]', COMPANY_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });
  
  test('Navigate to Succursales page', async ({ page }) => {
    // Navigate to succursales page
    await page.click('a[href="/company/succursales"]');
    await expect(page).toHaveURL(/.*succursales/);
    
    // Verify page title
    await expect(page.locator('h1:has-text("Succursales")')).toBeVisible();
    
    await page.screenshot({ path: 'succursales-page.jpeg', quality: 20

 });
  });
  
  test('Succursales list displays correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/company/succursales`, { waitUntil: 'domcontentloaded' });
    
    // Wait for the page to load
    await expect(page.locator('h1:has-text("Succursales")')).toBeVisible();
    
    // Check for the add button
    await expect(page.getByTestId('add-succursale-btn')).toBeVisible();
    
    await page.screenshot({ path: 'succursales-list.jpeg', quality: 20 });
  });
  
  test('Edit succursale modal opens', async ({ page }) => {
    await page.goto(`${BASE_URL}/company/succursales`, { waitUntil: 'domcontentloaded' });
    
    // Wait for succursales to load
    await page.waitForLoadState('networkidle');
    
    // Find and click an edit button (first one)
    const editButton = page.locator('[data-testid^="edit-succursale-"]').first();
    
    if (await editButton.isVisible()) {
      await editButton.click();
      
      // Verify edit modal opens
      await expect(page.getByRole('dialog')).toBeVisible();
      
      await page.screenshot({ path: 'edit-succursale-modal.jpeg', quality: 20 });
      
      // Close the modal
      await page.keyboard.press('Escape');
    } else {
      test.skip('No succursales to edit');
    }
  });
  
  test('Suspend succursale button is clickable', async ({ page }) => {
    await page.goto(`${BASE_URL}/company/succursales`, { waitUntil: 'domcontentloaded' });
    
    // Wait for succursales to load
    await page.waitForLoadState('networkidle');
    
    // Find a suspend button
    const suspendButton = page.locator('[data-testid^="suspend-succursale-"]').first();
    
    if (await suspendButton.isVisible()) {
      // Check button is clickable (don't actually click to avoid changing state)
      await expect(suspendButton).toBeEnabled();
      
      await page.screenshot({ path: 'succursale-suspend-button.jpeg', quality: 20 });
    } else {
      // Try to find activate button instead (succursale might already be suspended)
      const activateButton = page.locator('[data-testid^="activate-succursale-"]').first();
      if (await activateButton.isVisible()) {
        await expect(activateButton).toBeEnabled();
        await page.screenshot({ path: 'succursale-activate-button.jpeg', quality: 20 });
      } else {
        test.skip('No succursales with suspend/activate buttons');
      }
    }
  });

});

test.describe('Super Admin Global Schedules Page', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login as Super Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', SUPER_ADMIN.email);
    await page.fill('input[type="password"]', SUPER_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });
  
  test('Navigate to Global Schedules page', async ({ page }) => {
    // Navigate to global schedules
    await page.click('a[href="/super/global-schedules"]');
    await expect(page).toHaveURL(/.*global-schedules/);
    
    // Check page title
    await expect(page.locator('h1:has-text("Global Schedules")')).toBeVisible();
    
    await page.screenshot({ path: 'global-schedules-page.jpeg', quality: 20 });
  });
  
  test('Global Schedules page loads without error', async ({ page }) => {
    await page.goto(`${BASE_URL}/super/global-schedules`, { waitUntil: 'domcontentloaded' });
    
    // Wait for loading to complete (check for absence of spinner or presence of table)
    await page.waitForLoadState('networkidle');
    
    // Verify the page has loaded
    await expect(page.locator('h1:has-text("Global Schedules")')).toBeVisible();
    
    // Check for the add schedule button
    await expect(page.getByTestId('add-schedule-btn')).toBeVisible();
    
    // Check for the schedules table
    await expect(page.getByTestId('schedules-table')).toBeVisible();
    
    await page.screenshot({ path: 'global-schedules-loaded.jpeg', quality: 20 });
  });
  
  test('Filter dropdown exists on Global Schedules page', async ({ page }) => {
    await page.goto(`${BASE_URL}/super/global-schedules`, { waitUntil: 'domcontentloaded' });
    
    // Check for filter dropdown
    await expect(page.getByTestId('filter-lottery')).toBeVisible();
    
    await page.screenshot({ path: 'global-schedules-filter.jpeg', quality: 20 });
  });

});

test.describe('Company Admin Tickets Page', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login as Company Admin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[placeholder*="email"]', COMPANY_ADMIN.email);
    await page.fill('input[type="password"]', COMPANY_ADMIN.password);
    await page.click('button:has-text("SIGN IN")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });
  
  test('Navigate to Tickets page', async ({ page }) => {
    // Navigate to tickets page
    await page.click('a[href="/company/tickets"]');
    await expect(page).toHaveURL(/.*tickets/);
    
    await page.screenshot({ path: 'company-tickets-page.jpeg', quality: 20 });
  });
  
  test('Tickets page displays ticket stats', async ({ page }) => {
    await page.goto(`${BASE_URL}/company/tickets`, { waitUntil: 'domcontentloaded' });
    
    // Wait for data to load
    await page.waitForLoadState('networkidle');
    
    // Check for stat cards
    await expect(page.locator('text=Total Tickets')).toBeVisible();
    await expect(page.locator('text=Total Sales')).toBeVisible();
    
    await page.screenshot({ path: 'company-tickets-stats.jpeg', quality: 20 });
  });
  
  test('Tickets page has filter controls', async ({ page }) => {
    await page.goto(`${BASE_URL}/company/tickets`, { waitUntil: 'domcontentloaded' });
    
    // Check for filter controls
    await expect(page.getByTestId('filter-agent')).toBeVisible();
    await expect(page.getByTestId('filter-status')).toBeVisible();
    await expect(page.getByTestId('apply-filters-button')).toBeVisible();
    
    await page.screenshot({ path: 'company-tickets-filters.jpeg', quality: 20 });
  });

});
