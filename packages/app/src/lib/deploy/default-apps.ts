/**
 * Seeded app defaults used when App table is unavailable.
 *
 * This mirrors the bootstrap entries from prisma/seed.ts so admin routes can
 * still operate in environments where Prisma app tables are intentionally absent.
 */

export type SeededAppType = 'BUILT_IN' | 'LIBRARY' | 'EXTERNAL';

export type SeededAppRecord = {
  id: string;
  name: string;
  description: string | null;
  type: SeededAppType;
  url: string | null;
  deployedPath: string | null;
  iconUrl: string | null;
  selectedIcon: string | null;
  displayOrder: number;
  isActive: boolean;
  healthEndpoint: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastDeploymentStatus: string | null;
  lastDeploymentEndedAt: Date | null;
  deployedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  devMode: boolean;
};

const SEEDED_TIMESTAMP = new Date('2026-01-01T00:00:00.000Z');

const SEEDED_APPS: SeededAppRecord[] = [
  {
    id: 'busibox-agents',
    name: 'Agent Manager',
    description: 'AI agent interaction and management interface',
    type: 'BUILT_IN',
    url: '/agents',
    deployedPath: null,
    iconUrl: null,
    selectedIcon: 'cpu',
    displayOrder: 1,
    isActive: true,
    healthEndpoint: '/api/health',
    createdAt: SEEDED_TIMESTAMP,
    updatedAt: SEEDED_TIMESTAMP,
    lastDeploymentStatus: null,
    lastDeploymentEndedAt: null,
    deployedVersion: null,
    latestVersion: null,
    updateAvailable: false,
    devMode: false,
  },
  {
    id: 'busibox-appbuilder',
    name: 'App Builder',
    description: 'Lovable-style AI app builder with live preview and deployment workflows',
    type: 'BUILT_IN',
    url: '/builder',
    deployedPath: null,
    iconUrl: null,
    selectedIcon: 'mobile',
    displayOrder: 2,
    isActive: true,
    healthEndpoint: '/api/health',
    createdAt: SEEDED_TIMESTAMP,
    updatedAt: SEEDED_TIMESTAMP,
    lastDeploymentStatus: null,
    lastDeploymentEndedAt: null,
    deployedVersion: null,
    latestVersion: null,
    updateAvailable: false,
    devMode: false,
  },
  {
    id: 'busibox-media',
    name: 'Media Generator',
    description: 'AI-powered media content generation and library',
    type: 'BUILT_IN',
    url: '/media',
    deployedPath: null,
    iconUrl: null,
    selectedIcon: 'video',
    displayOrder: 4,
    isActive: true,
    healthEndpoint: null,
    createdAt: SEEDED_TIMESTAMP,
    updatedAt: SEEDED_TIMESTAMP,
    lastDeploymentStatus: null,
    lastDeploymentEndedAt: null,
    deployedVersion: null,
    latestVersion: null,
    updateAvailable: false,
    devMode: false,
  },
  {
    id: 'busibox-chat',
    name: 'Chat',
    description: 'Chat with AI models via liteLLM',
    type: 'BUILT_IN',
    url: '/chat',
    deployedPath: null,
    iconUrl: null,
    selectedIcon: 'chat',
    displayOrder: 5,
    isActive: true,
    healthEndpoint: null,
    createdAt: SEEDED_TIMESTAMP,
    updatedAt: SEEDED_TIMESTAMP,
    lastDeploymentStatus: null,
    lastDeploymentEndedAt: null,
    deployedVersion: null,
    latestVersion: null,
    updateAvailable: false,
    devMode: false,
  },
  {
    id: 'busibox-documents',
    name: 'Document Manager',
    description: 'Upload, process, and search documents with AI',
    type: 'BUILT_IN',
    url: '/documents',
    deployedPath: null,
    iconUrl: null,
    selectedIcon: 'documents',
    displayOrder: 6,
    isActive: true,
    healthEndpoint: null,
    createdAt: SEEDED_TIMESTAMP,
    updatedAt: SEEDED_TIMESTAMP,
    lastDeploymentStatus: null,
    lastDeploymentEndedAt: null,
    deployedVersion: null,
    latestVersion: null,
    updateAvailable: false,
    devMode: false,
  },
  {
    id: 'busibox-admin',
    name: 'Admin',
    description: 'Admin dashboard for managing Busibox',
    type: 'BUILT_IN',
    url: '/admin',
    deployedPath: null,
    iconUrl: null,
    selectedIcon: 'settings',
    displayOrder: 7,
    isActive: true,
    healthEndpoint: '/api/health',
    createdAt: SEEDED_TIMESTAMP,
    updatedAt: SEEDED_TIMESTAMP,
    lastDeploymentStatus: null,
    lastDeploymentEndedAt: null,
    deployedVersion: null,
    latestVersion: null,
    updateAvailable: false,
    devMode: false,
  },
];

export function getSeededApps(): SeededAppRecord[] {
  return SEEDED_APPS.map((app) => ({ ...app }));
}

export function getSeededAppIds(): string[] {
  return SEEDED_APPS.map((app) => app.id);
}

