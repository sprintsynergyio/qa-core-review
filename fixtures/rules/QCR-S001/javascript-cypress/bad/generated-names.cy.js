describe('Menu', () => {
  it('opens the menu', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('.css-1q2w3e4').click(); // expect: QCR-S001
    cy.get('#ember123').click(); // expect: QCR-S001
    cy.get('nav').find('.MenuItem_link__9fK2x').click(); // expect: QCR-S001
    cy.get('nav').should('be.visible');
  });
});
