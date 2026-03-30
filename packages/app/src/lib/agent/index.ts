/**
 * Agent service client exports
 */

// Base client (single source of truth for agent-api connectivity)
export {
  getAgentApiUrl,
  buildAuthHeaders,
  getAgentApiToken,
  agentApiFetch,
  agentApiFetchJson,
} from './agent-api-base';

export type {
  AgentApiFetchOptions,
} from './agent-api-base';

// Server-side client factory (for Server Components)
export { createAgentClient } from './agent-service-client';
export type { 
  AgentClient,
  AgentClientConfig,
  AgentDefinition,
  AgentDefinitionInput,
  ToolDefinition,
  AgentSyncResult,
  AgentStatus,
  SyncStatus,
} from './agent-service-client';

// Standalone agent sync helpers (no client factory needed)
export { syncAgentDefinitions, getAgentSyncStatus } from './sync';

// Stream event processor (shared between ChatInterface and useChatStream)
export {
  createAccumulator,
  processStreamEvent,
} from './stream-event-processor';

export type {
  StreamAccumulator,
  StreamEventResult,
} from './stream-event-processor';

// Enhanced chat client (browser-side)
export {
  sendChatMessage,
  streamChatMessage,
  getAvailableModels,
  getConversationHistory,
  generateInsights,
  getConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  searchInsights,
  insertInsights,
  deleteConversationInsights,
  getInsightStats,
  initializeInsights,
} from './chat-client';

export type {
  ChatClientOptions,
} from './chat-client';
