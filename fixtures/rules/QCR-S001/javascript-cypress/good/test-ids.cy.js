describe('Cart', () => {
  it('adds a backpack', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.get('[data-cy="open-cart"]').click();
    cy.get('[data-testid="cart-item"]').first().should('contain.text', 'Sauce Labs Backpack');
    cy.get('[data-test="cart-item"]').eq(0).should('be.visible');
  });
});
