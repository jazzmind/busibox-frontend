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

/**
 * Check which agent definitions exist on the agent-api.
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
    const agentNames = Array.isArray(items)
      ? items.map((a: { name: string }) => a.name)
      : [];

    for (const def of definitions) {
      agents.push({
        name: def.name,
        displayName: def.display_name,
        exists: agentNames.includes(def.name),
      });
    }
  } catch {
    for (const def of definitions) {
      agents.push({ name: def.name, displayName: def.display_name, exists: false });
    }
  }

  return { agents };
}
