const pageLoad = 3000;

describe('Checkout', () => {
  it('opens the checkout form', () => {
    cy.visit('https://www.saucedemo.com/cart.html');
    cy.get('[data-test="checkout"]').click().wait(500); // expect: QCR-W001
    cy.wait(pageLoad); // expect: QCR-W001
    cy.get('[data-test="firstName"]').should('be.visible');
  });
});
