/**
 * App utility functions
 */

import { APP_LIBRARY } from './app-library';

// Built-in apps that cannot connect to GitHub or be modified in certain ways
export const BUILT_IN_APPS = ['Video Generator', 'AI Chat', 'Document Manager'];

/**
 * Check if an app is a built-in app (Video Generator, AI Chat, Document Manager)
 */
export function isBuiltInApp(appName: string): boolean {
  return BUILT_IN_APPS.includes(appName);
}

/**
 * Check if an app is a library app
 */
export function isLibraryApp(appName: string): boolean {
  return APP_LIBRARY.some(app => app.name === appName);
}

/**
 * Check if an app can connect to GitHub
 * Built-in apps cannot connect to GitHub
 */
export function canConnectToGitHub(appName: string): boolean {
  return !isBuiltInApp(appName);
}

/**
 * Get display label for app type
 */
export function getAppTypeLabel(type: 'BUILT_IN' | 'LIBRARY' | 'EXTERNAL'): string {
  if (type === 'BUILT_IN') return 'Built-in';
  if (type === 'LIBRARY') return 'Library';
  return 'External';
}

