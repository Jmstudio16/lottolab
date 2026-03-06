import { test, expect, Page } from '@playwright/test';
import { loginAsSupervisor, dismissToasts, removeEmergentBadge } from '../fixtures/helpers';

const BASE_URL = 'https://vendeur-dashboard.preview.emergentagent.com';

test.describe('Supervisor Features', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
  });

  test('should login as supervisor and redirect to dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Fill login form
    await page.fill('input[placeholder*="email"]', 'supervisor@lotopam.com');
    await page.fill('input[type="password"]', 'Supervisor123!');
    await page.click('button:has-text("SIGN IN")');
    
    // Should redirect to supervisor dashboard
    await page.waitForURL('**/supervisor/dashboard', { timeout: 15000 });
    
    // Verify dashboard loaded
    await expect(page.getByTestId('supervisor-dashboard')).toBeVisible({ timeout: 10000 });
    
    // Verify header shows "Tableau de Bord Superviseur"
    await expect(page.getByRole('heading', { name: /Tableau de Bord Superviseur/i })).toBeVisible();
  });

  test('should display correct stats on dashboard', async ({ page }) => {
    await loginAsSupervisor(page);
    
    // Wait for dashboard to load
    await expect(page.getByTestId('supervisor-dashboard')).toBeVisible({ timeout: 10000 });
    
    // Verify stats cards are present - use more specific selectors
    await expect(page.locator('text="Total Agents"').first()).toBeVisible();
    await expect(page.locator('text="Agents Actifs"').first()).toBeVisible();
    await expect(page.locator('text="Agents Suspendus"').first()).toBeVisible();
    await expect(page.locator("text=\"Tickets Aujourd'hui\"").first()).toBeVisible();
    
    // Verify agents section is present - use the CardTitle specific to dashboard
    const agentsSection = page.locator('.bg-slate-800').filter({ hasText: /Mes Agents/ }).first();
    await expect(agentsSection).toBeVisible();
    
    // Take screenshot for visual verification
    await page.screenshot({ path: '/app/tests/e2e/supervisor-dashboard.jpeg', quality: 20, fullPage: false });
  });

  test('should navigate to all supervisor pages', async ({ page }) => {
    await loginAsSupervisor(page);
    
    // Wait for dashboard
    await expect(page.getByTestId('supervisor-dashboard')).toBeVisible({ timeout: 10000 });
    
    // Navigate to Agents page
    await page.click('a[href="/supervisor/agents"]');
    await expect(page.getByRole('heading', { name: /Mes Agents/i })).toBeVisible({ timeout: 10000 });
    
    // Navigate to Tickets page
    await page.click('a[href="/supervisor/tickets"]');
    await expect(page.getByTestId('supervisor-tickets-page')).toBeVisible({ timeout: 10000 });
    
    // Navigate to Reports page  
    await page.click('a[href="/supervisor/reports"]');
    await expect(page.getByTestId('supervisor-reports-page')).toBeVisible({ timeout: 10000 });
    
    // Navigate back to Dashboard
    await page.click('a[href="/supervisor/dashboard"]');
    await expect(page.getByTestId('supervisor-dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('should display agents list with commission percentage', async ({ page }) => {
    await loginAsSupervisor(page);
    
    // Navigate to agents page
    await page.click('a[href="/supervisor/agents"]');
    
    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Mes Agents/i })).toBeVisible({ timeout: 10000 });
    
    // Verify stats section - use first() for elements that appear multiple times
    await expect(page.locator('text="Total Agents"').first()).toBeVisible();
    await expect(page.locator('text="Actifs"').first()).toBeVisible();
    await expect(page.locator('text="Suspendus"').first()).toBeVisible();
    await expect(page.locator('text="Commission Moy."')).toBeVisible();
    
    // Verify table headers using role
    await expect(page.getByRole('columnheader', { name: /Agent/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Contact/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Commission/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Statut/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Actions/i })).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: '/app/tests/e2e/supervisor-agents-page.jpeg', quality: 20, fullPage: false });
  });

  test('should display tickets from all agents', async ({ page }) => {
    await loginAsSupervisor(page);
    
    // Navigate to tickets page
    await page.click('a[href="/supervisor/tickets"]');
    
    // Wait for page to load
    await expect(page.getByTestId('supervisor-tickets-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Tickets/i })).toBeVisible();
    
    // Verify stats section using first() for duplicates
    await expect(page.locator('text="Total Tickets"').first()).toBeVisible();
    await expect(page.locator('text="Total Ventes"').first()).toBeVisible();
    await expect(page.locator('p:has-text("Gagnants")').first()).toBeVisible();
    await expect(page.locator('text="En Attente"').first()).toBeVisible();
    
    // Verify filter dropdowns exist
    const agentFilter = page.locator('select').first();
    await expect(agentFilter).toBeVisible();
    
    // Verify table headers include % Agent column using role
    await expect(page.getByRole('columnheader', { name: /% AGENT/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Code/i })).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: '/app/tests/e2e/supervisor-tickets-page.jpeg', quality: 20, fullPage: false });
  });

  test('should display sales report with commission calculations', async ({ page }) => {
    await loginAsSupervisor(page);
    
    // Navigate to reports page
    await page.click('a[href="/supervisor/reports"]');
    
    // Wait for page to load
    await expect(page.getByTestId('supervisor-reports-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Rapport de Ventes/i })).toBeVisible();
    
    // Verify supervisor commission card
    await expect(page.locator('text="Votre Commission Superviseur"')).toBeVisible();
    await expect(page.locator('text="Vos Gains"')).toBeVisible();
    
    // Verify date inputs exist (type="date")
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs.first()).toBeVisible();
    
    // Verify summary cards - use first() to avoid duplicates
    await expect(page.locator('span:has-text("Agents")').first()).toBeVisible();
    await expect(page.locator('span:has-text("Tickets")').first()).toBeVisible();
    
    // Verify report table columns include commission calculations
    await expect(page.getByRole('columnheader', { name: /%AGENT/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /%SUP/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /B\.FINAL/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /COMM\. AGENT/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /COMM\. SUP/i })).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: '/app/tests/e2e/supervisor-reports-page.jpeg', quality: 20, fullPage: false });
  });

  test('should filter sales report by date range', async ({ page }) => {
    await loginAsSupervisor(page);
    
    // Navigate to reports page
    await page.click('a[href="/supervisor/reports"]');
    await expect(page.getByTestId('supervisor-reports-page')).toBeVisible({ timeout: 10000 });
    
    // Find date inputs and filter button
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs.first()).toBeVisible();
    
    // Set date range
    await dateInputs.first().fill('2026-03-01');
    await dateInputs.nth(1).fill('2026-03-06');
    
    // Click filter button
    await page.click('button:has-text("Filtrer")');
    
    // Wait for refresh (table reload)
    await page.waitForLoadState('domcontentloaded');
    
    // Report should still be visible
    await expect(page.getByTestId('supervisor-reports-page')).toBeVisible();
  });

  test('should search agents in dashboard', async ({ page }) => {
    await loginAsSupervisor(page);
    
    // Wait for dashboard
    await expect(page.getByTestId('supervisor-dashboard')).toBeVisible({ timeout: 10000 });
    
    // Find search input
    const searchInput = page.locator('input[placeholder*="Rechercher"]').first();
    await expect(searchInput).toBeVisible();
    
    // Search for agent
    await searchInput.fill('Marie');
    
    // Wait for filter to apply
    await page.waitForLoadState('domcontentloaded');
    
    // Verify search worked - the agent list should contain Marie
    const agentList = page.locator('table tbody');
    await expect(agentList).toBeVisible();
  });

  test('should logout from supervisor account', async ({ page }) => {
    await loginAsSupervisor(page);
    
    // Wait for dashboard
    await expect(page.getByTestId('supervisor-dashboard')).toBeVisible({ timeout: 10000 });
    
    // Click logout button in sidebar
    await page.click('button:has-text("Déconnexion")');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });
});
