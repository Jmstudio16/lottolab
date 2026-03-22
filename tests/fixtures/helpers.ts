import { Page, expect } from '@playwright/test';

const BASE_URL = 'https://vendeur-checkout.preview.emergentagent.com';

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
}

export async function dismissToasts(page: Page) {
  await page.addLocatorHandler(
    page.locator('[data-sonner-toast], .Toastify__toast, [role="status"].toast, .MuiSnackbar-root'),
    async () => {
      const close = page.locator('[data-sonner-toast] [data-close], [data-sonner-toast] button[aria-label="Close"], .Toastify__close-button, .MuiSnackbar-root button');
      await close.first().click({ timeout: 2000 }).catch(() => {});
    },
    { times: 10, noWaitAfter: true }
  );
}

export async function checkForErrors(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const errorElements = Array.from(
      document.querySelectorAll('.error, [class*="error"], [id*="error"]')
    );
    return errorElements.map(el => el.textContent || '').filter(Boolean);
  });
}

export async function loginAsSuperAdmin(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', 'jefferson@jmstudio.com');
  await page.fill('input[type="password"]', 'JMStudio@2026!');
  await page.click('button:has-text("SIGN IN")');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

export async function loginAsCompanyAdmin(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', 'admin@lotopam.com');
  await page.fill('input[type="password"]', 'Admin123!');
  await page.click('button:has-text("SIGN IN")');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

export async function loginWithCredentials(page: Page, email: string, password: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("SIGN IN")');
}

export async function logout(page: Page) {
  // Click profile menu and logout
  const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Déconnexion")');
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
  }
}

export async function apiLogin(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  return data.token;
}

export async function loginAsAgent(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', 'agent.marie@lotopam.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button:has-text("SIGN IN")');
  // Agent redirects to /agent/dashboard after login
  await page.waitForURL('**/agent/**', { timeout: 15000 });
}

export async function loginAsVendeur(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', 'jean@gmail.com');
  await page.fill('input[type="password"]', 'Jeff.1995');
  await page.click('button:has-text("SIGN IN")');
  // Vendeur redirects to /vendeur/dashboard
  await page.waitForURL('**/vendeur/**', { timeout: 15000 });
}

export async function removeEmergentBadge(page: Page) {
  await page.evaluate(() => {
    const badge = document.querySelector('[class*="emergent"], [id*="emergent-badge"]');
    if (badge) badge.remove();
  });
}

export async function loginAsSupervisor(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder*="email"]', 'supervisor@lotopam.com');
  await page.fill('input[type="password"]', 'Supervisor123!');
  await page.click('button:has-text("SIGN IN")');
  await page.waitForURL('**/supervisor/**', { timeout: 15000 });
}
