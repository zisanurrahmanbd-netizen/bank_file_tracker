import { beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-secret';

// Global test setup
beforeAll(async () => {
  // Any global setup needed
  console.log('Test setup complete');
});

afterAll(async () => {
  // Clean up
  console.log('Test cleanup complete');
});