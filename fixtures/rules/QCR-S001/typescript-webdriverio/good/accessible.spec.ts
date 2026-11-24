import { $, browser } from '@wdio/globals';

describe('Login', () => {
  it('logs in with accessible names', async () => {
    await browser.url('https://www.saucedemo.com');
    await $('aria/Username').setValue('standard_user');
    await $('~password').setValue('secret_sauce');
    await $('=Sign in').click();
    // An element found by its text, however long the text is.
    await $('h2=Welcome back to the Swag Labs shop').click();
    await $('.inventory_item_name*=Sauce Labs').click();
    await expect($('aria/Products')).toBeDisplayed();
  });
});
