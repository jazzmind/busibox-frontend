import { describe } from 'vitest';
import { runDataContractTests } from '../../contracts/data.contract.test';

const SKIP = !process.env.DATABASE_URL;

describe.skipIf(SKIP)('VercelDataAdapter (integration)', () => {
  let VercelDataAdapter: typeof import('../../../../src/platform/adapters/vercel/data').VercelDataAdapter;

  beforeAll(async () => {
    const mod = await import('../../../../src/platform/adapters/vercel/data');
    VercelDataAdapter = mod.VercelDataAdapter;
  });

  runDataContractTests(() =>
    new VercelDataAdapter({
      databaseUrl: process.env.DATABASE_URL,
    }),
  );
});
