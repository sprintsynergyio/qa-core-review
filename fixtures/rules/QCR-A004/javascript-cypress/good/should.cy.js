describe('Inventory', () => {
  it('every price has a dollar sign', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="inventory-item-price"]').should('have.length', 6).each(($price) => {
      expect($price.text()).to.match(/^\$/);
    });
  });
});
