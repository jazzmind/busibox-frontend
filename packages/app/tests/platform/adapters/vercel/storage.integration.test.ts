import { describe } from 'vitest';
import { runStorageContractTests } from '../../contracts/storage.contract.test';

const SKIP = !process.env.BLOB_READ_WRITE_TOKEN;

describe.skipIf(SKIP)('VercelStorageAdapter (integration)', () => {
  let VercelStorageAdapter: typeof import('../../../../src/platform/adapters/vercel/storage').VercelStorageAdapter;

  beforeAll(async () => {
    const mod = await import('../../../../src/platform/adapters/vercel/storage');
    VercelStorageAdapter = mod.VercelStorageAdapter;
  });

  runStorageContractTests(() =>
    new VercelStorageAdapter({
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
  );
});
