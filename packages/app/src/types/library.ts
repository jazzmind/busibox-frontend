/**
 * Library-related payload types (no Prisma types).
 * These mirror the shapes returned by Busibox Portal API routes.
 */

export type RoleSummary = {
  id: string;
  name: string;
  description?: string | null;
};

export type LibrarySidebarItem = {
  id: string;
  name: string;
  isPersonal: boolean;
  documentCount: number;
  libraryType?: string | null;
  role?: Pick<RoleSummary, 'id' | 'name'> | null;
  roles?: Array<Pick<RoleSummary, 'id' | 'name'>>;
};

/**
 * App Data Library types for structured app data in document manager.
 * App data libraries are data documents with sourceApp metadata.
 */
export type AppDataLibraryItem = {
  id: string;
  documentId: string;
  name: string;
  sourceApp: string;
  displayName: string;
  itemLabel: string;
  recordCount: number;
  visibility: 'personal' | 'shared';
  schema?: AppDataSchema | null;
  allowSharing: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

/**
 * Relation types for linking data documents.
 * - 'hasMany': This document's records have children in another document (e.g., Project hasMany Tasks)
 * - 'belongsTo': This document's records belong to a parent in another document (e.g., Task belongsTo Project)
 */
export type AppDataRelationType = 'hasMany' | 'belongsTo';

/**
 * Defines a relationship between data documents.
 * Used by busibox-portal to render navigation links between related records.
 */
export type AppDataRelation = {
  /** The type of relationship */
  type: AppDataRelationType;
  /** Target document name (e.g., 'busibox-projects-tasks') */
  document: string;
  /** Field name linking records (e.g., 'projectId') */
  foreignKey: string;
  /** Field to display in links (e.g., 'title' or 'name'). Defaults to 'name' or 'title'. */
  displayField?: string;
  /** UI label for the relation (e.g., 'Tasks', 'Project') */
  label?: string;
};

import type { GraphRelationshipDef } from './data-documents';

export type { GraphRelationshipDef } from './data-documents';

export type AppDataSchema = {
  fields: Record<string, AppDataFieldDef>;
  displayName?: string;
  itemLabel?: string;
  sourceApp?: string;
  visibility?: 'personal' | 'shared' | 'authenticated';
  allowSharing?: boolean;
  /** Relationships to other data documents */
  relations?: Record<string, AppDataRelation>;
  /** Neo4j node label for graph sync (e.g., 'Task'). If set, records are auto-synced to graph DB. */
  graphNode?: string;
  /** Graph relationship definitions for edges between record nodes */
  graphRelationships?: GraphRelationshipDef[];
};

export type AppDataFieldDef = {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object' | 'enum' | 'datetime';
  required?: boolean;
  values?: string[];
  min?: number;
  max?: number;
  label?: string;
  hidden?: boolean;
  multiline?: boolean;
  widget?: 'text' | 'textarea' | 'select' | 'slider' | 'number' | 'date' | 'checkbox' | 'tags';
  readonly?: boolean;
  order?: number;
  placeholder?: string;
};

export type AppDataGroup = {
  sourceApp: string;
  documents: AppDataLibraryItem[];
  totalRecords: number;
};








