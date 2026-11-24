describe('Orders API', () => {
  it('lists the orders', () => {
    cy.request('https://api.example.test/orders').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.length(2);
    });
  });
});
