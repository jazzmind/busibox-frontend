import { NextResponse } from 'next/server';

/**
 * Health check endpoint
 * Used by monitoring systems and status dashboards
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      service: 'busibox-agents',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
