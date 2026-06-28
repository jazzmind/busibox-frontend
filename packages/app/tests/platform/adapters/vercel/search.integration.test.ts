import { describe } from 'vitest';
import { runSearchContractTests } from '../../contracts/search.contract.test';

const SKIP = !process.env.DATABASE_URL;

describe.skipIf(SKIP)('VercelSearchAdapter (integration)', () => {
  let VercelSearchAdapter: typeof import('../../../../src/platform/adapters/vercel/search').VercelSearchAdapter;

  beforeAll(async () => {
    const mod = await import('../../../../src/platform/adapters/vercel/search');
    VercelSearchAdapter = mod.VercelSearchAdapter;
  });

  const adapter = { current: null as any };

  runSearchContractTests(
    () => adapter.current,
    async () => {
      const mod = await import('../../../../src/platform/adapters/vercel/search');
      adapter.current = new mod.VercelSearchAdapter({
        databaseUrl: process.env.DATABASE_URL,
      });
    },
  );
});
