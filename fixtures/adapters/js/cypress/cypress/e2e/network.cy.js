describe('Orders', () => {
  it('fakes every request', () => {
    cy.intercept('**', { statusCode: 200, body: {} });
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('.title').should('have.text', 'Products');
  });

  it('fakes one endpoint and watches another', () => {
    cy.intercept('GET', '**/api/orders', { fixture: 'orders.json' }).as('orders');
    cy.intercept('POST', '**/api/orders').as('create');
    cy.intercept('**/api/user', (req) => req.reply({ name: 'Sam' }));
    cy.intercept('*', []);
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.wait('@orders');
    cy.wait(['@orders', '@create']);
    cy.wait(2000);
    cy.get('[data-cy="order-row"]').should('have.length', 2);
  });

  it('moves the clock', () => {
    cy.clock();
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.tick(60000);
    cy.contains('Your session has expired');
  });

  it('picks elements by position', () => {
    cy.get('.inventory_item').eq(3).find('button').click();
    cy.get('.inventory_item').first().find('.inventory_item_name').click();
    cy.get('#root > div > div:nth-child(2) > button').dblclick();
    cy.get('[data-test="first-name"]').type('Sam').clear();
    cy.get('[data-test="terms"]').check().uncheck();
    cy.get('[data-test="receipt"]').selectFile('receipt.pdf');
    cy.get('.product_sort_container').select('za');
    cy.reload();
    cy.url().should('include', 'inventory');
  });

  it('creates data over the API', () => {
    cy.request('POST', 'https://api.example.test/orders', { item: 'backpack' }).its('status').should('eq', 201);
    cy.request({ method: 'DELETE', url: 'https://api.example.test/orders/1' });
    cy.request('https://api.example.test/orders').its('body').should('have.length', 0);
    cy.request('PATCH', 'https://api.example.test/orders/2', { note: 'gift' });
  });

  it('spies on the window', () => {
    cy.window().then((win) => {
      cy.spy(win.console, 'error');
      cy.stub(win, 'open').returns(null);
    });
    cy.get('#open-help').click();
    cy.window().its('open').should('have.been.calledOnce');
  });
});
