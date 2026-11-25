describe('Search', () => { // expect: QCR-N001
  it('finds a backpack', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="search"]').type('backpack');
    cy.get('[data-test="inventory-item"]').should('have.length', 1);
  });

  it('finds two shirts', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="search"]').type('shirt');
    cy.get('[data-test="inventory-item"]').should('have.length', 2);
  });
});
