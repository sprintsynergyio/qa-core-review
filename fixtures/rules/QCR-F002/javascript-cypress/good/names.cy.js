describe('Onboarding', () => {
  it('lets you skip the tour', () => {
    cy.visit('https://www.saucedemo.com');
    cy.contains('button', 'Skip').click();
    cy.get('[data-test="login-button"]').should('be.visible');
  });
});
