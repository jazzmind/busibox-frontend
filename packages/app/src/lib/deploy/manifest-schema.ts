/**
 * Busibox App Manifest Schema
 * 
 * TypeScript types and Zod validation for busibox.json manifest files.
 */

import { z } from 'zod';

// Sub-schemas for custom service mode
export const ServiceEndpointSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  port: z.number().int().min(1).max(65535),
  path: z.string().regex(/^\/[a-z0-9-_/]+$/, 'Path must start with / and contain only lowercase letters, numbers, hyphens, underscores, and slashes'),
  stripPath: z.boolean().default(true),
  healthEndpoint: z.string().default('/health'),
});

export const RuntimeConfigSchema = z.object({
  type: z.enum(['docker-compose', 'lxc']).default('docker-compose'),
  composeFile: z.string().default('docker-compose.yml'),
  buildContext: z.string().default('.'),
});

export const AuthConfigSchema = z.object({
  audience: z.string().regex(/^[a-z0-9-]+$/, 'Audience must contain only lowercase letters, numbers, and hyphens'),
  scopes: z.array(z.string()).default([]),
});

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
  // Required for frontend/prisma, optional for custom (services[] defines ports)
  defaultPort: z.number().int().min(1000).max(65535).optional(),
  healthEndpoint: z.string().startsWith('/').optional(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  appMode: z.enum(['frontend', 'prisma', 'custom']),
  database: z.object({
    required: z.boolean(),
    preferredName: z.string()
      .regex(/^[a-z0-9_]+$/, 'Database name must contain only lowercase letters, numbers, and underscores'),
    schemaManagement: z.enum(['prisma', 'migrations', 'manual']),
    seedCommand: z.string().optional(),
  }).optional(),
  requiredEnvVars: z.array(z.string()).default([]),
  optionalEnvVars: z.array(z.string()).optional(),
  busiboxAppVersion: z.string().optional(),
  // Custom service fields (required when appMode == "custom")
  runtime: RuntimeConfigSchema.optional(),
  services: z.array(ServiceEndpointSchema).optional(),
  auth: AuthConfigSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.appMode === 'custom') {
    if (!data.services || data.services.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Custom services must define at least one service endpoint',
        path: ['services'],
      });
    }
    if (!data.auth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Custom services must define auth configuration',
        path: ['auth'],
      });
    }
  } else {
    if (data.defaultPort === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'defaultPort is required for frontend/prisma apps',
        path: ['defaultPort'],
      });
    }
    if (!data.healthEndpoint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'healthEndpoint is required for frontend/prisma apps',
        path: ['healthEndpoint'],
      });
    }
    if (!data.buildCommand) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'buildCommand is required for frontend/prisma apps',
        path: ['buildCommand'],
      });
    }
    if (!data.startCommand) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startCommand is required for frontend/prisma apps',
        path: ['startCommand'],
      });
    }
  }
});

// TypeScript types inferred from schemas
export type BusiboxManifest = z.infer<typeof BusiboxManifestSchema>;
export type ServiceEndpoint = z.infer<typeof ServiceEndpointSchema>;
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;

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

/**
 * Check if a manifest is a custom service
 */
export function isCustomService(manifest: BusiboxManifest): boolean {
  return manifest.appMode === 'custom';
}
