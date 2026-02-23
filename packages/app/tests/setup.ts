/**
 * Test setup - loads environment variables from .env
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Verify required environment variables
const required = [
  'DATA_API_HOST',
  'DATA_API_PORT',
  'AGENT_API_URL',
  'AUTHZ_BASE_URL',
];

const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
  console.warn('Some tests may fail. Copy .env from busibox if needed.');
}

// Set test-specific defaults
process.env.NODE_ENV = 'test';

// Suppress console output for expected errors in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Only show console output if test fails
global.console = {
  ...console,
  log: (...args: any[]) => {
    // Allow specific test output messages
    if (args[0]?.includes('✓') || args[0]?.includes('Testing against') || args[0]?.includes('⚠')) {
      originalConsoleLog(...args);
    }
  },
  warn: (...args: any[]) => {
    // Suppress expected warnings
    const message = String(args[0]);
    if (message.includes('TAVILY_API_KEY not set')) return;
    if (message.includes('Error getting authz token')) return;
    if (message.includes('No AUTHZ client credentials configured')) return;
    if (message.includes('Failed to exchange token')) return;
    originalConsoleWarn(...args);
  },
  error: (...args: any[]) => {
    // Suppress expected errors from error handling tests
    const message = String(args[0]);
    if (message.includes('[AUDIT] Failed to write audit log')) return;
    if (message.includes('[DATA SERVICE ERROR]')) return;
    if (message.includes('[RBAC] Failed to')) return;
    if (message.includes('[FastEmbed] Failed to generate embeddings')) return;
    originalConsoleError(...args);
  },
};
