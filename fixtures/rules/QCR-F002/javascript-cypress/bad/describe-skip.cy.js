describe.skip('Checkout', () => { // expect: QCR-F002
  it('shows the form', () => {
    cy.visit('https://www.saucedemo.com/checkout-step-one.html');
    cy.get('[data-test="firstName"]').should('be.visible');
  });
});

describe('Cart', () => {
  context.skip('with a coupon', () => { // expect: QCR-F002
    it('shows the discount', () => {
      cy.visit('https://www.saucedemo.com/cart.html');
      cy.get('[data-test="discount"]').should('be.visible');
    });
  });
});
