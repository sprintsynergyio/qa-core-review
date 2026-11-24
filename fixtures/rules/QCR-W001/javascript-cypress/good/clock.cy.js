describe('Session', () => {
  // cy.tick moves a fake clock. Nothing sleeps.
  it('logs out after 30 minutes without a click', () => {
    cy.clock();
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.tick(30 * 60 * 1000);
    cy.get('[data-test="login-button"]').should('be.visible');
  });
});
