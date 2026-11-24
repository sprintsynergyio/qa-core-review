describe('Inventory', () => {
  it('adds the second product', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('.inventory_list > div:nth-child(2) button').click(); // expect: QCR-S001
    cy.get('.inventory_list').find('div:nth-of-type(3) button').click(); // expect: QCR-S001
    cy.get('#root > div > div > div > button').click(); // expect: QCR-S001
    cy.get('[data-test="shopping-cart-badge"]').should('have.text', '3');
  });
});
