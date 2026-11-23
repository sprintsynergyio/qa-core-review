import { $, $$, browser } from '@wdio/globals';
import { expect } from 'expect-webdriverio';

describe('Inventory', () => {
  beforeEach(async () => {
    await browser.url('https://www.saucedemo.com/inventory.html');
    await expect(browser).toHaveUrl('https://www.saucedemo.com/inventory.html');
  });

  it('checks elements', async () => {
    const badge = $('.shopping_cart_badge');
    const sort = await browser.$('.product_sort_container');
    await expect(badge).toBeDisplayed();
    await expect(badge).toExist();
    await expect(badge).toBeExisting();
    await expect(badge).toBeDisplayedInViewport();
    await expect(badge).toHaveText('1');
    await expect(badge).toHaveElementClass('shopping_cart_badge');
    await expect(badge).toHaveHTML('<span class="shopping_cart_badge">1</span>');
    await expect($('.shopping_cart_link')).toBeClickable();
    await expect($('.shopping_cart_link')).toHaveHref('/cart.html');
    await expect(sort.$('option')).toBeSelected();
    await expect($$('.inventory_item')).toBeElementsArrayOfSize(6);
    await expect(browser).toHaveTitle('Swag Labs');
  });

  it('forgets to await', async () => {
    expect($('.shopping_cart_badge')).toBeDisplayed();
    expect(browser).toHaveTitle('Swag Labs');
  });

  it('an element query is always truthy', async () => {
    const badge = await $('.shopping_cart_badge');
    expect(badge).toBeTruthy();
    expect($('.missing')).toBeDefined();
  });

  it('checks plain values without await', async () => {
    const items = await $$('.inventory_item');
    const title = await browser.getTitle();
    expect(items.length).toBe(6);
    expect(title).toContain('Swag');
  });

  it('checks inside waitUntil', async () => {
    await browser.waitUntil(async () => {
      const text = await $('.shopping_cart_badge').getText();
      expect(text).toBe('1');
      return true;
    });
  });
});
