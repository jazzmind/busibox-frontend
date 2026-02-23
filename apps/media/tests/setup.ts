import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'test-secret';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test-key';
process.env.SSO_JWT_SECRET = process.env.SSO_JWT_SECRET || 'test-sso-secret';
process.env.ALLOWED_EMAIL_DOMAINS = process.env.ALLOWED_EMAIL_DOMAINS || 'test.com';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@test.com';

