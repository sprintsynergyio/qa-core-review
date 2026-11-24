describe.only('Checkout', () => { // expect: QCR-F001
  it('shows the form', () => {
    cy.visit('https://www.saucedemo.com/checkout-step-one.html');
    cy.get('[data-test="firstName"]').should('be.visible');
  });
});
