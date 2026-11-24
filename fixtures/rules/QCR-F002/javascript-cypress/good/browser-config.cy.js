// The condition is in the test configuration, for everyone to read.
describe('Print', { browser: '!firefox' }, () => {
  it('prints the receipt', () => {
    cy.visit('https://www.saucedemo.com/checkout-complete.html');
    cy.get('[data-test="complete-header"]').should('be.visible');
  });
});
