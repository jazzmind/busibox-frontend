/**
 * Chat Page - Server Component
 *
 * Zero Trust: Uses session JWT from cookie for authentication.
 * All data fetching happens server-side with token exchange.
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ChatPage } from '@jazzmind/busibox-app/components';
import { createAgentClient } from '@jazzmind/busibox-app/lib/agent';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';

// Agent API URL - computed at runtime to ensure env vars are available
function getAgentApiUrl(): string {
  const url = process.env.AGENT_API_URL ||
    (process.env.AGENT_API_HOST
      ? `http://${process.env.AGENT_API_HOST}:${process.env.AGENT_API_PORT || 8000}`
      : 'https://localhost/api/agent');
  return url;
}

// Session cookie name - contains RS256-signed JWT from authz
const SESSION_COOKIE_NAME = 'busibox-session';

/**
 * Parse JWT claims without verification (for extracting user info).
 * Full signature verification happens at token exchange with authz.
 */
function parseJwtClaims(token: string): { sub: string; exp: number; typ: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload;
  } catch {
    return null;
  }
}

async function getServerSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    console.log('[CHAT] No session token found in cookies');
    return null;
  }

  // Zero Trust: Validate JWT locally (signature verified at token exchange)
  const claims = parseJwtClaims(sessionToken);
  
  if (!claims || claims.typ !== 'session') {
    console.log('[CHAT] Invalid session JWT format');
    return null;
  }
  
  // Check expiration
  if (claims.exp * 1000 < Date.now()) {
    console.log('[CHAT] Session JWT expired');
    return null;
  }

  return { userId: claims.sub, sessionJwt: sessionToken };
}

interface PageProps {
  searchParams?: Promise<{ conversation?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const session = await getServerSession();

  if (!session) {
    redirect('/portal/login');
  }

  // Create agent client with server-side auth (Zero Trust)
  const agentUrl = getAgentApiUrl();
  
  const client = createAgentClient({
    agentUrl,
    getAuthToken: async () => {
      // Use Zero Trust token exchange (no client credentials)
      const token = await exchangeWithSubjectToken({
        sessionJwt: session.sessionJwt,
        userId: session.userId,
        audience: 'agent-api',
        scopes: [],
        purpose: 'chat-page',
      });
      return token.accessToken;
    },
  });

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialConversationId = resolvedSearchParams?.conversation;

  return (
    <div className="h-full w-full">
      <ChatPage
        client={client}
        showInsights={true}
        allowConversationManagement={true}
        initialConversationId={initialConversationId}
        source="busibox-portal"
      />
    </div>
  );
}
