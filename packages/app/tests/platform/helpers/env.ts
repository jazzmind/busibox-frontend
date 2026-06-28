export function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

export function hasBusiboxEnv(): boolean {
  return !!(process.env.AGENT_API_URL || process.env.DATA_API_URL);
}

export function hasVercelEnv(): boolean {
  return !!process.env.DATABASE_URL;
}

export function withEnv(vars: Record<string, string>, fn: () => void): void {
  const original: Record<string, string | undefined> = {};
  for (const [key, val] of Object.entries(vars)) {
    original[key] = process.env[key];
    process.env[key] = val;
  }
  try {
    fn();
  } finally {
    for (const [key, val] of Object.entries(original)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  }
}
