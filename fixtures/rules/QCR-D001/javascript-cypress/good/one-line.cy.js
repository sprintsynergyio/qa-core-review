describe('Header', () => {
  it('shows the cart link', () => {
    cy.get('[data-test="shopping-cart-link"]').should('be.visible');
  });
});

describe('Footer', () => {
  it('shows the cart link', () => {
    cy.get('[data-test="shopping-cart-link"]').should('be.visible');
  });
});
