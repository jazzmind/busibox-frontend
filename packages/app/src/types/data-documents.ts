/**
 * Data document API types for the Busibox data-api service.
 * Used by apps that store structured data in data documents.
 */

/**
 * Defines how records map to graph relationships in Neo4j.
 * When graphNode is set on a schema, records are synced to the graph.
 * graphRelationships define edges between record nodes.
 */
export type GraphRelationshipDef = {
  /** Label for source node (e.g., 'Task') */
  source_label: string;
  /** Record field containing target node ID (e.g., 'projectId') */
  target_field: string;
  /** Label for target node (e.g., 'Project') */
  target_label: string;
  /** Relationship type (e.g., 'BELONGS_TO') */
  relationship: string;
};

/**
 * Filter for a single field.
 */
export type QueryFilter = {
  field: string;
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startswith' | 'endswith';
  value: unknown;
};

/**
 * Compound filter (and/or of filters).
 */
export type QueryCondition = {
  and?: (QueryFilter | QueryCondition)[];
  or?: (QueryFilter | QueryCondition)[];
};

/**
 * Options for querying records.
 */
export type QueryOptions = {
  select?: string[];
  where?: QueryFilter | QueryCondition;
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
};

/**
 * Minimal document info from list endpoint.
 */
export type DocumentInfo = {
  id: string;
  name: string;
  recordCount: number;
};

/**
 * Full data document with schema and metadata.
 */
export type DataDocument = {
  id: string;
  name: string;
  schema?: Record<string, unknown>;
  recordCount: number;
  visibility: 'personal' | 'shared';
  metadata?: Record<string, unknown>;
  sourceApp?: string;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Config for a single document in ensureDocuments().
 */
export type DataDocumentConfig = {
  name: string;
  schema: Record<string, unknown>;
  visibility?: 'personal' | 'shared' | 'authenticated';
};
