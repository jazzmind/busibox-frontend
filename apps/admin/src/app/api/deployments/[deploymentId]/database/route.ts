/**
 * API Route: Manage deployment database operations
 *
 * POST /api/deployments/[deploymentId]/database
 *
 * Operations: sync (prisma db push), migrate, seed, verify
 * Proxies deployment/config lookup to deploy-api; runs shell commands on deployed app path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getDeployApiToken,
  getDeployment,
  getDeploymentConfig,
} from '@jazzmind/busibox-app/lib/deploy/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DatabaseOperation {
  operation: 'sync' | 'migrate' | 'seed' | 'verify';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { user, sessionJwt } = auth;
  const { deploymentId } = await params;
  const body: DatabaseOperation = await request.json();
  const { operation } = body;

  if (!['sync', 'migrate', 'seed', 'verify'].includes(operation ?? '')) {
    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
  }

  try {
    const token = await getDeployApiToken(user.id, sessionJwt);

    const { deployment } = await getDeployment(token, deploymentId);
    if (!deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    const configId =
      deployment.deployment_config_id ?? deployment.deploymentConfigId;
    if (!configId) {
      return NextResponse.json(
        { error: 'Deployment has no config' },
        { status: 400 }
      );
    }

    const { config } = await getDeploymentConfig(token, configId);
    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    const deployPath = config.deploy_path ?? config.deployPath;
    if (!deployPath) {
      return NextResponse.json(
        { error: 'Config has no deploy path' },
        { status: 400 }
      );
    }

    const hasPrisma = await checkPrismaExists(deployPath);
    if (!hasPrisma) {
      return NextResponse.json(
        { error: 'This application does not use Prisma' },
        { status: 400 }
      );
    }

    let result: string;
    switch (operation) {
      case 'sync':
        result = await syncDatabase(deployPath);
        break;
      case 'migrate':
        result = await migrateDatabase(deployPath);
        break;
      case 'seed':
        result = await seedDatabase(deployPath);
        break;
      case 'verify':
        result = await verifyDatabase(deployPath);
        break;
      default:
        throw new Error('Unknown operation');
    }

    return NextResponse.json({
      success: true,
      operation,
      result,
      message: `Database ${operation} completed successfully`,
    });
  } catch (error) {
    console.error(`Database ${operation} failed:`, error);
    const err = error as { status?: number };
    const status = err.status ?? 500;
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : `Database ${operation} failed`,
      },
      { status }
    );
  }
}

/**
 * Check if application uses Prisma
 */
async function checkPrismaExists(deployPath: string): Promise<boolean> {
  try {
    await execAsync(`test -f ${deployPath}/prisma/schema.prisma`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sync database schema (prisma db push)
 */
async function syncDatabase(deployPath: string): Promise<string> {
  const { stdout, stderr } = await execAsync(
    `cd ${deployPath} && npm run db:push`,
    { timeout: 60000 }
  );
  return stdout + (stderr ? `\n\nWarnings:\n${stderr}` : '');
}

/**
 * Run database migrations (prisma migrate deploy)
 */
async function migrateDatabase(deployPath: string): Promise<string> {
  const { stdout, stderr } = await execAsync(
    `cd ${deployPath} && npx prisma migrate deploy`,
    { timeout: 60000 }
  );
  return stdout + (stderr ? `\n\nWarnings:\n${stderr}` : '');
}

/**
 * Seed database
 */
async function seedDatabase(deployPath: string): Promise<string> {
  const { stdout: packageJson } = await execAsync(
    `cat ${deployPath}/package.json`
  );

  if (!packageJson.includes('"db:seed"')) {
    throw new Error('No seed script found in package.json');
  }

  const { stdout, stderr } = await execAsync(
    `cd ${deployPath} && npm run db:seed`,
    { timeout: 120000 }
  );
  return stdout + (stderr ? `\n\nWarnings:\n${stderr}` : '');
}

/**
 * Verify database schema
 */
async function verifyDatabase(deployPath: string): Promise<string> {
  const { stdout } = await execAsync(
    `cd ${deployPath} && npx prisma validate`,
    { timeout: 30000 }
  );
  return stdout;
}
