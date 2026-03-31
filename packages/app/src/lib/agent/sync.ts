/**
 * Agent Sync Helpers
 *
 * Standalone functions for syncing agent definitions to the agent-api.
 * Apps provide their agent definitions array and a token; this module
 * handles the POST /agents/definitions loop and status checks.
 *
 * Usage:
 * ```typescript
 * import { syncAgentDefinitions, getAgentSyncStatus } from '@jazzmind/busibox-app/lib/agent/sync';
 *
 * const result = await syncAgentDefinitions(agentToken, AGENT_DEFINITIONS);
 * const status = await getAgentSyncStatus(agentToken, AGENT_DEFINITIONS);
 * ```
 */

import type { AgentDefinitionInput, AgentSyncResult, AgentStatus, SyncStatus } from './agent-service-client';

const getAgentApiUrl = () =>
  process.env.AGENT_API_URL ||
  process.env.NEXT_PUBLIC_AGENT_API_URL ||
  'http://localhost:8000';

/**
 * Sync an array of agent definitions to the agent-api.
 * Creates new agents or updates existing ones (idempotent via POST /agents/definitions).
 */
export async function syncAgentDefinitions(
  agentApiToken: string,
  definitions: AgentDefinitionInput[],
  agentApiUrl?: string,
): Promise<AgentSyncResult> {
  const baseUrl = agentApiUrl || getAgentApiUrl();
  const created: string[] = [];
  const updated: string[] = [];
  const failed: string[] = [];

  for (const agent of definitions) {
    try {
      const response = await fetch(`${baseUrl}/agents/definitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agentApiToken}`,
        },
        body: JSON.stringify(agent),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.version && data.version > 1) {
          updated.push(agent.name);
        } else {
          created.push(agent.name);
        }
      } else {
        const errText = await response.text();
        console.error(`[agent-sync] Failed to sync agent ${agent.name}: ${response.status} ${errText}`);
        failed.push(agent.name);
      }
    } catch {
      failed.push(agent.name);
    }
  }

  return { created, updated, failed };
}

function sortedToolNames(tools?: { names?: string[] }): string[] {
  return [...(tools?.names || [])].sort();
}

function compareAgentFields(
  def: AgentDefinitionInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remote: Record<string, any>,
): string[] {
  const diffs: string[] = [];

  const localTools = sortedToolNames(def.tools);
  const remoteTools = sortedToolNames(remote.tools);
  if (JSON.stringify(localTools) !== JSON.stringify(remoteTools)) {
    diffs.push(`tools: [${remoteTools.join(', ')}] → [${localTools.join(', ')}]`);
  }

  if (def.model !== remote.model) {
    diffs.push(`model: ${remote.model || '(none)'} → ${def.model}`);
  }

  const localWf = def.workflows || {};
  const remoteWf = remote.workflows || {};
  if (JSON.stringify(localWf) !== JSON.stringify(remoteWf)) {
    diffs.push('workflows changed');
  }

  if ((def.display_name || '') !== (remote.display_name || '')) {
    diffs.push(`display_name: ${remote.display_name || '(none)'} → ${def.display_name}`);
  }

  if ((def.scopes || []).sort().join(',') !== (remote.scopes || []).sort().join(',')) {
    diffs.push('scopes changed');
  }

  return diffs;
}

/**
 * Check which agent definitions exist on the agent-api and whether they match code.
 */
export async function getAgentSyncStatus(
  agentApiToken: string,
  definitions: AgentDefinitionInput[],
  agentApiUrl?: string,
): Promise<SyncStatus> {
  const baseUrl = agentApiUrl || getAgentApiUrl();
  const agents: AgentStatus[] = [];

  try {
    const response = await fetch(`${baseUrl}/agents`, {
      headers: { Authorization: `Bearer ${agentApiToken}` },
    });
    const data = response.ok ? await response.json() : { items: [] };
    const items = data.items || data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentMap = new Map<string, Record<string, any>>();
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.name) agentMap.set(item.name, item);
      }
    }

    for (const def of definitions) {
      const remote = agentMap.get(def.name);
      if (!remote) {
        agents.push({ name: def.name, displayName: def.display_name, exists: false, inSync: false, diffs: ['not registered'] });
      } else {
        const diffs = compareAgentFields(def, remote);
        agents.push({
          name: def.name,
          displayName: def.display_name,
          exists: true,
          inSync: diffs.length === 0,
          diffs,
        });
      }
    }
  } catch {
    for (const def of definitions) {
      agents.push({ name: def.name, displayName: def.display_name, exists: false, inSync: false });
    }
  }

  return { agents };
}
