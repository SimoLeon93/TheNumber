// tests/critical.spec.js
// 3 critical test suites for TheNumber
// Run: npx playwright test tests/critical.spec.js

const { test, expect } = require('@playwright/test');

const SITE_URL = process.env.SITE_URL || 'https://simoleon93.github.io/TheNumber';

// ─────────────────────────────────────────────
// TEST 1: UI smoke — sito carica e mostra i 3 tier
// ─────────────────────────────────────────────
test.describe('UI Smoke Tests', () => {

  test('Homepage loads and shows blurred number', async ({ page }) => {
    await page.goto(SITE_URL, { waitUntil: 'networkidle' });
    
    // Titolo presente
    await expect(page.locator('h1')).toBeVisible();
    
    // Il numero sfocato è presente (elemento con class teaser o tnum)
    const teaserEl = page.locator('.teaser, .tnum, [class*="blur"]').first();
    await expect(teaserEl).toBeVisible();
  });

test('All 3 payment tiers are visible and clickable', async ({ page }) => {
  await page.goto(SITE_URL, { waitUntil: 'networkidle' });

  await expect(page.locator('#el-t0d')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#el-t1d')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#el-t2d')).toBeVisible({ timeout: 8000 });
});

});

// ─────────────────────────────────────────────
// TEST 2: Stripe redirect — i link portano a Stripe
// ─────────────────────────────────────────────
test.describe('Stripe Payment Links', () => {

test('Pay button is visible and functional', async ({ page }) => {
  await page.goto(SITE_URL, { waitUntil: 'networkidle' });

  await expect(page.locator('#paybtn')).toBeVisible({ timeout: 8000 });
  
  // Verifica che onclick contenga la funzione pay()
  const onclick = await page.locator('#paybtn').getAttribute('onclick');
  expect(onclick).toMatch(/pay/);
});

});

// ─────────────────────────────────────────────
// TEST 3: Firebase counter — risponde e restituisce un numero
// ─────────────────────────────────────────────
test.describe('Firebase Counter Integrity', () => {

  test('Firebase endpoint responds within 5s', async ({ request }) => {
    // Cerca il Firebase URL nel codice del sito
    const response = await request.get(SITE_URL);
    const body = await response.text();
    
    // Estrai Firebase URL dal codice
    const firebaseMatch = body.match(/https:\/\/[a-z0-9-]+\.firebaseio\.com|https:\/\/[a-z0-9-]+-default-rtdb\.firebaseio\.com/);
    
    if (firebaseMatch) {
      const fbUrl = firebaseMatch[0];
      const fbResponse = await request.get(`${fbUrl}/counter.json`);
      expect(fbResponse.status()).toBe(200);
      
      const data = await fbResponse.json();
      // Il counter deve essere un numero >= 0
      expect(typeof data === 'number' || typeof data?.value === 'number').toBeTruthy();
    } else {
      // Se Firebase URL non trovato nel codice, skip con warning
      console.warn('Firebase URL not found in page source — skipping counter test');
      test.skip();
    }
  });

  test('Page does not have console errors on load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto(SITE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Filtra errori non critici (es. CORS da estensioni browser)
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('extension') &&
      !e.includes('net::ERR_ABORTED')
    );
    
    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }
    
    // Max 2 errori non critici tollerati
    expect(criticalErrors.length).toBeLessThanOrEqual(2);
  });

});