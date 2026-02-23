/**
 * App Library Configuration
 * 
 * Defines apps available in the library for deployment alongside the Busibox Portal.
 * These apps are hosted in the same container, served via nginx proxy on subdirectories.
 */

export interface LibraryApp {
  id: string;
  name: string;
  description: string;
  defaultPath: string;  // Default subdirectory path (e.g., "/dataviz")
  defaultPort: number;  // Default port for the app
  githubRepo: string;   // GitHub repository (owner/repo)
  githubBranch: string; // Default branch
  icon: string;         // Icon name from icon library
  healthEndpoint: string; // Health check endpoint
  buildCommand: string;
  startCommand: string;
  requiredEnvVars?: string[]; // List of required environment variables
}

interface RemoteLibraryManifest {
  name?: string;
  description?: string;
  repo?: string | null;
  icon?: string;
  defaultPath?: string;
  defaultPort?: number;
  healthEndpoint?: string;
  buildCommand?: string;
  startCommand?: string;
  requiredEnvVars?: string[];
}

export const APP_LIBRARY: LibraryApp[] = [
  {
    id: 'doc-intel',
    name: 'Doc Intel',
    description: 'Document intelligence and analysis platform with AI-powered insights',
    defaultPath: '/docs',
    defaultPort: 3002,
    githubRepo: 'jazzmind/docintel',
    githubBranch: 'main',
    icon: 'Document',
    healthEndpoint: '/api/health',
    buildCommand: 'npm run build',
    startCommand: 'npm start',
    requiredEnvVars: ['DATABASE_URL', 'OPENAI_API_KEY', 'DATA_CONTAINER_IP', 'DATA_SERVICE_PORT'],
  },
  {
    id: 'data-visualizer',
    name: 'Data Visualizer',
    description: 'Use chat to quickly explore and visualize data sets. Export data from excel and upload to create charts and graphs',
    defaultPath: '/dataviz',
    defaultPort: 3003,
    githubRepo: 'jazzmind/tabular-bells',
    githubBranch: 'main',
    icon: 'Chart',
    healthEndpoint: '/api/health',
    buildCommand: 'npm run build',
    startCommand: 'npm start',
    requiredEnvVars: ['LITELLM_API_KEY', 'DATABASE_URL'],
  },

  {
    id: 'innovation',
    name: 'Innovation Manager',
    description: 'Track and manage innovation projects and ideas',
    defaultPath: '/innovation',
    defaultPort: 3005,
    githubRepo: 'jazzmind/innovation',
    githubBranch: 'main',
    icon: 'Lightbulb',
    healthEndpoint: '/api/health',
    buildCommand: 'npm run build',
    startCommand: 'npm start',
    requiredEnvVars: ['DATABASE_URL', 'LITELLM_API_KEY'],
  },
 
 
];

export async function fetchLibraryApps(): Promise<LibraryApp[]> {
  const owner = process.env.BUILDER_LIBRARY_OWNER || 'jazzmind';
  const repo = process.env.BUILDER_LIBRARY_REPO || 'busibox-app-library';
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
    {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 3600 },
    }
  );

  if (!treeRes.ok) {
    throw new Error(`Failed to fetch remote library tree: ${await treeRes.text()}`);
  }

  const treeJson = (await treeRes.json()) as {
    tree: Array<{ path: string; type: string; url: string }>;
  };

  const manifests = treeJson.tree.filter(
    (entry) =>
      entry.type === 'blob' &&
      entry.path.startsWith('apps/') &&
      entry.path.endsWith('/manifest.json')
  );

  const apps = await Promise.all(
    manifests.map(async (entry): Promise<LibraryApp | null> => {
      const slug = entry.path.split('/')[1];
      const manifestRes = await fetch(entry.url, {
        headers: { Accept: 'application/vnd.github.raw+json' },
        next: { revalidate: 3600 },
      });
      if (!manifestRes.ok) return null;
      const manifest = (await manifestRes.json()) as RemoteLibraryManifest;

      return {
        id: slug,
        name: manifest.name || slug,
        description: manifest.description || '',
        defaultPath: manifest.defaultPath || `/${slug}`,
        defaultPort: manifest.defaultPort || 3100,
        githubRepo: manifest.repo || `${owner}/${slug}`,
        githubBranch: 'main',
        icon: manifest.icon || 'Boxes',
        healthEndpoint: manifest.healthEndpoint || '/api/health',
        buildCommand: manifest.buildCommand || 'npm run build',
        startCommand: manifest.startCommand || 'npm start',
        requiredEnvVars: manifest.requiredEnvVars || [],
      };
    })
  );

  return apps.filter((app): app is LibraryApp => Boolean(app));
}

export async function getMergedLibraryApps(): Promise<LibraryApp[]> {
  try {
    const remote = await fetchLibraryApps();
    const byId = new Map<string, LibraryApp>();
    for (const app of APP_LIBRARY) byId.set(app.id, app);
    for (const app of remote) byId.set(app.id, app);
    return Array.from(byId.values());
  } catch {
    return APP_LIBRARY;
  }
}

/**
 * Get library app by ID
 */
export function getLibraryApp(id: string): LibraryApp | undefined {
  return APP_LIBRARY.find(app => app.id === id);
}

/**
 * Get library app by name
 */
export function getLibraryAppByName(name: string): LibraryApp | undefined {
  return APP_LIBRARY.find(app => app.name === name);
}

