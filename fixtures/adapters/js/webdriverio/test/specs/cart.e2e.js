describe('Cart', () => {
  it('adds a backpack', async () => {
    await browser.url('https://www.saucedemo.com/inventory.html');
    await $('#add-to-cart-sauce-labs-backpack').click();
    await expect($('.shopping_cart_badge')).toHaveText('1');
  });
});
