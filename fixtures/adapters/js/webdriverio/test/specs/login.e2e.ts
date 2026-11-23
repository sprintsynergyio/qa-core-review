import { $, browser } from '@wdio/globals';
import { expect } from 'expect-webdriverio';

describe('Login page', () => {
  beforeEach(async () => {
    await browser.url('https://www.saucedemo.com');
  });

  it('logs in the standard user', async () => {
    await $('#user-name').setValue('standard_user');
    await $('#password').setValue('secret_sauce');
    await $('#login-button').click();
    await expect(browser).toHaveUrl(expect.stringContaining('inventory'));
  });

  it('shows an error for a locked account', async () => {
    await $('#user-name').setValue('locked_out_user');
    await $('#password').setValue('secret_sauce');
    await $('#login-button').click();
    await browser.pause(3000);
    await expect($('[data-test="error"]')).toBeDisplayed();
  });
});
