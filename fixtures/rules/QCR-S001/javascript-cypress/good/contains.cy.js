describe('Inventory', () => {
  it('opens a product by its name', () => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.contains('Sauce Labs Backpack').click();
    cy.contains('button', 'Add to cart').click();
    cy.get('#shopping_cart_container').should('contain.text', '1');
  });
});
