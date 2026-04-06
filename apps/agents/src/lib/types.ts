/**
 * Shared TypeScript types for Agent Manager
 * 
 * These types match the agent-server API schemas and are used throughout
 * the application for type safety and consistency.
 * 
 * Source: specs/001-agent-management-rebuild/data-model.md
 */

// ==========================================================================
// AGENT TYPES
// ==========================================================================

export interface Agent {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  model: string;
  instructions: string;
  tools: Record<string, any>;
  workflow: Record<string, any> | null;
  scopes: string[];
  is_active: boolean;
  allow_frontier_fallback?: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  
  // Derived properties (computed in client)
  is_builtin?: boolean;
  is_personal?: boolean;
  created_by?: string;
}

export interface AgentCreate {
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

// ==========================================================================
// RUN TYPES
// ==========================================================================

export type RunStatus = 
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'timeout';

export type RunTier = 
  | 'simple'
  | 'complex'
  | 'batch';

export interface Run {
  id: string;
  agent_id: string;
  input: Record<string, any>;
  output: Record<string, any> | null;
  status: RunStatus;
  events: RunEvent[];
  routing_decisions?: RoutingDecision[];
  performance_metrics: PerformanceMetrics;
  error: string | null;
  tier: RunTier;
  scopes: string[];
  created_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface RunEvent {
  id: string;
  type: 'status' | 'tool_call' | 'agent_call' | 'output' | 'error';
  timestamp: string;
  data: Record<string, any>;
  parent_event_id?: string;
}

export interface RoutingDecision {
  query: string;
  selected_tools: string[];
  selected_agents: string[];
  confidence: number;
  reasoning: string;
  alternatives: string[];
  user_override: boolean;
}

export interface PerformanceMetrics {
  duration_ms: number;
  token_usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  tool_calls: number;
  agent_calls: number;
}

export interface RunCreate {
  agent_id: string;
  input: Record<string, any>;
  tier?: RunTier;
  scopes?: string[];
}

// ==========================================================================
// WORKFLOW TYPES
// ==========================================================================

export type WorkflowNodeType = 
  | 'agent'
  | 'tool'
  | 'condition'
  | 'input'
  | 'output'
  | 'transform';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  config: Record<string, any>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowCreate {
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  is_active?: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: RunStatus;
  step_results: StepResult[];
  created_at: string;
  completed_at: string | null;
}

export interface StepResult {
  node_id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  input: Record<string, any>;
  output: Record<string, any> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

// ==========================================================================
// TOOL TYPES
// ==========================================================================

export interface Tool {
  id: string;
  name: string;
  description: string | null;
  schema: ToolSchema;
  entrypoint: string;
  scopes: string[];
  is_active: boolean;
  is_builtin: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ToolSchema {
  input: {
    type: 'object';
    properties: Record<string, SchemaProperty>;
    required: string[];
  };
  output: {
    type: 'object';
    properties: Record<string, SchemaProperty>;
  };
}

export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
}

export interface ToolCreate {
  name: string;
  description?: string;
  schema: ToolSchema;
  entrypoint: string;
  scopes?: string[];
  is_active?: boolean;
}

// ==========================================================================
// EVALUATION TYPES
// ==========================================================================

export interface Evaluator {
  id: string;
  name: string;
  description: string | null;
  config: EvaluatorConfig;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EvaluatorConfig {
  criteria: string;
  pass_threshold: number;
  model: string;
  prompt_template: string;
  rules: Record<string, any>;
}

export interface EvaluatorCreate {
  name: string;
  description?: string;
  config: EvaluatorConfig;
  is_active?: boolean;
}

export interface Score {
  id: string;
  run_id: string;
  evaluator_id: string;
  score: number;
  passed: boolean;
  details: Record<string, any>;
  created_at: string;
}

export interface ScoreAggregate {
  evaluator_id: string;
  agent_id: string | null;
  count: number;
  average: number;
  min: number;
  max: number;
  percentile_50: number;
  percentile_90: number;
  percentile_95: number;
  pass_rate: number;
}

// ==========================================================================
// SCHEDULE TYPES
// ==========================================================================

export interface Schedule {
  id: string;
  agent_id: string;
  input: Record<string, any>;
  cron_expression: string;
  tier: RunTier;
  scopes: string[];
  next_run_time: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleCreate {
  agent_id: string;
  input: Record<string, any>;
  cron_expression: string;
  tier?: RunTier;
  scopes?: string[];
}

// ==========================================================================
// MODEL TYPES
// ==========================================================================

export interface Model {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  context_length?: number;
  supports_streaming?: boolean;
  supports_function_calling?: boolean;
}

// ==========================================================================
// CHAT TYPES (for busibox-app)
// ==========================================================================

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  run_id?: string;
  routing_decision?: RoutingDecision;
  tool_calls?: ToolCall[];
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface ToolCall {
  id: string;
  tool_name: string;
  input: Record<string, any>;
  output: Record<string, any> | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface ChatSettings {
  enabled_tools: string[];
  enabled_agents: string[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  insights_enabled?: boolean;
}

// ==========================================================================
// AUTH TYPES
// ==========================================================================

export interface TokenExchangeResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
  scopes: string[];
}

// ==========================================================================
// ERROR TYPES
// ==========================================================================

export interface APIError {
  error: string;
  detail?: string;
  details?: Record<string, any>;
}

// ==========================================================================
// PAGINATION TYPES
// ==========================================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ==========================================================================
// FILTER TYPES
// ==========================================================================

export interface RunFilters {
  agent_id?: string;
  status?: RunStatus;
  created_by?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface ScoreFilters {
  evaluator_id?: string;
  agent_id?: string;
}
