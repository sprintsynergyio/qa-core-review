describe('Orders', () => {
  it('waits for the request, not for the clock', () => {
    cy.intercept('GET', 'https://api.example.test/orders').as('orders');
    cy.intercept('GET', 'https://api.example.test/profile').as('profile');
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.wait('@orders').its('response.statusCode').should('eq', 200);
    cy.wait(['@orders', '@profile']);
    cy.get('[data-test="inventory-item"]').should('have.length', 6);
  });
});
