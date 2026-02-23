/**
 * Version API Route
 * 
 * Returns deployment version information from .deployed-version file
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface VersionInfo {
  type: string;
  branch: string;
  commit: string;
  deployed_at: string;
  deployed_by: string;
}

export async function GET(request: NextRequest) {
  try {
    // Try to read the .deployed-version file from the app root
    const versionFilePath = join(process.cwd(), '.deployed-version');
    
    try {
      const versionContent = await readFile(versionFilePath, 'utf-8');
      const versionInfo: VersionInfo = JSON.parse(versionContent);
      
      return NextResponse.json({
        success: true,
        data: {
          ...versionInfo,
          shortCommit: versionInfo.commit ? versionInfo.commit.substring(0, 7) : 'unknown',
        },
      });
    } catch (fileError) {
      // File doesn't exist - likely local development
      return NextResponse.json({
        success: true,
        data: {
          type: 'development',
          branch: process.env.VERCEL_GIT_COMMIT_REF || 'local',
          commit: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
          shortCommit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'dev',
          deployed_at: null,
          deployed_by: 'local',
        },
      });
    }
  } catch (error: any) {
    console.error('[API] Version error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get version info',
    }, { status: 500 });
  }
}


