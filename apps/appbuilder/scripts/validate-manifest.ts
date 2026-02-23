#!/usr/bin/env npx ts-node
/**
 * Busibox Manifest Validator
 * 
 * Validates busibox.json manifest file for CI/CD pipelines.
 * Run with: npx ts-node scripts/validate-manifest.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Manifest schema definition
interface BusiboxManifest {
  $schema?: string;
  name: string;
  id: string;
  version: string;
  description: string;
  icon: string;
  defaultPath: string;
  defaultPort: number;
  healthEndpoint: string;
  buildCommand: string;
  startCommand: string;
  appMode: 'frontend';
  requiredEnvVars: string[];
  optionalEnvVars?: string[];
  busiboxAppVersion?: string;
}

// Valid icon names (subset of lucide-react icons commonly used)
const VALID_ICONS = [
  'Boxes', 'Calculator', 'Chart', 'Document', 'Bot', 'Building',
  'BarChart', 'Lightbulb', 'FileText', 'Settings', 'Users', 'Database',
  'Code', 'Terminal', 'Folder', 'Search', 'Globe', 'Lock', 'Key',
  'Mail', 'Bell', 'Calendar', 'Clock', 'Image', 'Video', 'Music',
  'Upload', 'Download', 'Share', 'Link', 'ExternalLink', 'Home',
  'Activity', 'AlertCircle', 'Archive', 'Bookmark', 'Camera', 'Check',
  'ChevronDown', 'ChevronRight', 'Clipboard', 'Cloud', 'Coffee',
  'Command', 'Compass', 'Copy', 'CreditCard', 'Crosshair', 'Edit',
  'Eye', 'File', 'Filter', 'Flag', 'Gift', 'Grid', 'Hash', 'Heart',
  'HelpCircle', 'Inbox', 'Info', 'Layers', 'Layout', 'List', 'Map',
  'Menu', 'MessageCircle', 'MessageSquare', 'Mic', 'Monitor', 'Moon',
  'MoreHorizontal', 'MoreVertical', 'Move', 'Package', 'Paperclip',
  'Pause', 'Percent', 'Phone', 'PieChart', 'Play', 'Plus', 'Power',
  'Printer', 'Radio', 'RefreshCw', 'Repeat', 'RotateCcw', 'Save',
  'Scissors', 'Server', 'Shield', 'ShoppingBag', 'ShoppingCart',
  'Shuffle', 'Sidebar', 'Slash', 'Sliders', 'Smartphone', 'Speaker',
  'Square', 'Star', 'Sun', 'Tablet', 'Tag', 'Target', 'ThumbsDown',
  'ThumbsUp', 'Tool', 'Trash', 'TrendingDown', 'TrendingUp', 'Truck',
  'Tv', 'Type', 'Umbrella', 'Underline', 'Unlock', 'User', 'UserCheck',
  'UserMinus', 'UserPlus', 'UserX', 'Volume', 'Watch', 'Wifi', 'Wind',
  'X', 'Zap', 'ZoomIn', 'ZoomOut'
];

interface ValidationError {
  field: string;
  message: string;
}

function validateManifest(manifest: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!manifest || typeof manifest !== 'object') {
    errors.push({ field: 'root', message: 'Manifest must be a valid JSON object' });
    return errors;
  }
  
  const m = manifest as Record<string, unknown>;
  
  // Required string fields
  const requiredStrings = ['name', 'id', 'version', 'description', 'icon', 'defaultPath', 'healthEndpoint', 'buildCommand', 'startCommand', 'appMode'];
  for (const field of requiredStrings) {
    if (typeof m[field] !== 'string' || m[field] === '') {
      errors.push({ field, message: `${field} is required and must be a non-empty string` });
    }
  }
  
  // Validate id format (lowercase, alphanumeric with hyphens)
  if (typeof m.id === 'string' && !/^[a-z0-9-]+$/.test(m.id)) {
    errors.push({ field: 'id', message: 'id must contain only lowercase letters, numbers, and hyphens' });
  }
  
  // Validate version format (semver-like)
  if (typeof m.version === 'string' && !/^\d+\.\d+\.\d+/.test(m.version)) {
    errors.push({ field: 'version', message: 'version must be in semver format (e.g., 1.0.0)' });
  }
  
  // Validate defaultPath format
  if (typeof m.defaultPath === 'string' && !/^\/[a-z0-9-_]+$/.test(m.defaultPath)) {
    errors.push({ field: 'defaultPath', message: 'defaultPath must start with / and contain only lowercase letters, numbers, hyphens, and underscores' });
  }
  
  // Validate healthEndpoint format
  if (typeof m.healthEndpoint === 'string' && !m.healthEndpoint.startsWith('/')) {
    errors.push({ field: 'healthEndpoint', message: 'healthEndpoint must start with /' });
  }
  
  // Validate icon
  if (typeof m.icon === 'string' && !VALID_ICONS.includes(m.icon)) {
    errors.push({ field: 'icon', message: `icon must be one of: ${VALID_ICONS.slice(0, 10).join(', ')}... (see lucide-react icons)` });
  }
  
  // Validate appMode
  if (typeof m.appMode === 'string' && m.appMode !== 'frontend') {
    errors.push({ field: 'appMode', message: 'appMode must be "frontend"' });
  }
  
  // Validate defaultPort
  if (typeof m.defaultPort !== 'number' || m.defaultPort < 1000 || m.defaultPort > 65535) {
    errors.push({ field: 'defaultPort', message: 'defaultPort must be a number between 1000 and 65535' });
  }
  
  // Validate requiredEnvVars
  if (!Array.isArray(m.requiredEnvVars)) {
    errors.push({ field: 'requiredEnvVars', message: 'requiredEnvVars must be an array' });
  } else {
    for (let i = 0; i < m.requiredEnvVars.length; i++) {
      if (typeof m.requiredEnvVars[i] !== 'string') {
        errors.push({ field: `requiredEnvVars[${i}]`, message: 'Each required env var must be a string' });
      }
    }
  }
  
  // Validate optionalEnvVars if present
  if (m.optionalEnvVars !== undefined) {
    if (!Array.isArray(m.optionalEnvVars)) {
      errors.push({ field: 'optionalEnvVars', message: 'optionalEnvVars must be an array' });
    } else {
      for (let i = 0; i < m.optionalEnvVars.length; i++) {
        if (typeof m.optionalEnvVars[i] !== 'string') {
          errors.push({ field: `optionalEnvVars[${i}]`, message: 'Each optional env var must be a string' });
        }
      }
    }
  }
  
  return errors;
}

function main() {
  const manifestPath = join(process.cwd(), 'busibox.json');
  
  console.log('Busibox Manifest Validator');
  console.log('==========================');
  console.log(`Checking: ${manifestPath}\n`);
  
  if (!existsSync(manifestPath)) {
    console.error('ERROR: busibox.json not found in project root');
    console.error('Create a busibox.json file to make this app installable via Busibox Portal.');
    process.exit(1);
  }
  
  let manifest: unknown;
  try {
    const content = readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(content);
  } catch (err) {
    console.error('ERROR: Failed to parse busibox.json');
    console.error(err instanceof Error ? err.message : 'Unknown error');
    process.exit(1);
  }
  
  const errors = validateManifest(manifest);
  
  if (errors.length > 0) {
    console.error('Validation FAILED with the following errors:\n');
    for (const error of errors) {
      console.error(`  - ${error.field}: ${error.message}`);
    }
    console.error(`\nTotal errors: ${errors.length}`);
    process.exit(1);
  }
  
  console.log('Validation PASSED');
  console.log('\nManifest summary:');
  const m = manifest as BusiboxManifest;
  console.log(`  Name: ${m.name}`);
  console.log(`  ID: ${m.id}`);
  console.log(`  Version: ${m.version}`);
  console.log(`  App Mode: ${m.appMode}`);
  console.log(`  Default Path: ${m.defaultPath}`);
  console.log(`  Default Port: ${m.defaultPort}`);
  console.log(`  Storage: data-api`);
  console.log(`  Required Env Vars: ${m.requiredEnvVars.length > 0 ? m.requiredEnvVars.join(', ') : 'None'}`);
  
  process.exit(0);
}

main();
