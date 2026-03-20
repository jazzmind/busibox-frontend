export type ChatModelOption = {
  id: string;
  name: string;
  description?: string;
  supports_vision?: boolean;
  supports_tools?: boolean;
  supports_reasoning?: boolean;
  max_tokens?: number;
  cost_tier?: string;
  speed_tier?: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

// New types for enhanced chat architecture

export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  source?: string; // App/client that created the conversation (e.g., 'busibox-portal', 'busibox-agents')
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
  messageCount: number;
  model?: string;
  metadata?: Record<string, any>;
}

export interface ThoughtEvent {
  type: string;
  source?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp?: Date;
}

export interface MessageAttachment {
  id: string;
  filename: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes?: number;
  addedToLibrary?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  agentName?: string;
  thoughts?: ThoughtEvent[];
  parts?: MessagePart[];
  routingDecision?: RoutingDecision;
  toolCalls?: ToolCall[];
  runId?: string;
  attachments?: MessageAttachment[];
  createdAt: Date;
}

export interface RoutingDecision {
  selectedModel: string;
  selectedTools: string[];
  selectedAgents: string[];
  reasoning: string;
  confidence: number;
}

export interface ToolCall {
  tool_name: string;
  success: boolean;
  output?: string;
  error?: string;
}

export interface Attachment {
  name: string;
  type: string;
  url: string;
  size: number;
  knowledge_base_id?: string;
}

export interface ChatMessageRequest {
  message: string;
  conversation_id?: string;
  model?: string; // 'auto', 'chat', 'research', 'frontier'
  attachments?: Attachment[];
  attachment_ids?: string[];
  enable_web_search?: boolean;
  enable_doc_search?: boolean;
  temperature?: number;
  max_tokens?: number;
  // Enhanced options
  selected_tools?: string[]; // Tool IDs to use
  selected_agents?: string[]; // Agent IDs to use
  selected_libraries?: string[]; // Library IDs for document search
  /** Application context metadata passed to agent tools (e.g. { projectId: "abc", appName: "busibox-projects" }) */
  metadata?: Record<string, any>;
}

export interface ChatMessageResponse {
  message_id: string;
  conversation_id: string;
  content: string;
  model: string;
  routing_decision?: RoutingDecision;
  tool_calls?: ToolCall[];
  run_id?: string;
}

export interface ModelCapabilities {
  id: string;
  name: string;
  description: string;
  supports_vision: boolean;
  supports_tools: boolean;
  supports_reasoning: boolean;
  max_tokens: number;
  cost_tier: string;
  speed_tier: string;
}

export interface ChatInsight {
  id?: string;
  content: string;
  category: 'preference' | 'fact' | 'goal' | 'context' | 'other';
  importance: number; // 0-1
  source: 'conversation' | 'explicit' | 'inferred';
  conversationId?: string;
  createdAt?: Date;
  metadata?: Record<string, any>;
}

export interface InsightSearchResult {
  insight: ChatInsight;
  score: number;
  distance: number;
}

// --- Message Parts Architecture ---

export type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'thinking'; events: ThoughtEvent[]; summary?: string }
  | {
      type: 'tool_call';
      id: string;
      name: string;
      displayName?: string;
      status: 'pending' | 'running' | 'completed' | 'error';
      input?: Record<string, unknown>;
      output?: string;
      error?: string;
      startedAt?: Date;
      completedAt?: Date;
    }
  | { type: 'prompt'; options: string[]; promptType: 'confirm' | 'choice' | 'open' };








