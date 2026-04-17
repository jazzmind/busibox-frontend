/**
 * Shared TypeScript types for the Graph DB admin UI.
 *
 * These mirror the responses from `/data/graph/admin/*` endpoints. Kept in
 * one file so components can share without copy/paste drift.
 */

export interface GraphConnection {
  available: boolean;
  uri: string | null;
  user: string | null;
  password_set: boolean;
  password_fingerprint?: string | null;
  driver_installed: boolean;
  driver_version?: string;
  neo4j_version?: string | null;
  neo4j_edition?: string | null;
  apoc_available?: boolean | null;
  indexes?: GraphIndex[];
  connected_at?: string | null;
  last_connect_at?: string | null;
  last_connect_error?: string | null;
}

export interface GraphIndex {
  name?: string;
  state?: string;
  type?: string;
  labelsOrTypes?: string[] | null;
  properties?: string[] | null;
}

export interface GraphLabelCount {
  label: string;
  count: number;
}

export interface GraphRelTypeCount {
  type: string;
  count: number;
}

export interface GraphOrphans {
  no_node_id: number;
  no_relationships: number;
  dangling_rels: number;
  error?: string;
}

export interface GraphStats {
  available: boolean;
  labels: GraphLabelCount[];
  relationship_types: GraphRelTypeCount[];
  orphans: GraphOrphans;
  total_nodes: number;
  total_relationships: number;
}

export interface ReachabilityStep {
  step: string;
  ok: boolean;
  message: string;
  duration_ms: number;
  fix_hint?: string;
}

export interface ReachabilityResult {
  ok: boolean;
  steps: ReachabilityStep[];
  node_count?: number;
}

export interface GraphErrorEntry {
  timestamp: string;
  level: string;
  method: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface GraphBrowseResponse {
  nodes: Array<Record<string, unknown> & { _labels?: string[] }>;
  total: number;
  limit: number;
  offset: number;
  label?: string | null;
  error?: string;
}

export interface CypherColumn {
  name: string;
}

export interface CypherResponse {
  ok: boolean;
  error?: string;
  columns: string[];
  rows: unknown[][];
  summary?: {
    result_available_after_ms?: number;
    result_consumed_after_ms?: number;
    counters?: Record<string, number | boolean>;
    notifications?: Array<{
      code?: string;
      title?: string;
      description?: string;
      severity?: string;
    }>;
    query_type?: string;
  };
  duration_ms?: number;
}

export interface PermissionsBreakdown {
  total_nodes: number;
  visible_to_user: number;
  user_id?: string | null;
  per_label: Array<{ label: string; total: number; visible: number }>;
  error?: string;
}

export interface ReconnectResult {
  available: boolean;
  uri: string | null;
  user: string | null;
  last_connect_error: string | null;
  connected_at: string | null;
}

export interface RebuildIndexesResult {
  created: string[];
  existing?: GraphIndex[];
  errors: string[];
}

export interface PurgeOrphansResult {
  dry_run: boolean;
  preview: GraphOrphans;
  deleted: Partial<GraphOrphans>;
  error?: string;
}
