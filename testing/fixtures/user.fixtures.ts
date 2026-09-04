import { Role } from '@prisma/client';

export const TEST_USER_ID = 'user_test_1';
export const TEST_USER_2_ID = 'user_test_2';
export const TEST_ADMIN_ID = 'admin_test_1';
export const TEST_STRIPE_CUSTOMER_ID = 'cus_test_123';
export const TEST_STRIPE_CUSTOMER_2_ID = 'cus_test_456';

export const mockTestUser = {
  id: TEST_USER_ID,
  name: 'Test Customer',
  email: 'customer@example.com',
  phone: '+1234567890',
  password: '$2a$12$mockHashedPasswordExample1234567890',
  role: Role.USER,
  emailVerified: new Date('2026-01-01T00:00:00Z'),
  isActive: true,
  stripeCustomerId: TEST_STRIPE_CUSTOMER_ID,
  addressLine: '123 Main St',
  city: 'Testville',
  postalCode: '12345',
  country: 'USA',
  resetToken: null,
  resetTokenExpires: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z')
};

export const mockTestUser2 = {
  id: TEST_USER_2_ID,
  name: 'Second Customer',
  email: 'customer2@example.com',
  phone: '+1987654321',
  password: '$2a$12$mockHashedPasswordExample1234567890',
  role: Role.USER,
  emailVerified: new Date('2026-01-01T00:00:00Z'),
  isActive: true,
  stripeCustomerId: TEST_STRIPE_CUSTOMER_2_ID,
  addressLine: '456 Elm St',
  city: 'Othercity',
  postalCode: '67890',
  country: 'USA',
  resetToken: null,
  resetTokenExpires: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z')
};

export const mockTestAdmin = {
  id: TEST_ADMIN_ID,
  name: 'Admin Tester',
  email: 'admin@example.com',
  phone: '+1555555555',
  password: '$2a$12$mockHashedPasswordExample1234567890',
  role: Role.ADMIN,
  emailVerified: new Date('2026-01-01T00:00:00Z'),
  isActive: true,
  stripeCustomerId: null,
  addressLine: '999 Admin Blvd',
  city: 'Admintown',
  postalCode: '00001',
  country: 'USA',
  resetToken: null,
  resetTokenExpires: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z')
};
