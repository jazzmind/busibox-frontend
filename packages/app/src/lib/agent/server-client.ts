/**
 * Comprehensive Client for the Python Agent Server API
 * 
 * This client provides full access to the agent-server API including:
 * - Agent definitions (list, create, update, delete)
 * - Tools, workflows, and evaluations management
 * - Run execution and monitoring
 * - Scheduling
 * - Scoring and aggregates
 * - Model information
 * - SSE streaming
 * 
 * Based on OpenAPI spec: specs/001-agent-management-rebuild/contracts/agent-server-api.yaml
 */

import {
  getAgentApiUrl,
  buildAuthHeaders as getAgentApiHeaders,
  agentApiFetch,
  agentApiFetchJson,
} from './agent-api-base';

export { getAgentApiUrl, getAgentApiHeaders };

// ==========================================================================
// TYPES
// ==========================================================================

export interface AgentDefinition {
  id: string;
  name: string;
  display_name?: string | null;
  description?: string | null;
  model: string;
  instructions: string;
  tools: Record<string, any>;
  workflow?: Record<string, any> | null;
  scopes: string[];
  is_active: boolean;
  allow_frontier_fallback?: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AgentDefinitionCreate {
  name: string;
  display_name?: string;
  description?: string;
  model: string;
  instructions: string;
  tools?: Record<string, any>;
  workflow?: Record<string, any> | null;
  scopes?: string[];
  is_active?: boolean;
  allow_frontier_fallback?: boolean;
}

export interface Run {
  id: string;
  agent_id: string;
  workflow_id?: string | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'timeout';
  input: Record<string, any>;
  output?: Record<string, any> | null;
  events: RunEvent[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunEvent {
  timestamp: string;
  type: string;
  data: Record<string, any>;
}

export interface RunCreate {
  agent_id: string;
  workflow_id?: string | null;
  input: Record<string, any>;
}

export interface ScheduleCreate {
  agent_id: string;
  cron: string;
  input: Record<string, any>;
  scopes: string[];
  purpose: string;
}

export interface Schedule {
  schedule_id: string;
  message: string;
}

export interface TokenExchangeResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
  scopes: string[];
}

// ==========================================================================
// HEALTH & AUTH
// ==========================================================================

export async function checkHealth() {
  return agentApiFetchJson('/health');
}

export async function exchangeToken(scopes: string[], purpose: string, token?: string) {
  return agentApiFetchJson<TokenExchangeResponse>('/auth/exchange', {
    method: 'POST',
    token,
    body: JSON.stringify({ scopes, purpose }),
  });
}

// ==========================================================================
// AGENTS
// ==========================================================================

export async function listAgents(token?: string) {
  return agentApiFetchJson<AgentDefinition[]>('/agents', { token });
}

export async function createAgentDefinition(data: AgentDefinitionCreate, token?: string) {
  return agentApiFetchJson<AgentDefinition>('/agents/definitions', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export async function updateAgentDefinition(agentId: string, data: AgentDefinitionCreate, token?: string) {
  return agentApiFetchJson<AgentDefinition>(`/agents/definitions/${agentId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(data),
  });
}

export async function deleteAgent(agentId: string, token?: string) {
  const result = await agentApiFetchJson<any>(`/agents/definitions/${agentId}`, {
    method: 'DELETE',
    token,
  });
  return result ?? { success: true };
}

// ==========================================================================
// TOOLS
// ==========================================================================

export async function listTools(token?: string) {
  return agentApiFetchJson('/agents/tools', { token });
}

export async function createTool(data: any, token?: string) {
  return agentApiFetchJson('/agents/tools', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export interface ToolTestResult {
  success: boolean;
  output: Record<string, any> | null;
  error: string | null;
  execution_time_ms: number;
  tool_name: string;
  input_used: Record<string, any>;
}

export async function testTool(
  toolId: string,
  input: Record<string, any>,
  token?: string,
  providers?: Record<string, any>
): Promise<ToolTestResult> {
  const body: { input: Record<string, any>; providers?: Record<string, any> } = { input };
  if (providers) {
    body.providers = providers;
  }
  return agentApiFetchJson<ToolTestResult>(`/agents/tools/${toolId}/test`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

// ==========================================================================
// WORKFLOWS
// ==========================================================================

export async function listWorkflows(token?: string) {
  return agentApiFetchJson('/agents/workflows', { token });
}

export async function createWorkflow(data: any, token?: string) {
  return agentApiFetchJson('/agents/workflows', { method: 'POST', token, body: JSON.stringify(data) });
}

export async function getWorkflow(id: string, token?: string) {
  return agentApiFetchJson(`/agents/workflows/${id}`, { token });
}

export async function updateWorkflow(id: string, data: any, token?: string) {
  return agentApiFetchJson(`/agents/workflows/${id}`, { method: 'PUT', token, body: JSON.stringify(data) });
}

export async function deleteWorkflow(id: string, token?: string) {
  const result = await agentApiFetchJson<any>(`/agents/workflows/${id}`, { method: 'DELETE', token });
  return result ?? { success: true };
}

// ==========================================================================
// EVALUATIONS
// ==========================================================================

export async function listEvals(token?: string) {
  return agentApiFetchJson('/agents/evals', { token });
}

export async function createEval(data: any, token?: string) {
  return agentApiFetchJson('/agents/evals', { method: 'POST', token, body: JSON.stringify(data) });
}

// ==========================================================================
// EVAL DATASETS & SCENARIOS
// ==========================================================================

export async function listDatasets(agentId?: string, token?: string) {
  const params = agentId ? `?agent_id=${agentId}` : '';
  return agentApiFetchJson(`/evals/datasets${params}`, { token });
}

export async function createDataset(data: { name: string; description?: string; agent_id?: string; tags?: string[] }, token?: string) {
  return agentApiFetchJson('/evals/datasets', { method: 'POST', token, body: JSON.stringify(data) });
}

export async function getDataset(datasetId: string, token?: string) {
  return agentApiFetchJson(`/evals/datasets/${datasetId}`, { token });
}

export async function updateDataset(datasetId: string, data: any, token?: string) {
  return agentApiFetchJson(`/evals/datasets/${datasetId}`, { method: 'PATCH', token, body: JSON.stringify(data) });
}

export async function deleteDataset(datasetId: string, token?: string) {
  return agentApiFetchJson(`/evals/datasets/${datasetId}`, { method: 'DELETE', token });
}

export async function listScenarios(datasetId: string, token?: string) {
  return agentApiFetchJson(`/evals/datasets/${datasetId}/scenarios`, { token });
}

export async function createScenario(datasetId: string, data: any, token?: string) {
  return agentApiFetchJson(`/evals/datasets/${datasetId}/scenarios`, { method: 'POST', token, body: JSON.stringify(data) });
}

export async function updateScenario(scenarioId: string, data: any, token?: string) {
  return agentApiFetchJson(`/evals/scenarios/${scenarioId}`, { method: 'PATCH', token, body: JSON.stringify(data) });
}

export async function deleteScenario(scenarioId: string, token?: string) {
  return agentApiFetchJson(`/evals/scenarios/${scenarioId}`, { method: 'DELETE', token });
}

// ==========================================================================
// EVAL RUNS & SCORES
// ==========================================================================

export async function triggerEvalRun(data: { dataset_id: string; scorers?: string[]; name?: string; model_override?: string }, token?: string) {
  return agentApiFetchJson('/evals/run', { method: 'POST', token, body: JSON.stringify(data) });
}

export async function listEvalRuns(datasetId?: string, limit?: number, token?: string) {
  const params = new URLSearchParams();
  if (datasetId) params.set('dataset_id', datasetId);
  if (limit) params.set('limit', String(limit));
  return agentApiFetchJson(`/evals/runs?${params}`, { token });
}

export async function getEvalRun(runId: string, token?: string) {
  return agentApiFetchJson(`/evals/runs/${runId}`, { token });
}

export async function getEvalRunScores(runId: string, token?: string) {
  return agentApiFetchJson(`/evals/runs/${runId}/scores`, { token });
}

export async function getEvalRunAnalysis(runId: string, token?: string) {
  return agentApiFetchJson(`/evals/runs/${runId}/analysis`, { token });
}

export async function queryScores(filters: { agent_id?: string; scorer_name?: string; source?: string; days?: number; limit?: number }, token?: string) {
  const params = new URLSearchParams();
  if (filters.agent_id) params.set('agent_id', filters.agent_id);
  if (filters.scorer_name) params.set('scorer_name', filters.scorer_name);
  if (filters.source) params.set('source', filters.source);
  if (filters.days) params.set('days', String(filters.days));
  if (filters.limit) params.set('limit', String(filters.limit));
  return agentApiFetchJson(`/evals/scores?${params}`, { token });
}

export async function getScoreTrends(agentId?: string, scorerName?: string, days?: number, token?: string) {
  const params = new URLSearchParams();
  if (agentId) params.set('agent_id', agentId);
  if (scorerName) params.set('scorer_name', scorerName);
  if (days) params.set('days', String(days));
  return agentApiFetchJson(`/evals/scores/trends?${params}`, { token });
}

export async function getAgentScoreSummary(agentId: string, days?: number, token?: string) {
  const params = days ? `?days=${days}` : '';
  return agentApiFetchJson(`/evals/scores/by-agent/${agentId}${params}`, { token });
}

export async function getAgentMetrics(agentId: string, windowHours?: number, token?: string) {
  const params = windowHours ? `?window_hours=${windowHours}` : '';
  return agentApiFetchJson(`/evals/observability/agent/${agentId}/metrics${params}`, { token });
}

export async function getAgentTraces(agentId: string, limit?: number, token?: string) {
  const params = limit ? `?limit=${limit}` : '';
  return agentApiFetchJson(`/evals/observability/agent/${agentId}/traces${params}`, { token });
}

export async function getRoutingAccuracy(days?: number, token?: string) {
  const params = days ? `?days=${days}` : '';
  return agentApiFetchJson(`/evals/observability/routing/accuracy${params}`, { token });
}

// ==========================================================================
// MODELS
// ==========================================================================

export async function listModels(token?: string) {
  return agentApiFetchJson('/agents/models', { token });
}

// ==========================================================================
// RUNS
// ==========================================================================

export async function createRun(data: RunCreate, token?: string) {
  return agentApiFetchJson<Run>('/runs', { method: 'POST', token, body: JSON.stringify(data) });
}

export async function getRun(runId: string, token?: string) {
  return agentApiFetchJson<Run>(`/runs/${runId}`, { token });
}

export async function listRuns(filters?: {
  agent_id?: string;
  status?: string;
  created_by?: string;
  limit?: number;
  offset?: number;
}, token?: string) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
  }
  return agentApiFetchJson(`/runs${params.toString() ? `?${params}` : ''}`, { token });
}

export async function executeWorkflowRun(data: {
  workflow_id: string;
  input: Record<string, any>;
  tier?: string;
  scopes?: string[];
}, token?: string) {
  return agentApiFetchJson<Run>('/runs/workflow', { method: 'POST', token, body: JSON.stringify(data) });
}

// ==========================================================================
// SCHEDULES
// ==========================================================================

export async function createSchedule(data: ScheduleCreate, token?: string) {
  return agentApiFetchJson<Schedule>('/runs/schedule', { method: 'POST', token, body: JSON.stringify(data) });
}

export async function listSchedules(token?: string) {
  return agentApiFetchJson('/runs/schedule', { token });
}

export async function deleteSchedule(jobId: string, token?: string) {
  const result = await agentApiFetchJson<any>(`/runs/schedule/${jobId}`, { method: 'DELETE', token });
  return result ?? { success: true };
}

// ==========================================================================
// SCORES
// ==========================================================================

export async function executeScorer(data: {
  scorer_id: string;
  run_ids: string[];
}, token?: string) {
  return agentApiFetchJson('/scores/execute', { method: 'POST', token, body: JSON.stringify(data) });
}

export async function getScoreAggregates(filters?: {
  scorer_id?: string;
  agent_id?: string;
}, token?: string) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, value);
    });
  }
  return agentApiFetchJson(`/scores/aggregates${params.toString() ? `?${params}` : ''}`, { token });
}

// ==========================================================================
// CONVERSATIONS
// ==========================================================================

export interface Conversation {
  id: string;
  title: string;
  user_id: string;
  message_count?: number;
  last_message?: {
    role: string;
    content: string;
    created_at: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: any[];
  run_id?: string;
  routing_decision?: any;
  tool_calls?: any[];
  created_at: string;
}

export async function listConversations(filters?: {
  agent_id?: string;
  limit?: number;
  offset?: number;
}, token?: string) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
  }
  return agentApiFetchJson<{ conversations: Conversation[]; total: number; limit: number; offset: number }>(
    `/conversations${params.toString() ? `?${params}` : ''}`, { token },
  );
}

export async function getConversation(id: string, token?: string) {
  return agentApiFetchJson<Conversation & { messages?: Message[] }>(`/conversations/${id}`, { token });
}

export async function createConversation(data: { title?: string }, token?: string) {
  return agentApiFetchJson<Conversation>('/conversations', { method: 'POST', token, body: JSON.stringify(data) });
}

export async function updateConversation(id: string, data: { title?: string }, token?: string) {
  return agentApiFetchJson<Conversation>(`/conversations/${id}`, { method: 'PATCH', token, body: JSON.stringify(data) });
}

export async function deleteConversation(id: string, token?: string) {
  const result = await agentApiFetchJson<any>(`/conversations/${id}`, { method: 'DELETE', token });
  return result ?? { success: true };
}

// ==========================================================================
// MESSAGES
// ==========================================================================

export async function createMessage(
  conversationId: string,
  data: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    attachments?: any[];
    run_id?: string;
    routing_decision?: any;
    tool_calls?: any[];
  },
  token?: string
) {
  return agentApiFetchJson<Message>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export async function listMessages(conversationId: string, token?: string) {
  return agentApiFetchJson<Message[]>(`/conversations/${conversationId}/messages`, { token });
}

export async function getMessage(id: string, token?: string) {
  return agentApiFetchJson<Message>(`/messages/${id}`, { token });
}

// ==========================================================================
// CHAT SETTINGS
// ==========================================================================

export interface ChatSettings {
  id: string;
  user_id: string;
  enabled_tools: string[];
  enabled_agents: string[];
  model?: string;
  temperature: number;
  max_tokens: number;
  insights_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function getChatSettings(token?: string) {
  return agentApiFetchJson<ChatSettings>('/users/me/chat-settings', { token });
}

export async function updateChatSettings(
  data: {
    enabled_tools?: string[];
    enabled_agents?: string[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
    insights_enabled?: boolean;
  },
  token?: string
) {
  return agentApiFetchJson<ChatSettings>('/users/me/chat-settings', {
    method: 'PUT',
    token,
    body: JSON.stringify(data),
  });
}

// ==========================================================================
// DISPATCHER
// ==========================================================================

export interface DispatcherRequest {
  query: string;
  available_tools: Array<{ name: string; description: string }>;
  available_agents: Array<{ id: string; name: string; description?: string }>;
  attachments?: Array<{ name: string; type: string; url: string }>;
  user_settings?: Record<string, any>;
}

export interface DispatcherResponse {
  selected_tools: string[];
  selected_agents: string[];
  confidence: number;
  reasoning: string;
  alternatives: string[];
  requires_disambiguation: boolean;
}

export async function routeQuery(data: DispatcherRequest, token?: string) {
  return agentApiFetchJson<DispatcherResponse>('/dispatcher/route', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

// ==========================================================================
// STREAMING (SSE)
// ==========================================================================

/**
 * Stream run updates via Server-Sent Events (client-side via EventSource)
 */
export function streamRunUpdates(runId: string): EventSource {
  return new EventSource(`/api/streams/runs/${runId}`);
}

/**
 * Server-side SSE stream (for use in API routes)
 */
export async function getRunStreamResponse(runId: string, token?: string): Promise<Response> {
  return agentApiFetch(`/streams/runs/${runId}`, {
    token,
    headers: { 'Accept': 'text/event-stream' },
  });
}

// ==========================================================================
// WORKFLOW EXECUTION METHODS
// ==========================================================================

export async function getWorkflowExecution(executionId: string, token?: string): Promise<any> {
  return agentApiFetchJson(`/agents/workflows/executions/${executionId}`, { token });
}

export async function getWorkflowExecutionSteps(executionId: string, token?: string): Promise<any[]> {
  return agentApiFetchJson(`/agents/workflows/executions/${executionId}/steps`, { token });
}

export async function stopWorkflowExecution(executionId: string, token?: string): Promise<any> {
  return agentApiFetchJson(`/agents/workflows/executions/${executionId}/stop`, { method: 'POST', token });
}

export async function executeWorkflow(
  workflowId: string,
  inputData?: any,
  guardrails?: any,
  token?: string
): Promise<any> {
  return agentApiFetchJson(`/agents/workflows/${workflowId}/execute`, {
    method: 'POST',
    token,
    body: JSON.stringify({ input_data: inputData, guardrails }),
  });
}

export async function listWorkflowExecutions(
  workflowId: string,
  options?: { limit?: number; offset?: number; status?: string },
  token?: string
): Promise<any[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.status) params.append('status', options.status);
  return agentApiFetchJson(`/agents/workflows/${workflowId}/executions${params.toString() ? '?' + params.toString() : ''}`, { token });
}
