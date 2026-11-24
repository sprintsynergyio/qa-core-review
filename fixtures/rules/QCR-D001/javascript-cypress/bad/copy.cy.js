describe('Cart', () => {
  it('adds a backpack', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.get('[data-test="shopping-cart-badge"]').should('have.text', '1');
  });

  it('shows the badge after adding', () => { // expect: QCR-D001
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.get('[data-test="shopping-cart-badge"]').should('have.text', '1');
  });
});
