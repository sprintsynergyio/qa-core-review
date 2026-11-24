// A tag selects tests from the command line. Nothing is left in the code to forget.
describe('Login', { tags: '@smoke' }, () => {
  it('shows the login button', () => {
    cy.visit('https://www.saucedemo.com');
    cy.get('[data-test="login-button"]').should('be.visible');
  });
});
