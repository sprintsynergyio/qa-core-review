describe('Search', () => {
  it('finds a onesie', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="search"]').type('onesie');
    cy.get('[data-test="inventory-item"]').should('have.length', 1);
  });

  it('shows an empty list for a word that matches nothing', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="search"]').type('umbrella');
    cy.get('[data-test="no-results"]').should('be.visible');
  });
});
