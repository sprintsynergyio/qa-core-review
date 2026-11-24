describe('Login', () => {
  it.skip('rejects an empty password', () => { // expect: QCR-F002
    cy.visit('https://www.saucedemo.com');
    cy.get('[data-test="login-button"]').click();
    cy.get('[data-test="error"]').should('contain.text', 'Password is required');
  });

  xit('rejects a locked user', () => { // expect: QCR-F002
    cy.visit('https://www.saucedemo.com');
    cy.get('[data-test="error"]').should('contain.text', 'locked out');
  });
});
