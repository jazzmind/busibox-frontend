/**
 * Busibox App Manifest Schema
 * 
 * TypeScript types and Zod validation for busibox.json manifest files.
 */

import { z } from 'zod';

// Zod schema for validation
export const BusiboxManifestSchema = z.object({
  $schema: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  id: z.string()
    .min(1, 'ID is required')
    .regex(/^[a-z0-9-]+$/, 'ID must contain only lowercase letters, numbers, and hyphens'),
  version: z.string()
    .regex(/^\d+\.\d+\.\d+/, 'Version must be in semver format (e.g., 1.0.0)'),
  description: z.string().min(1, 'Description is required'),
  icon: z.string().min(1, 'Icon is required'),
  defaultPath: z.string()
    .regex(/^\/[a-z0-9-_]+$/, 'Path must start with / and contain only lowercase letters, numbers, hyphens, and underscores'),
  defaultPort: z.number()
    .int()
    .min(1000, 'Port must be at least 1000')
    .max(65535, 'Port must be at most 65535'),
  healthEndpoint: z.string()
    .startsWith('/', 'Health endpoint must start with /'),
  buildCommand: z.string().min(1, 'Build command is required'),
  startCommand: z.string().min(1, 'Start command is required'),
  appMode: z.enum(['frontend', 'prisma']).refine(
    (val) => val === 'frontend' || val === 'prisma',
    { message: 'App mode must be either "frontend" or "prisma"' }
  ),
  database: z.object({
    required: z.boolean(),
    preferredName: z.string()
      .regex(/^[a-z0-9_]+$/, 'Database name must contain only lowercase letters, numbers, and underscores'),
    schemaManagement: z.enum(['prisma', 'migrations', 'manual']),
    seedCommand: z.string().optional(),
  }).optional(),
  requiredEnvVars: z.array(z.string()),
  optionalEnvVars: z.array(z.string()).optional(),
  busiboxAppVersion: z.string().optional(),
});

// TypeScript type inferred from schema
export type BusiboxManifest = z.infer<typeof BusiboxManifestSchema>;

// Validation result type
export interface ManifestValidationResult {
  success: boolean;
  manifest?: BusiboxManifest;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Validate a manifest object against the schema
 */
export function validateManifest(data: unknown): ManifestValidationResult {
  const result = BusiboxManifestSchema.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      manifest: result.data,
    };
  }
  
  return {
    success: false,
    errors: result.error.issues.map(err => ({
      path: err.path.join('.'),
      message: err.message,
    })),
  };
}

/**
 * Check if a manifest requires database provisioning
 */
export function requiresDatabase(manifest: BusiboxManifest): boolean {
  return manifest.database?.required === true;
}

/**
 * Get database configuration from manifest
 */
export function getDatabaseConfig(manifest: BusiboxManifest) {
  if (!manifest.database?.required) {
    return null;
  }
  
  return {
    name: manifest.database.preferredName,
    schemaManagement: manifest.database.schemaManagement,
    seedCommand: manifest.database.seedCommand,
  };
}

/**
 * Get all environment variables (required + optional)
 */
export function getAllEnvVars(manifest: BusiboxManifest): string[] {
  const required = manifest.requiredEnvVars || [];
  const optional = manifest.optionalEnvVars || [];
  return [...required, ...optional];
}
