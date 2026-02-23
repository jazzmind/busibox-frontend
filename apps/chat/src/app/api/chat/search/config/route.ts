/**
 * Search Configuration API
 * 
 * Returns information about available and configured search providers from search-api
 */

import { NextResponse } from 'next/server';
import { getAvailableProviders } from '@jazzmind/busibox-app/lib/search';

export async function GET() {
  try {
    // Get available providers from search-api
    // During build/prerender, this will fail gracefully
    const providers = await getAvailableProviders();
    
    return NextResponse.json({
      webSearchAvailable: providers.length > 0,
      providers,
    });
  } catch (error: any) {
    // If this is a prerender error, return empty state
    if (error?.digest === 'HANGING_PROMISE_REJECTION') {
      return NextResponse.json({
        webSearchAvailable: false,
        providers: [],
      });
    }
    
    console.error('[Search Config API] Error checking search configuration:', error);
    
    return NextResponse.json({
      webSearchAvailable: false,
      providers: [],
      error: 'Failed to check search configuration',
    }, { status: 500 });
  }
}
