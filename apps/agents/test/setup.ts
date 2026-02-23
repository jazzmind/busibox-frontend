import '@testing-library/jest-dom';
import { beforeAll, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/',
}));

// Mock environment variables
beforeAll(() => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
  process.env.MASTRA_API_URL = 'http://localhost:8000';
  process.env.ADMIN_CLIENT_ID = 'test-admin-client';
  process.env.ADMIN_CLIENT_SECRET = 'test-admin-secret';
});

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to disable specific console methods in tests
  // log: vi.fn(),
  // warn: vi.fn(),
  // error: vi.fn(),
};
