it('adds a backpack', () => { // expect: QCR-N001
  cy.visit('https://www.saucedemo.com/inventory.html');
  cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
  cy.get('[data-test="shopping-cart-badge"]').should('have.text', '1');
});

it('adds a bike light', () => {
  cy.visit('https://www.saucedemo.com/inventory.html');
  cy.get('[data-test="add-to-cart-sauce-labs-bike-light"]').click();
  cy.get('[data-test="shopping-cart-badge"]').should('have.text', '1');
});
