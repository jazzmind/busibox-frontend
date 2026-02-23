/**
 * Tool Configuration API Route
 * 
 * GET/PUT /api/tools/[id]/config - Get or update tool configuration
 * 
 * Supports scoped configurations:
 * - personal: User-specific settings
 * - agent: Settings for specific agents
 * - global: System-wide defaults (admin only)
 * 
 * Proxies to the backend agent-server for persistent storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:8000';

type ConfigScope = 'personal' | 'agent' | 'global';

// Map frontend scope names to backend scope names
const scopeToBackend: Record<ConfigScope, string> = {
  'personal': 'user',
  'agent': 'agent',
  'global': 'system',
};

const scopeFromBackend: Record<string, ConfigScope> = {
  'user': 'personal',
  'agent': 'agent',
  'system': 'global',
};

/**
 * GET /api/tools/[id]/config
 * Get configuration for a specific tool
 * 
 * Query params:
 * - scope: 'personal' | 'agent' | 'global' (default: 'personal')
 * - agent_ids: comma-separated agent IDs (for agent scope)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { id: toolId } = await params;
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get('scope') || 'personal') as ConfigScope;
    const agentIds = searchParams.get('agent_ids')?.split(',').filter(Boolean) || [];

    // Map scope to backend naming convention
    const backendScope = scopeToBackend[scope] || 'user';
    
    // Build query params for backend
    const backendParams = new URLSearchParams({ scope: backendScope });
    if (agentIds.length > 0) {
      backendParams.set('agent_ids', agentIds.join(','));
    }

    // Proxy to backend
    const response = await fetch(
      `${AGENT_API_URL}/agents/tools/${toolId}/config?${backendParams}`, 
      {
        headers: {
          'Authorization': `Bearer ${auth.apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Return empty config instead of error
        return NextResponse.json({
          providers: {},
          settings: {},
          scope,
          agent_ids: agentIds,
          is_enabled: true,
        });
      }
      const errorText = await response.text();
      console.error(`[API] Backend error for GET tool config: ${response.status}`, errorText);
      let error = {};
      try {
        error = JSON.parse(errorText);
      } catch {}
      return NextResponse.json(
        { error: (error as any).detail || 'Failed to get tool configuration' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      providers: data.providers || {},
      settings: data.settings || {},
      scope: scopeFromBackend[data.scope] || scope,
      agent_ids: data.agent_ids || agentIds,
      is_enabled: data.is_enabled !== false,
    });
  } catch (error: any) {
    console.error('[API] Failed to get tool config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get tool configuration' },
      { status: error.statusCode || 500 }
    );
  }
}

/**
 * PUT /api/tools/[id]/config
 * Update configuration for a specific tool
 * 
 * Body:
 * - providers: Provider configurations
 * - settings: Additional settings
 * - scope: 'personal' | 'agent' | 'global'
 * - agent_ids: Array of agent IDs (for agent scope)
 * - is_enabled: Whether the tool is enabled at this scope
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { id: toolId } = await params;
    const body = await request.json();

    // Validate configuration structure
    if (body.providers) {
      for (const [provider, config] of Object.entries(body.providers)) {
        if (typeof config !== 'object') {
          return NextResponse.json(
            { error: `Invalid configuration for provider: ${provider}` },
            { status: 400 }
          );
        }
      }
    }

    // Validate scope
    const scope = (body.scope || 'personal') as ConfigScope;
    if (!['personal', 'agent', 'global'].includes(scope)) {
      return NextResponse.json(
        { error: 'Invalid scope. Must be personal, agent, or global.' },
        { status: 400 }
      );
    }

    // Map scope to backend naming convention
    const backendScope = scopeToBackend[scope] || 'user';
    
    // Proxy to backend with full config including scope
    const response = await fetch(`${AGENT_API_URL}/agents/tools/${toolId}/config`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${auth.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providers: body.providers || {},
        settings: body.settings || {},
        scope: backendScope,
        agent_id: scope === 'agent' && body.agent_ids?.length > 0 ? body.agent_ids[0] : undefined,
        is_enabled: body.is_enabled !== false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Backend error for PUT tool config: ${response.status}`, errorText);
      let error = {};
      try {
        error = JSON.parse(errorText);
      } catch {}
      return NextResponse.json(
        { error: (error as any).detail || 'Failed to update tool configuration' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      config: {
        providers: data.providers || {},
        settings: data.settings || {},
        scope: scopeFromBackend[data.scope] || scope,
        agent_ids: data.agent_ids,
        is_enabled: data.is_enabled !== false,
      },
    });
  } catch (error: any) {
    console.error('[API] Failed to update tool config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update tool configuration' },
      { status: error.statusCode || 500 }
    );
  }
}

/**
 * DELETE /api/tools/[id]/config
 * Delete configuration for a specific tool at a given scope
 * 
 * Query params:
 * - scope: 'personal' | 'agent' (default: 'personal') - cannot delete global
 * - agent_ids: comma-separated agent IDs (for agent scope)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { id: toolId } = await params;
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get('scope') || 'personal') as ConfigScope;
    const agentIds = searchParams.get('agent_ids')?.split(',').filter(Boolean) || [];

    // Validate scope - cannot delete global
    if (scope === 'global') {
      return NextResponse.json(
        { error: 'Cannot delete global configuration. It serves as the default for all users.' },
        { status: 400 }
      );
    }

    // Map scope to backend naming convention
    const backendScope = scopeToBackend[scope] || 'user';
    
    // Build query params for backend
    const backendParams = new URLSearchParams({ scope: backendScope });
    if (scope === 'agent' && agentIds.length > 0) {
      backendParams.set('agent_id', agentIds[0]);
    }

    const response = await fetch(
      `${AGENT_API_URL}/agents/tools/${toolId}/config?${backendParams}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth.apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Backend error for DELETE tool config: ${response.status}`, errorText);
      let error = {};
      try {
        error = JSON.parse(errorText);
      } catch {}
      return NextResponse.json(
        { error: (error as any).detail || 'Failed to delete tool configuration' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully. Using inherited settings.',
    });
  } catch (error: any) {
    console.error('[API] Failed to delete tool config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete tool configuration' },
      { status: error.statusCode || 500 }
    );
  }
}
