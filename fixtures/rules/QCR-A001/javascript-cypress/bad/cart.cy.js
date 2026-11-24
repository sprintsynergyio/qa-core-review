describe('Cart', () => {
  // cy.get alone waits for the element and checks nothing about it.
  it('finds the badge', () => { // expect: QCR-A001
    cy.login('standard_user');
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.get('[data-test="shopping-cart-badge"]');
  });

  // contains in the middle of a chain is a way to find the button.
  it('clicks by text', () => { // expect: QCR-A001
    cy.login('standard_user');
    cy.contains('Add to cart').click();
  });
});
