import { describe } from 'vitest';
import { runDataContractTests } from '../../contracts/data.contract.test';

const SKIP = !process.env.DATA_API_URL;

describe.skipIf(SKIP)('BusiboxDataAdapter (integration)', () => {
  // Lazy import to avoid loading busibox adapter when env is not set
  let BusiboxDataAdapter: typeof import('../../../../src/platform/adapters/busibox/data').BusiboxDataAdapter;

  beforeAll(async () => {
    const mod = await import('../../../../src/platform/adapters/busibox/data');
    BusiboxDataAdapter = mod.BusiboxDataAdapter;
  });

  runDataContractTests(() =>
    new BusiboxDataAdapter({
      dataApiUrl: process.env.DATA_API_URL,
      getToken: async () => process.env.TEST_SESSION_JWT ?? '',
    }),
  );
});
