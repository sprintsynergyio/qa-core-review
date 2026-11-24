describe('Inventory', () => {
  context('sorted by price', () => {
    it('starts with the cheapest', () => {
      cy.visit('https://www.saucedemo.com/inventory.html');
      cy.get('[data-test="product-sort-container"]').select('lohi');
      cy.get('[data-test="inventory-item-price"]').should('contain.text', '$7.99');
    });
  });
});
