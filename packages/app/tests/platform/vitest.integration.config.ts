import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/platform/adapters/busibox/**/*.integration.test.ts',
      'tests/platform/adapters/vercel/**/*.integration.test.ts',
    ],
    testTimeout: 30_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '../../src') },
  },
});
