/**
 * Workflow Type Definitions
 * 
 * Comprehensive types for workflow management including triggers, conditions, 
 * guardrails, and execution tracking.
 * 
 * Based on Pydantic AI multi-agent patterns:
 * https://ai.pydantic.dev/multi-agent-applications/
 */

// ============================================================================
// Trigger Types
// ============================================================================

export type TriggerType = 'manual' | 'cron' | 'webhook' | 'event' | 'agent_completion';

export type EventType = 'minio_upload' | 'email_received' | 'queue_message';

export interface TriggerConfig {
  // For cron triggers
  schedule?: string;  // e.g., "0 9 * * *" (daily at 9am)
  timezone?: string;  // e.g., "America/New_York"
  
  // For webhook triggers
  path?: string;  // e.g., "/webhooks/profile-request"
  auth_required?: boolean;
  
  // For event triggers
  event_type?: EventType;
  event_filter?: Record<string, any>;  // Filter criteria
  
  // For agent_completion triggers
  agent_id?: string;
}

export interface WorkflowTrigger {
  type: TriggerType;
  config: TriggerConfig;
}

// ============================================================================
// Guardrails Types
// ============================================================================

export interface WorkflowGuardrails {
  request_limit?: number;          // Max LLM requests
  total_tokens_limit?: number;     // Max tokens across all requests
  tool_calls_limit?: number;       // Max tool invocations
  timeout_seconds?: number;        // Max duration
  max_cost_dollars?: number;       // Cost ceiling
}

// ============================================================================
// Step Types
// ============================================================================

export type StepType = 'agent' | 'tool' | 'condition' | 'human' | 'parallel' | 'loop';

export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'exists';

export type NotificationChannel = 'email' | 'slack' | 'ui';

export type TimeoutAction = 'continue' | 'fail' | 'skip';

export interface Condition {
  field: string;                    // JSONPath like "$.get_document.found"
  operator: ConditionOperator;
  value?: any;
  then_step?: string;               // Step ID to go to if true
  else_step?: string;               // Step ID to go to if false
}

export interface HumanOption {
  id: string;
  label: string;
  next_step?: string;
}

export interface HumanConfig {
  notification: string;             // Message to send
  notification_channels?: NotificationChannel[];
  timeout_minutes?: number;
  on_timeout?: TimeoutAction;
  options?: HumanOption[];         // For decision points
}

export interface LoopConfig {
  items_path: string;               // JSONPath to array
  item_variable: string;            // Variable name for current item
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  name?: string;
  type: StepType;
  
  // Agent step - delegate to an agent
  agent_id?: string;
  agent_prompt?: string;            // Can use $.references
  
  // Tool step - call a tool directly
  tool?: string;
  tool_args?: Record<string, any>; // Can use $.references
  
  // Condition step - branching logic
  condition?: Condition;
  
  // Human step - wait for human decision
  human_config?: HumanConfig;
  
  // Parallel step - run multiple steps concurrently
  parallel_steps?: WorkflowStep[];
  
  // Loop step - iterate over items
  loop_config?: LoopConfig;
  
  // Per-step guardrails
  guardrails?: WorkflowGuardrails;
  
  // Next step (for linear flows)
  next_step?: string;
}

// ============================================================================
// Workflow Definition
// ============================================================================

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  
  // How the workflow starts
  trigger: WorkflowTrigger;
  
  // The workflow steps
  steps: WorkflowStep[];
  
  // Global guardrails
  guardrails?: WorkflowGuardrails;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface WorkflowCreate {
  name: string;
  description?: string;
  active?: boolean;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  guardrails?: WorkflowGuardrails;
}

export interface WorkflowUpdate {
  name?: string;
  description?: string;
  active?: boolean;
  trigger?: WorkflowTrigger;
  steps?: WorkflowStep[];
  guardrails?: WorkflowGuardrails;
}

// ============================================================================
// Workflow Execution Types
// ============================================================================

export type ExecutionStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'awaiting_human'
  | 'cancelled';

export interface ExecutionUsage {
  requests: number;
  input_tokens: number;
  output_tokens: number;
  tool_calls: number;
  estimated_cost_dollars: number;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: ExecutionStatus;
  trigger_source: string;
  input_data: Record<string, any>;
  
  // Current state
  current_step_id?: string;
  step_outputs: Record<string, any>;  // Results from each step
  
  // Usage tracking
  usage: ExecutionUsage;
  
  // Timing
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  
  // Error info
  error?: string;
  failed_step_id?: string;
}

export interface StepExecution {
  id: string;
  execution_id: string;
  step_id: string;
  status: ExecutionStatus;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  usage?: ExecutionUsage;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  error?: string;
}

// ============================================================================
// Workflow Execution Request/Response
// ============================================================================

export interface ExecuteWorkflowRequest {
  input_data?: Record<string, any>;
  guardrails?: WorkflowGuardrails;  // Override workflow guardrails
}

export interface ExecuteWorkflowResponse {
  execution_id: string;
  status: ExecutionStatus;
  message?: string;
}

export interface HumanApprovalRequest {
  option_id: string;
  comment?: string;
}

export interface HumanApprovalResponse {
  success: boolean;
  execution_id: string;
  message?: string;
}

// ============================================================================
// Workflow List/Filter Types
// ============================================================================

export interface WorkflowListQuery {
  active?: boolean;
  trigger_type?: TriggerType;
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: 'name' | 'created_at' | 'updated_at';
  order_dir?: 'asc' | 'desc';
}

export interface WorkflowListResponse {
  workflows: Workflow[];
  total: number;
  limit: number;
  offset: number;
}

export interface ExecutionListQuery {
  workflow_id?: string;
  status?: ExecutionStatus;
  limit?: number;
  offset?: number;
  order_by?: 'started_at' | 'completed_at';
  order_dir?: 'asc' | 'desc';
}

export interface ExecutionListResponse {
  executions: WorkflowExecution[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  step_id?: string;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

// ============================================================================
// Helper Types for UI Components
// ============================================================================

export interface StepNodeData {
  step: WorkflowStep;
  execution?: StepExecution;
  validationErrors?: ValidationError[];
}

export interface WorkflowGraphNode {
  id: string;
  type: StepType;
  data: StepNodeData;
  position: { x: number; y: number };
}

export interface WorkflowGraphEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'conditional' | 'parallel';
  label?: string;
  animated?: boolean;
}

export interface WorkflowGraph {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
}