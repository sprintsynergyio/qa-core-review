describe('Custom commands', () => {
  // `expectCartCount` is defined in cypress/support/commands.js and contains an assertion.
  it('counts the cart with a custom command', () => {
    cy.login('standard_user');
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.expectCartCount(1);
  });
});
