/**
 * Admin Client - Simplified wrapper around agent server-client (Next.js API routes)
 * 
 * This client provides a simplified interface for admin operations,
 * calling Next.js API routes which handle server-side authentication
 * and proxy requests to the Python agent-server.
 */

// Helper function to handle API responses
async function handleResponse(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || errorData.detail || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// ==========================================================================
// AGENTS API
// ==========================================================================

export async function listAgents() {
  const response = await fetch('/api/admin/resources/agents');
  return handleResponse(response);
}

export async function createAgent(agentData: {
  name: string;
  display_name?: string;
  description?: string;
  model: string;
  instructions: string;
  tools?: Record<string, any>;
  scopes?: string[];
}) {
  const response = await fetch('/api/admin/resources/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agentData),
  });
  return handleResponse(response);
}

export async function updateAgent(agentId: string, agentData: {
  name?: string;
  display_name?: string;
  description?: string;
  model?: string;
  instructions?: string;
  tools?: Record<string, any>;
  scopes?: string[];
}) {
  const response = await fetch(`/api/admin/resources/agents/${agentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agentData),
  });
  return handleResponse(response);
}

export async function deleteAgent(agentId: string) {
  const response = await fetch(`/api/admin/resources/agents/${agentId}`, {
    method: 'DELETE',
  });
  if (response.status === 204) {
    return { success: true };
  }
  return handleResponse(response);
}

// ==========================================================================
// WORKFLOWS API
// ==========================================================================

export async function listWorkflows() {
  const response = await fetch('/api/admin/resources/workflows');
  return handleResponse(response);
}

export async function createWorkflow(workflowData: {
  name: string;
  description?: string;
  steps: any[];
  scopes?: string[];
}) {
  const response = await fetch('/api/admin/resources/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflowData),
  });
  return handleResponse(response);
}

export async function getWorkflow(workflowId: string) {
  const response = await fetch(`/api/admin/resources/workflows/${workflowId}`);
  return handleResponse(response);
}

export async function updateWorkflow(workflowId: string, workflowData: {
  name?: string;
  description?: string;
  steps?: any[];
  scopes?: string[];
}) {
  const response = await fetch(`/api/admin/resources/workflows/${workflowId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflowData),
  });
  return handleResponse(response);
}

export async function deleteWorkflow(workflowId: string) {
  const response = await fetch(`/api/admin/resources/workflows/${workflowId}`, {
    method: 'DELETE',
  });
  if (response.status === 204) {
    return { success: true };
  }
  return handleResponse(response);
}

// ==========================================================================
// TOOLS API
// ==========================================================================

export async function listTools() {
  const response = await fetch('/api/admin/resources/tools');
  return handleResponse(response);
}

export async function createTool(toolData: {
  name: string;
  description?: string;
  schema: any;
  entrypoint: string;
  scopes?: string[];
}) {
  const response = await fetch('/api/admin/resources/tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toolData),
  });
  return handleResponse(response);
}

export async function getTool(toolId: string) {
  const response = await fetch(`/api/admin/resources/tools/${toolId}`);
  return handleResponse(response);
}

export async function updateTool(toolId: string, toolData: {
  name?: string;
  description?: string;
  schema?: any;
  entrypoint?: string;
  scopes?: string[];
}) {
  const response = await fetch(`/api/admin/resources/tools/${toolId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toolData),
  });
  return handleResponse(response);
}

export async function deleteTool(toolId: string) {
  const response = await fetch(`/api/admin/resources/tools/${toolId}`, {
    method: 'DELETE',
  });
  if (response.status === 204) {
    return { success: true };
  }
  return handleResponse(response);
}

// ==========================================================================
// SCORERS/EVALUATIONS API
// ==========================================================================

export async function listScorers() {
  const response = await fetch('/api/admin/resources/scorers');
  return handleResponse(response);
}

export async function createScorer(scorerData: {
  name: string;
  description?: string;
  config: any;
}) {
  const response = await fetch('/api/admin/resources/scorers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scorerData),
  });
  return handleResponse(response);
}

export async function getScorer(scorerId: string) {
  const response = await fetch(`/api/admin/resources/scorers/${scorerId}`);
  return handleResponse(response);
}

export async function updateScorer(scorerId: string, scorerData: {
  name?: string;
  description?: string;
  config?: any;
}) {
  const response = await fetch(`/api/admin/resources/scorers/${scorerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scorerData),
  });
  return handleResponse(response);
}

export async function deleteScorer(scorerId: string) {
  const response = await fetch(`/api/admin/resources/scorers/${scorerId}`, {
    method: 'DELETE',
  });
  if (response.status === 204) {
    return { success: true };
  }
  return handleResponse(response);
}

// ==========================================================================
// HELPER FUNCTIONS FOR COMPONENT COMPATIBILITY
// ==========================================================================

/**
 * Get available resources for agent configuration
 * These functions help maintain compatibility with existing components
 */

export async function getAvailableTools() {
  return listTools();
}

export async function getAvailableWorkflows() {
  return listWorkflows();
}

export async function getAvailableScorers() {
  return listScorers();
}

export async function getAvailableAgents() {
  return listAgents();
}

export async function getAvailableProcessors() {
  // Processors are not yet implemented - return empty array
  // TODO: Implement if agent-server adds processor support
  return [];
}

// ==========================================================================
// MODELS API
// ==========================================================================

export async function listModels() {
  const response = await fetch('/api/admin/models');
  return handleResponse(response);
}
