/**
 * SimpleChatInterface - Backward-compatible alias for ChatInterface.
 *
 * All new code should import ChatInterface directly. This wrapper exists
 * so existing consumers (recruiter, workforce, projects, agents, appbuilder,
 * documents widget) continue to work without changes.
 */
export type { ChatInterfaceProps as SimpleChatInterfaceProps } from './ChatInterface';
export { ChatInterface as SimpleChatInterface } from './ChatInterface';
