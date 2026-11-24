describe('Inventory', () => {
  beforeEach(() => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.wait(1000); // expect: QCR-W001
  });

  it('shows six products', () => {
    cy.get('[data-test="inventory-item"]').should('have.length', 6);
  });
});
