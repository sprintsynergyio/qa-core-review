describe('Inventory', () => {
  // With no price on the page, each runs zero times.
  it('every price has a dollar sign', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="inventory-item-price"]').each(($price) => {
      expect($price.text()).to.match(/^\$/); // expect: QCR-A004
    });
  });
});
