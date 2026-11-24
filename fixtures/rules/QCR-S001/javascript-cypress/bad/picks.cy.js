describe('Inventory', () => {
  // Picks by position are reported as info.
  it('opens the third product', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('.inventory_item').eq(2).click(); // expect: QCR-S001
    cy.get('.inventory_item_name').first().click(); // expect: QCR-S001
    cy.get('.inventory_item_name').last().click(); // expect: QCR-S001
    cy.get('[data-test="inventory-item-name"]').should('have.text', 'Sauce Labs Bolt T-Shirt');
  });
});
