describe('Inventory', () => {
  context('sorted by price', () => {
    it('starts with the most expensive', () => {
      cy.visit('https://www.saucedemo.com/inventory.html');
      cy.get('[data-test="product-sort-container"]').select('hilo');
      cy.get('[data-test="inventory-item-price"]').should('contain.text', '$49.99');
    });
  });
});
