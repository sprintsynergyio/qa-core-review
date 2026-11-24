describe('Login', () => {
  it('shows the login button', () => {
    cy.visit('https://www.saucedemo.com');
    cy.get('[data-test="login-button"]').should('be.visible');
  });
});
