import { $, $$, browser } from '@wdio/globals';
import { expect } from 'expect-webdriverio';

describe('Checkout', () => {
  it('waits and fills the form', async () => {
    await browser.url('https://www.saucedemo.com/checkout-step-one.html');
    await browser.pause(2000);
    await $('#first-name').waitForDisplayed();
    await $('#first-name').setValue('Sam');
    await $('#last-name').addValue('Lee');
    await $('[data-test="postalCode"]').setValue('10115');
    await $('#continue').waitForClickable();
    await $('#continue').waitForEnabled();
    await $('#continue').click();
    await $('.summary_info').waitForExist();
    await browser.waitUntil(async () => (await browser.getUrl()).includes('step-two'));
    await expect($('.summary_total_label')).toHaveText('Total: $32.39');
  });

  it('uses the WebdriverIO selector forms', async () => {
    await $('=Twitter').click();
    await $('*=Sauce Labs').click();
    await $('aria/Open Menu').click();
    await $('~cart').tap();
    await $('//div[@class="cart_list"]/div[3]').click();
    await $$('.cart_item')[2].click();
    const link = await browser.$('.shopping_cart_link');
    await link.click();
    await expect(browser).toHaveUrl('https://www.saucedemo.com/cart.html');
  });

  it('types like a user', async () => {
    await user.click(document.querySelector('#finish'));
    await userEvent.type(document.querySelector('#first-name'), 'Sam');
    fireEvent.click(document.querySelector('#finish'));
    await expect($('.complete-header')).toBeDisplayed();
  });
});
