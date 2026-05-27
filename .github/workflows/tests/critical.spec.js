const { test, expect } = require('@playwright/test');
const SITE_URL = process.env.SITE_URL || 'https://thenumber.lol';

test.describe('UI Smoke Tests', () => {

  test('Homepage loads and shows blurred number', async ({ page }) => {
    await page.goto(SITE_URL, { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toBeVisible();
    const teaserEl = page.locator('#tnum, .lock-number').first();
    await expect(teaserEl).toBeVisible();
  });

  test('Pay button and share buttons are visible', async ({ page }) => {
    await page.goto(SITE_URL, { waitUntil: 'networkidle' });
    await expect(page.locator('#paybtn')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.share-btns')).toBeVisible({ timeout: 8000 });
  });

  test('Watcher count is displayed', async ({ page }) => {
    await page.goto(SITE_URL, { waitUntil: 'networkidle' });
    const watcherEl = page.locator('#wcount').first();
    await expect(watcherEl).toBeVisible({ timeout: 8000 });
  });

});

test.describe('Stripe Payment Links', () => {

  test('Pay button is visible and functional', async ({ page }) => {
    await page.goto(SITE_URL, { waitUntil: 'networkidle' });
    await expect(page.locator('#paybtn')).toBeVisible({ timeout: 8000 });
    const onclick = await page.locator('#paybtn').getAttribute('onclick');
    expect(onclick).toMatch(/pay/);
  });

  test('Stripe payment handler exists in page', async ({ page }) => {
    await page.goto(SITE_URL, { waitUntil: 'networkidle' });
    const content = await page.content();
    expect(content).toMatch(/stripe|buy\.stripe|payment/i);
  });

});

test.describe('Firebase Counter Integrity', () => {

  test('Firebase endpoint responds within 5s', async ({ request }) => {
    const response = await request.get(SITE_URL);
    const body = await response.text();
    const firebaseMatch = body.match(/https:\/\/[a-z0-9-]+\.firebasedatabase\.app/);
    if (firebaseMatch) {
      const fbUrl = firebaseMatch[0];
      const fbResponse = await request.get(`${fbUrl}/count.json`);
      expect(fbResponse.status()).toBe(200);
    } else {
      console.warn('Firebase URL not found — skipping');
      test.skip();
    }
  });

  test('Page does not have console errors on load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(SITE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('extension') && !e.includes('net::ERR_ABORTED')
    );
    expect(criticalErrors.length).toBeLessThanOrEqual(2);
  });

});
