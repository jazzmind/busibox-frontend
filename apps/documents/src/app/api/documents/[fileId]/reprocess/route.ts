import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';
import { getDataApiTokenForSettings, getDataSettings } from '@jazzmind/busibox-app/lib/data/settings';

// Valid stages for reprocessing
const VALID_STAGES = ['parsing', 'chunking', 'cleanup', 'markdown', 'entity_extraction', 'embedding', 'indexing'] as const;
type ReprocessStage = typeof VALID_STAGES[number];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    
    const { user, sessionJwt } = authResult;
    
    // Set session JWT for Zero Trust token exchange
    setSessionJwtForUser(user.id, sessionJwt);
    
    const { fileId } = await params;
    
    // Parse request body for optional start_stage and config_overrides
    let startStage: ReprocessStage | undefined;
    let configOverrides: Record<string, unknown> = {};
    try {
      const body = await request.json();
      if (body.start_stage && VALID_STAGES.includes(body.start_stage)) {
        startStage = body.start_stage;
      }
      if (body.config_overrides && typeof body.config_overrides === 'object') {
        configOverrides = body.config_overrides;
      }
    } catch {
      // No body or invalid JSON - start from beginning
    }
    
    // Get data settings for processing config from data-api store
    // If settings fetch fails, use defaults so reprocessing still works
    let processingConfig: Record<string, unknown> = {};
    try {
      const { accessToken: settingsToken } = await getDataApiTokenForSettings(user.id, sessionJwt);
      const settings = await getDataSettings(settingsToken);

      // Build processing config from current settings
      processingConfig = {
        llm_cleanup_enabled: settings.llmCleanupEnabled,
        multi_flow_enabled: settings.multiFlowEnabled,
        max_parallel_strategies: settings.maxParallelStrategies,
        marker_enabled: settings.markerEnabled,
        colpali_enabled: settings.colpaliEnabled,
        entity_extraction_enabled: settings.entityExtractionEnabled,
        chunk_size_min: settings.chunkSizeMin,
        chunk_size_max: settings.chunkSizeMax,
        chunk_overlap_pct: settings.chunkOverlapPct,
      };
    } catch (settingsError) {
      console.warn('[API] Failed to fetch processing settings, using defaults:', settingsError instanceof Error ? settingsError.message : settingsError);
      // Continue with empty config - the data-api worker will use its own defaults
    }
    
    // Apply frontend config overrides (e.g. pass-specific marker/llm toggles)
    Object.assign(processingConfig, configOverrides);

    // Add start_stage if specified
    if (startStage) {
      processingConfig.start_stage = startStage;
      if (startStage === 'entity_extraction') {
        processingConfig.entity_extraction_enabled = true;
      }
    }
    
    const response = await dataFetch(
      `POST /api/documents/[fileId]/reprocess - reprocess document ${fileId} from ${startStage || 'beginning'}`,
      `/files/${fileId}/reprocess`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ processing_config: processingConfig }),
        userId: user.id,
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    // Error is already logged by dataFetch with context
    return NextResponse.json(
      { error: error.message || 'Failed to reprocess document' },
      { status: error.statusCode || 500 }
    );
  }
}

// GET endpoint to return available stages
export async function GET() {
  return NextResponse.json({
    stages: VALID_STAGES.map(stage => ({
      value: stage,
      label: stage.charAt(0).toUpperCase() + stage.slice(1),
      description: getStageDescription(stage),
    })),
  });
}

function getStageDescription(stage: ReprocessStage): string {
  const descriptions: Record<ReprocessStage, string> = {
    parsing: 'Extract text from original document (Pass 1: pdfplumber, Pass 3: Marker)',
    chunking: 'Re-chunk and re-embed text segments',
    cleanup: 'LLM text cleanup (Pass 2)',
    markdown: 'Regenerate markdown and extract images',
    entity_extraction: 'Re-extract keywords and entities for knowledge graph',
    embedding: 'Regenerate embeddings for chunks',
    indexing: 'Re-index vectors in Milvus',
  };
  return descriptions[stage];
}

