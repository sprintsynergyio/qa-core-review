describe('Login', () => {
  ['standard_user', 'visual_user'].forEach((user) => {
    it(`logs in as ${user}`, () => {
      cy.visit('https://www.saucedemo.com');
      cy.get('[data-test="username"]').type(user);
      cy.get('[data-test="login-button"]').click();
      cy.url().should('include', '/inventory.html');
    });
  });
});
