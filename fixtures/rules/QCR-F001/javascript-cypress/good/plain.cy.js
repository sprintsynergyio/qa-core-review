describe('Cart', () => {
  it('shows only the items you added', () => {
    cy.visit('https://www.saucedemo.com/cart.html');
    cy.get('[data-test="inventory-item"]').should('have.length', 0);
  });
});
