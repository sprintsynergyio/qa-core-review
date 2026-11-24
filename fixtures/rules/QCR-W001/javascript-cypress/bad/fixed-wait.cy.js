describe('Cart', () => {
  it('adds a backpack', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.wait(2000); // expect: QCR-W001
    cy.get('[data-test="shopping-cart-badge"]').should('have.text', '1');
  });
});
