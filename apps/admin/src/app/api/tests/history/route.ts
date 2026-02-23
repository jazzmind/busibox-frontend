import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const HISTORY_DIR = join(process.cwd(), '.test-history');
const HISTORY_FILE = join(HISTORY_DIR, 'results.json');

interface TestResult {
  id: string;
  suiteId: string;
  suiteName: string;
  project: string;
  service: string;
  success: boolean;
  exitCode: number;
  duration: number;
  timestamp: string;
  output?: string;
  userId: string;
  userEmail: string;
}

/**
 * GET /api/tests/history
 * Get test execution history
 */
export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUserFromCookies();

  if (!currentUser || !currentUser.roles?.includes('Admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const history = await loadHistory();
    
    // Parse query params for filtering
    const { searchParams } = new URL(request.url);
    const suiteId = searchParams.get('suiteId');
    const project = searchParams.get('project');
    const limit = parseInt(searchParams.get('limit') || '50');

    let filtered = history;

    if (suiteId) {
      filtered = filtered.filter((r) => r.suiteId === suiteId);
    }

    if (project) {
      filtered = filtered.filter((r) => r.project === project);
    }

    // Sort by timestamp descending and limit
    filtered = filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return NextResponse.json({ results: filtered });
  } catch (error) {
    console.error('Failed to load test history:', error);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}

/**
 * POST /api/tests/history
 * Save a test result to history
 */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUserFromCookies();

  if (!currentUser || !currentUser.roles?.includes('Admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const result: TestResult = {
      id: `${body.suiteId}-${Date.now()}`,
      suiteId: body.suiteId,
      suiteName: body.suiteName,
      project: body.project,
      service: body.service,
      success: body.success,
      exitCode: body.exitCode,
      duration: body.duration,
      timestamp: new Date().toISOString(),
      output: body.output,
      userId: currentUser.id,
      userEmail: currentUser.email,
    };

    const history = await loadHistory();
    history.push(result);

    // Keep only last 1000 results
    const trimmed = history.slice(-1000);
    await saveHistory(trimmed);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Failed to save test result:', error);
    return NextResponse.json({ error: 'Failed to save result' }, { status: 500 });
  }
}

/**
 * DELETE /api/tests/history
 * Clear test history
 */
export async function DELETE(request: NextRequest) {
  const currentUser = await getCurrentUserFromCookies();

  if (!currentUser || !currentUser.roles?.includes('Admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    await saveHistory([]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear test history:', error);
    return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 });
  }
}

async function loadHistory(): Promise<TestResult[]> {
  try {
    if (!existsSync(HISTORY_FILE)) {
      return [];
    }
    const data = await readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load history:', error);
    return [];
  }
}

async function saveHistory(history: TestResult[]): Promise<void> {
  try {
    // Ensure directory exists
    if (!existsSync(HISTORY_DIR)) {
      await mkdir(HISTORY_DIR, { recursive: true });
    }
    await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Failed to save history:', error);
    throw error;
  }
}
