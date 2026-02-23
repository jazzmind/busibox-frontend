/**
 * Authentication helpers for tests
 * 
 * Gets real JWT tokens from the authz service for testing using
 * Zero Trust subject-token exchange.
 */

const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://10.96.200.210:8010';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@busibox.local';
const TEST_MODE_HEADERS: Record<string, string> = { 'X-Test-Mode': 'true' };

// Cache tokens to avoid repeated requests
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getSessionToken(): Promise<string> {
  const cacheKey = 'session-jwt';
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  const initiate = await fetch(`${AUTHZ_BASE_URL}/auth/login/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...TEST_MODE_HEADERS,
    },
    body: JSON.stringify({ email: TEST_USER_EMAIL }),
  });

  if (!initiate.ok) {
    throw new Error(`Failed to initiate login: ${initiate.status} ${await initiate.text()}`);
  }

  const initiateData = await initiate.json();
  const magicLinkToken = initiateData.magic_link_token;
  if (!magicLinkToken) {
    throw new Error(
      'No magic_link_token in login response. Enable test mode and ensure authz test-mode token echo is available.'
    );
  }

  const useResp = await fetch(`${AUTHZ_BASE_URL}/auth/magic-links/${magicLinkToken}/use`, {
    method: 'POST',
    headers: TEST_MODE_HEADERS,
  });

  if (!useResp.ok) {
    throw new Error(`Failed to use magic link: ${useResp.status} ${await useResp.text()}`);
  }

  const useData = await useResp.json();
  const sessionToken = useData?.session?.token;
  if (!sessionToken) {
    throw new Error('No session token returned from magic-link use endpoint');
  }

  // Session JWT default TTL is long; cache for 1 hour locally.
  tokenCache.set(cacheKey, { token: sessionToken, expiresAt: Date.now() + 3600_000 });
  return sessionToken;
}

/**
 * Get a real JWT token from authz service for testing
 */
export async function getTestAuthzToken(
  audience: string,
  scopes: string[] = []
): Promise<string> {
  const cacheKey = `${audience}:${scopes.join(',')}`;
  
  // Check cache
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  const token = await getAuthzToken('test-user', audience, scopes);
  return token;
}

/**
 * Clear token cache (useful between test suites)
 */
export function clearTokenCache(): void {
  tokenCache.clear();
}

/**
 * Get auth token using OAuth token exchange
 * Uses test client credentials from environment
 */
export async function getAuthzToken(
  userId: string,
  audience: string,
  scopes: string[]
): Promise<string> {
  const cacheKey = `${userId}:${audience}:${scopes.join(',')}`;
  
  // Check cache
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  try {
    // Ignore userId in Zero Trust mode: authz derives subject from subject_token.
    void userId;
    const sessionToken = await getSessionToken();

    // Exchange the session JWT for an audience-scoped access token.
    const exchangeParams = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: sessionToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      audience,
      scope: scopes.join(' '),
    });

    const exchangeResponse = await fetch(`${AUTHZ_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...TEST_MODE_HEADERS,
      },
      body: exchangeParams.toString(),
    });

    if (!exchangeResponse.ok) {
      const error = await exchangeResponse.text();
      throw new Error(`Failed to exchange token: ${exchangeResponse.status} ${error}`);
    }

    const exchangeData = await exchangeResponse.json();
    const token = exchangeData.access_token;
    const expiresAt = Date.now() + (exchangeData.expires_in * 1000);

    // Cache token
    tokenCache.set(cacheKey, { token, expiresAt });

    return token;
  } catch (error) {
    throw new Error(`Auth token acquisition failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

