describe('avatarUpload', () => { // expect: QCR-N001
  it('takes a PNG', () => {
    cy.visit('https://www.saucedemo.com/profile.html');
    cy.get('[data-test="avatar"]').selectFile('cypress/fixtures/sam.png');
    cy.get('[data-test="avatar-preview"]').should('be.visible');
  });

  it('takes a JPEG', () => {
    cy.visit('https://www.saucedemo.com/profile.html');
    cy.get('[data-test="avatar"]').selectFile('cypress/fixtures/sam.jpg');
    cy.get('[data-test="avatar-preview"]').should('be.visible');
  });
});
