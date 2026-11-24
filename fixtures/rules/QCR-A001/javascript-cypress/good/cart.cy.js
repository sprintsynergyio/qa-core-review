describe('Cart', () => {
  // contains as the last command fails when the text is missing.
  it('shows the backpack in the cart', () => {
    cy.login('standard_user');
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.get('[data-test="shopping-cart-link"]').click();
    cy.contains('Sauce Labs Backpack');
  });

  it('checks the response of the API', () => {
    cy.request('https://api.example.test/orders').then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});
