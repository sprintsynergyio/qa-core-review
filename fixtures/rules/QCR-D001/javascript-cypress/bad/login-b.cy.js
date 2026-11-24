describe('Smoke', () => {
  // Copied from login-a.cy.js.
  it('the shop lets a user in', () => { // expect: QCR-D001
    cy.visit('https://www.saucedemo.com');
    cy.get('[data-test="username"]').type('standard_user');
    cy.get('[data-test="password"]').type('secret_sauce');
    cy.get('[data-test="login-button"]').click();
    cy.url().should('include', '/inventory.html');
  });
});
