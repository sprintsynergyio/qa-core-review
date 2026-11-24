describe('Cart', () => {
  // The callbacks of should, then and within always run.
  it('checks inside callbacks', () => {
    cy.visit('https://www.saucedemo.com/cart.html');
    cy.get('[data-test="inventory-item"]').should(($items) => {
      expect($items).to.have.length(1);
    });
    cy.get('[data-test="cart-list"]').within(() => {
      cy.get('[data-test="inventory-item-name"]').should('have.text', 'Sauce Labs Backpack');
    });
  });
});
