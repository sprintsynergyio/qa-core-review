import { test, expect, chromium, request } from '@playwright/test';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe('waits', () => {
  test('hard waits', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/inventory.html');
    await page.getByRole('button', { name: 'Add to cart' }).first().click();
    await page.waitForTimeout(3000);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await sleep(250);
    await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
  });

  test('waits for a condition', async ({ page }) => {
    const orders = page.waitForResponse('**/orders');
    await page.getByRole('button', { name: 'Finish' }).click();
    await orders;
    await page.waitForRequest('**/analytics');
    await page.waitForURL(/checkout-complete/);
    await page.waitForSelector('.complete-header');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.title === 'Swag Labs');
    await page.waitForEvent('console');
    await page.getByText('Thank you').waitFor();
    await expect(page.getByText('Thank you for your order!')).toBeVisible();
  });
});

test.describe('selectors', () => {
  test('brittle ones', async ({ page, frame }) => {
    await page.locator('#root > div > div:nth-child(2) > div.css-1q2w3e4 > button').click();
    await page.locator('//div[3]/div[2]/button[2]').dblclick();
    await page.locator('xpath=/html/body/div[1]/button').hover();
    await page.locator('.inventory_item').nth(3).click();
    await page.locator('.inventory_item').last().press('Enter');
    await page.click('.btn_primary.btn_small');
    await page.fill('#first-name', 'Sam');
    await page.type('[name="lastName"]', 'Lee');
    await page.check('#terms');
    await page.selectOption('.product_sort_container', 'za');
    await frame.click('text=Pay now');
    const title = await page.$('.title');
    const items = await page.$$('.inventory_item');
    const names = await page.$$eval('.inventory_item_name', (nodes) => nodes.map((node) => node.textContent));
    const first = await page.$eval('.inventory_item_name', (node) => node.textContent);
    const count = await page.evaluate(() => document.querySelectorAll('.inventory_item').length + (document.querySelector('.title') ? 1 : 0));
    expect([title, items, names, first, count]).toHaveLength(5);
  });

  test('stable ones', async ({ page }) => {
    await page.getByRole('button', { name: 'Add to cart' }).first().click();
    await page.getByTestId('checkout').click();
    await page.getByLabel('First Name').fill('Sam');
    await page.getByPlaceholder('Last Name').fill('Lee');
    await page.getByText('Continue').click();
    await page.getByAltText('Sauce Labs Backpack').click();
    await page.getByTitle('Close').click();
    await page.locator('[data-test="finish"]').click();
    await page.locator('[data-qa="back"]').uncheck();
    await page.locator('data-cy=menu').tap();
    await page.locator('role=button[name="Open"]').clear();
    await page.locator('id=react-burger-menu-btn').dragTo(page.locator('#drop'));
    await page.locator('[data-testid="upload"]').setInputFiles('receipt.pdf');
    await page.frameLocator('#payment').locator(`#card-${1}`).fill('4242');
    await page.reload();
    await page.goBack();
    await expect(page).toHaveURL(/inventory/);
  });
});

test.describe('network and data', () => {
  test('fakes every request, then checks the page', async ({ page }) => {
    await page.route('**/*', (route) => route.fulfill({ status: 200, body: '{}' }));
    await page.goto('https://www.saucedemo.com/inventory.html');
    await expect(page.getByText('Products')).toBeVisible();
  });

  test('fakes every request with a pattern', async ({ page }) => {
    await page.route(/.*/, (route) => route.fulfill({ status: 500 }));
    await page.goto('https://www.saucedemo.com/inventory.html');
    await expect(page.getByText('Something went wrong')).toBeVisible();
  });

  test('fakes one endpoint and lets the rest through', async ({ page, context }) => {
    await page.route('**/api/orders', (route) => route.fulfill({ json: [] }));
    await context.route(/analytics/, (route) => route.continue());
    await context.route('**/images/**', (route) => route.fallback());
    await page.route('**/api/user', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, json: { name: 'Sam' } });
    });
    await page.goto('https://www.saucedemo.com/inventory.html');
    await expect(page.getByText('No orders yet')).toBeVisible();
  });

  test('creates an order and leaves it behind', async ({ request }) => {
    const created = await request.post('https://api.example.test/orders', { data: { item: 'backpack' } });
    expect(created.status()).toBe(201);
    const listed = await request.get('https://api.example.test/orders');
    expect(listed.status()).toBe(200);
    await request.head('https://api.example.test/orders');
  });

  test('creates an order and deletes it', async ({ request }) => {
    const created = await request.post('https://api.example.test/orders', { data: { item: 'backpack' } });
    const { id } = await created.json();
    await request.put(`https://api.example.test/orders/${id}`, { data: { item: 'bike light' } });
    await request.patch(`https://api.example.test/orders/${id}`, { data: { note: 'gift' } });
    const removed = await request.delete(`https://api.example.test/orders/${id}`);
    expect(removed.status()).toBe(204);
  });
});

test.describe('resources', () => {
  test('opens a second context and never closes it', async ({ browser }) => {
    const admin = await browser.newContext();
    const adminPage = await admin.newPage();
    await adminPage.goto('https://www.saucedemo.com');
    await expect(adminPage).toHaveTitle('Swag Labs');
  });

  test('opens a second context and closes it', async ({ browser, context }) => {
    const admin = await browser.newContext();
    const adminPage = await admin.newPage();
    const popup = await context.newPage();
    await expect(adminPage).toHaveTitle('Swag Labs');
    await popup.goto('https://www.saucedemo.com');
    await admin.close();
  });

  test('launches its own browser and API client', async () => {
    const own = await chromium.launch();
    const api = await request.newContext({ baseURL: 'https://api.example.test' });
    const response = await api.get('/orders');
    expect(response.status()).toBe(200);
    await api.dispose();
  });
});
