it('adds a fleece jacket', () => {
  cy.visit('https://www.saucedemo.com/inventory.html');
  cy.get('[data-test="add-to-cart-sauce-labs-fleece-jacket"]').click();
  cy.get('[data-test="shopping-cart-badge"]').should('have.text', '1');
});

it('has no badge on an empty cart', () => {
  cy.visit('https://www.saucedemo.com/inventory.html');
  cy.get('[data-test="shopping-cart-badge"]').should('not.exist');
});
