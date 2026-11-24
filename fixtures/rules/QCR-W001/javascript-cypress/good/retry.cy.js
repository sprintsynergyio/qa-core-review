describe('Cart', () => {
  it('adds a backpack', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.get('[data-test="shopping-cart-badge"]', { timeout: 10000 }).should('have.text', '1');
  });
});
