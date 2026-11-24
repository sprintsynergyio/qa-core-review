describe('Inventory', () => {
  it('opens every product', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="inventory-item-name"]').then(($names) => {
      [...$names].forEach((name) => {
        expect(name.textContent).to.not.equal(''); // expect: QCR-A004
      });
    });
  });
});
