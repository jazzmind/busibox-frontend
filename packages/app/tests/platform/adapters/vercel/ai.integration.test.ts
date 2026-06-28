import { describe } from 'vitest';
import { runAIContractTests } from '../../contracts/ai.contract.test';

const SKIP = !process.env.ANTHROPIC_API_KEY;

describe.skipIf(SKIP)('VercelAIAdapter (integration)', () => {
  let VercelAIAdapter: typeof import('../../../../src/platform/adapters/vercel/ai').VercelAIAdapter;

  beforeAll(async () => {
    const mod = await import('../../../../src/platform/adapters/vercel/ai');
    VercelAIAdapter = mod.VercelAIAdapter;
  });

  runAIContractTests(() =>
    new VercelAIAdapter({
      models: { fast: 'claude-haiku-4-5', smart: 'claude-haiku-4-5' },
    }),
  );
});
