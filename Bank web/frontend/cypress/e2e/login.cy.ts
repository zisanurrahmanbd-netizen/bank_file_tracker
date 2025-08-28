describe('Login Flow', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should display login page correctly', () => {
    cy.contains('লগইন করুন'); // Bengali heading
    cy.get('input[name="email"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible');
  });

  it('should show validation errors for empty form', () => {
    cy.get('button[type="submit"]').click();
    cy.contains('Please fill in all fields').should('be.visible');
  });

  it('should login with admin credentials', () => {
    cy.get('input[name="email"]').type('admin@example.com');
    cy.get('input[name="password"]').type('admin123');
    cy.get('button[type="submit"]').click();

    // Should redirect to admin dashboard
    cy.url().should('include', '/admin/dashboard');
    cy.contains('Dashboard').should('be.visible');
  });

  it('should login with agent credentials', () => {
    cy.get('input[name="email"]').type('agent1@example.com');
    cy.get('input[name="password"]').type('agent123');
    cy.get('button[type="submit"]').click();

    // Should redirect to agent dashboard
    cy.url().should('include', '/agent/dashboard');
    cy.contains('Agent Dashboard').should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    cy.get('input[name="email"]').type('invalid@example.com');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    cy.contains('Invalid email or password').should('be.visible');
  });

  it('should fill demo credentials when clicked', () => {
    // Click admin demo credentials
    cy.contains('Admin: admin@example.com / admin123').click();
    
    cy.get('input[name="email"]').should('have.value', 'admin@example.com');
    cy.get('input[name="password"]').should('have.value', 'admin123');
  });

  it('should toggle password visibility', () => {
    cy.get('input[name="password"]').should('have.attr', 'type', 'password');
    
    // Click eye icon to show password
    cy.get('button').contains('svg').click();
    cy.get('input[name="password"]').should('have.attr', 'type', 'text');
    
    // Click again to hide password
    cy.get('button').contains('svg').click();
    cy.get('input[name="password"]').should('have.attr', 'type', 'password');
  });
});