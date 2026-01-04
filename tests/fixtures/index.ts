export const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'TestPassword123!',
    firstName: 'Admin',
    lastName: 'User',
  },
  teamMember: {
    email: 'member@test.com',
    password: 'TestPassword123!',
    firstName: 'Team',
    lastName: 'Member',
  },
  viewer: {
    email: 'viewer@test.com',
    password: 'TestPassword123!',
    firstName: 'Client',
    lastName: 'Viewer',
  },
}

export const testOrganization = {
  name: 'Test Organization',
  primaryColor: '#000000',
  secondaryColor: '#F5F5F0',
  accentColor: '#666666',
}

export const testCampaign = {
  name: 'Test Campaign',
  description: 'A test campaign for E2E testing',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
}

export const testIndustries = {
  marketing: 'Marketing',
  software: 'Software',
  accounting: 'Accounting',
}
