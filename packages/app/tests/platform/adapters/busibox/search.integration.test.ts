import { describe } from 'vitest';
import { runSearchContractTests } from '../../contracts/search.contract.test';

const SKIP = !process.env.SEARCH_API_URL;

describe.skipIf(SKIP)('BusiboxSearchAdapter (integration)', () => {
  let BusiboxSearchAdapter: typeof import('../../../../src/platform/adapters/busibox/search').BusiboxSearchAdapter;

  beforeAll(async () => {
    const mod = await import('../../../../src/platform/adapters/busibox/search');
    BusiboxSearchAdapter = mod.BusiboxSearchAdapter;
  });

  const adapter = { current: null as any };

  runSearchContractTests(
    () => adapter.current,
    async () => {
      const mod = await import('../../../../src/platform/adapters/busibox/search');
      adapter.current = new mod.BusiboxSearchAdapter({
        searchApiUrl: process.env.SEARCH_API_URL,
        getToken: async () => process.env.TEST_SESSION_JWT ?? '',
      });
    },
  );
});
