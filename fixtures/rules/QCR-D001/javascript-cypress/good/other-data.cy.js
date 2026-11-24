describe('Sorting', () => {
  it('sorts from low to high', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="product-sort-container"]').select('lohi');
    cy.get('[data-test="inventory-item-price"]').should('contain.text', '$7.99');
  });

  it('sorts from high to low', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="product-sort-container"]').select('hilo');
    cy.get('[data-test="inventory-item-price"]').should('contain.text', '$49.99');
  });
});
