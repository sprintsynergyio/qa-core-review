import { $, browser } from '@wdio/globals';

describe('Login', () => {
  before(async () => {
    // Reported as info: every lookup of a missing element now takes 10 seconds.
    await browser.setTimeout({ implicit: 10000 }); // expect: QCR-W001
  });

  it('shows the login button', async () => {
    await browser.url('https://www.saucedemo.com');
    await expect($('[data-test="login-button"]')).toBeDisplayed();
  });
});
