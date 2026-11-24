describe('Cart', () => {
  it.only('adds a backpack', () => { // expect: QCR-F001
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.get('[data-test="shopping-cart-badge"]').should('have.text', '1');
  });

  it('opens the cart', () => {
    cy.visit('https://www.saucedemo.com/cart.html');
    cy.get('[data-test="cart-list"]').should('be.visible');
  });
});
