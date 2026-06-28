import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/platform/contracts/**/*.test.ts',
      'tests/platform/config/**/*.test.ts',
      'tests/platform/adapters/memory/**/*.test.ts',
    ],
    exclude: [
      'tests/platform/adapters/busibox/**',
      'tests/platform/adapters/vercel/**',
    ],
    coverage: {
      include: ['src/platform/**'],
      thresholds: { statements: 90, branches: 85, functions: 90 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '../../src') },
  },
});
