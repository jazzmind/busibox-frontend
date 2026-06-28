import { describe } from 'vitest';
import { runAIContractTests } from '../../contracts/ai.contract.test';

const SKIP = !process.env.AGENT_API_URL;

describe.skipIf(SKIP)('BusiboxAIAdapter (integration)', () => {
  let BusiboxAIAdapter: typeof import('../../../../src/platform/adapters/busibox/ai').BusiboxAIAdapter;

  beforeAll(async () => {
    const mod = await import('../../../../src/platform/adapters/busibox/ai');
    BusiboxAIAdapter = mod.BusiboxAIAdapter;
  });

  runAIContractTests(() =>
    new BusiboxAIAdapter({
      agentApiUrl: process.env.AGENT_API_URL,
      getToken: async () => process.env.TEST_SESSION_JWT ?? '',
    }),
  );
});
