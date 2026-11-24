describe('Custom commands', () => {
  // `login` has no assertion in it.
  it('only logs in', () => { // expect: QCR-A001
    cy.login('standard_user');
  });

  it('reads the orders', () => { // expect: QCR-A001
    cy.request('https://api.example.test/orders');
  });
});
