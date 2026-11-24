import { $, browser } from '@wdio/globals';

describe('Login', () => {
  before(async () => {
    // A short implicit wait and a page load limit are settings, not sleeps.
    await browser.setTimeout({ implicit: 2000, pageLoad: 30000 });
  });

  it('shows the login button', async () => {
    await browser.url('https://www.saucedemo.com');
    await expect($('[data-test="login-button"]')).toBeDisplayed();
  });
});
