import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/config
 * 
 * Returns public configuration values for client-side use.
 * This allows environment variables to be accessed at runtime
 * rather than build time.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    agentApiUrl: process.env.NEXT_PUBLIC_AGENT_API_URL || process.env.AGENT_API_URL || null,
    dataApiUrl: process.env.NEXT_PUBLIC_DATA_API_URL || process.env.DATA_API_URL || null,
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  });
}
