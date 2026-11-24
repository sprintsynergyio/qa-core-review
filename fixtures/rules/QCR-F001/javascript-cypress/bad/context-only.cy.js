describe('Inventory', () => {
  context.only('sorted by price', () => { // expect: QCR-F001
    it('starts with the cheapest', () => {
      cy.visit('https://www.saucedemo.com/inventory.html');
      cy.get('[data-test="product-sort-container"]').select('lohi');
      cy.get('[data-test="inventory-item-price"]').should('contain.text', '$7.99');
    });
  });
});
