// ==========================================================================
// API Types
// ==========================================================================

export interface ApiError {
  error: string;
  message?: string;
  details?: string;
  code?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  status: number;
}

// ==========================================================================
// Builder Types
// ==========================================================================

export type BuilderProjectStatus =
  | "provisioning"
  | "ready"
  | "running"
  | "failed"
  | "deploying"
  | "deployed"
  | "stopped";

export type BuilderAgentMode = "auto" | "builder" | "builder-local";
export type BuilderTemplateVariant = "minimal" | "standard" | "chat-app" | "api-only";

export interface BuilderProject {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: BuilderProjectStatus;
  routePath: string;
  devPort: number;
  repoUrl?: string | null;
  lastError?: string | null;
  agentMode: BuilderAgentMode;
  templateVariant: BuilderTemplateVariant;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBuilderProjectInput {
  name: string;
  description?: string;
  routePath?: string;
  agentMode?: BuilderAgentMode;
  templateVariant?: BuilderTemplateVariant;
}

export interface BuilderProjectFile {
  path: string;
  size?: number;
  modifiedAt?: string;
}

export interface BuilderProjectLogEvent {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

// Demo note types (for demo/notes API - delete when building real app)
export interface DemoNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  title: string;
  content: string;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
}
