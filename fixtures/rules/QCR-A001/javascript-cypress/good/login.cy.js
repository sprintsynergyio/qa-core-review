describe('Login', () => {
  it('logs in', () => {
    cy.visit('https://www.saucedemo.com');
    cy.get('[data-test="username"]').type('standard_user');
    cy.get('[data-test="password"]').type('secret_sauce');
    cy.get('[data-test="login-button"]').click();
    cy.url().should('include', '/inventory.html');
  });

  it('shows an error for a locked user', () => {
    cy.login('locked_out_user');
    cy.get('[data-test="error"]').should('contain', 'locked out');
  });
});
