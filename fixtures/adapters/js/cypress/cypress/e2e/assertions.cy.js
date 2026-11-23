// Custom commands usually live in cypress/support. One that asserts is a helper.
Cypress.Commands.add('expectCartCount', (count) => {
  cy.get('.shopping_cart_badge').should('have.text', String(count));
});
Cypress.Commands.overwrite('visit', (originalFn, url) => originalFn(url));
Cypress.Commands.add('login', (user) => {
  cy.get('#user-name').type(user);
  cy.get('#login-button').click();
});

describe('Cart', () => {
  beforeEach(() => {
    cy.visit('https://www.saucedemo.com/inventory.html');
    cy.get('[data-test="title"]').should('have.text', 'Products');
  });

  it('checks elements with should', () => {
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.get('.shopping_cart_badge').should('be.visible').and('have.text', '1');
    cy.get('.shopping_cart_badge').should('exist');
    cy.get('#react-burger-menu-btn').should('not.be.hidden');
    cy.get('.inventory_item').should('have.length', 6);
    cy.get('.inventory_item').first().should('contain', 'Backpack');
    cy.get('.inventory_item').last().should('include.text', 'T-Shirt');
    cy.get('.inventory_item').eq(1).find('button').should('have.class', 'btn_inventory');
    cy.get('.product_sort_container').should('have.value', 'az');
    cy.get('.product_sort_container').should('have.attr', 'data-test', 'product-sort-container');
    cy.get('.product_sort_container').should('have.css', 'display', 'block');
    cy.get('.product_sort_container').should('have.prop', 'disabled', false);
    cy.get('.product_sort_container').should('have.id', 'sort');
    cy.get('.product_sort_container').should('be.enabled').and('not.be.disabled');
    cy.get('.product_sort_container option').first().should('be.selected');
    cy.get('#remember').should('be.checked');
    cy.get('#search').should('be.focused').and('be.empty');
    cy.get('.footer_copy').should('have.html', '&copy; 2026 Sauce Labs');
    cy.get('.inventory_list').should('have.length.greaterThan', 0);
    cy.get('.inventory_item_price').first().invoke('text').should('match', /^\$\d+\.\d\d$/);
    cy.url().should('include', '/inventory.html');
    cy.title().should('eq', 'Swag Labs');
  });

  it('checks requests and stubs', () => {
    const onOpen = cy.stub();
    const onClose = cy.spy();
    cy.request('https://api.example.test/orders').its('status').should('eq', 200);
    cy.request({ url: 'https://api.example.test/orders/missing', failOnStatusCode: false }).then((response) => {
      expect(response.status).to.eq(404);
      expect(response.body).to.have.property('error');
      assert.isObject(response.body);
    });
    cy.wrap(onOpen).should('have.been.calledOnce');
    cy.wrap(onClose).should('not.have.been.called');
  });

  it('a callback given to should always runs', () => {
    cy.get('.inventory_item').should(($items) => {
      expect($items).to.have.length(6);
      expect($items.first()).to.contain('Backpack');
    });
    cy.get('.cart_list').within(() => {
      cy.get('.cart_item').should('have.length', 1);
    });
  });

  it('each may run zero times', () => {
    cy.get('.inventory_item_price').each(($price) => {
      expect($price.text()).to.match(/^\$/);
    });
  });

  it('ends with contains', () => {
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.get('.shopping_cart_link').click();
    cy.contains('Sauce Labs Backpack');
  });

  it('ends with contains on a chain', () => {
    cy.get('.shopping_cart_link').click();
    cy.get('.cart_list').contains('.inventory_item_name', 'Sauce Labs Backpack');
  });

  it('contains in the middle is a step, and get alone checks nothing', () => {
    cy.contains('Add to cart').click();
    cy.get('.shopping_cart_badge');
  });

  it('uses a custom command that asserts', () => {
    cy.login('standard_user');
    cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    cy.expectCartCount(1);
  });

  it('uses a custom command that does not assert', () => {
    cy.login('standard_user');
  });

  it('compares a picture', () => {
    cy.get('.inventory_list').matchImageSnapshot('inventory');
  });

  it('the assertion is a condition', () => {
    cy.get('body').then(($body) => {
      if ($body.find('.error-message-container').length > 0) {
        cy.get('.error-message-container').should('contain', 'locked out');
      }
    });
  });
});
