import { describe } from 'vitest';
import { runStorageContractTests } from '../../contracts/storage.contract.test';

const SKIP = !process.env.DATA_API_URL;

describe.skipIf(SKIP)('BusiboxStorageAdapter (integration)', () => {
  let BusiboxStorageAdapter: typeof import('../../../../src/platform/adapters/busibox/storage').BusiboxStorageAdapter;

  beforeAll(async () => {
    const mod = await import('../../../../src/platform/adapters/busibox/storage');
    BusiboxStorageAdapter = mod.BusiboxStorageAdapter;
  });

  runStorageContractTests(() =>
    new BusiboxStorageAdapter({
      dataApiUrl: process.env.DATA_API_URL,
      getToken: async () => process.env.TEST_SESSION_JWT ?? '',
    }),
  );
});
