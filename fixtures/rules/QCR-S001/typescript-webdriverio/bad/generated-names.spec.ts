import { $, browser } from '@wdio/globals';

describe('Menu', () => {
  it('opens the menu', async () => {
    await browser.url('https://www.saucedemo.com/inventory.html');
    await $('.css-1q2w3e4').click(); // expect: QCR-S001
    await $('.jss42').click(); // expect: QCR-S001
    await expect($('nav')).toBeDisplayed();
  });
});
