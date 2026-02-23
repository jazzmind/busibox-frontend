/**
 * Generate Extraction Schema API Route
 *
 * POST: Calls agent-api /runs/invoke with the schema-builder agent and a
 * response schema to get deterministic structured output.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';
import { getAgentApiToken, agentApiRequest } from '@jazzmind/busibox-app/lib/agent/chat-api-client';

const USER_PROMPT_PREFIX = `Analyze this document and generate an extraction schema.\n\nDocument content:\n`;

// JSON Schema that LiteLLM will enforce via structured output
const EXTRACTION_SCHEMA_JSON_SCHEMA = {
  name: 'extraction_schema',
  strict: true,
  schema: {
    type: 'object' as const,
    required: ['schemaName', 'displayName', 'itemLabel', 'fields'],
    additionalProperties: false,
    properties: {
      schemaName: {
        type: 'string',
        description: 'Short name based on document type, e.g. "Resume Schema"',
      },
      displayName: {
        type: 'string',
        description: 'Human-readable name for this type of document',
      },
      itemLabel: {
        type: 'string',
        description: 'Singular label for one extracted record, e.g. "Candidate"',
      },
      fields: {
        type: 'object',
        description: 'Map of fieldName → field definition',
        additionalProperties: {
          type: 'object',
          required: ['type', 'description'],
          additionalProperties: false,
          properties: {
            type: {
              type: 'string',
              enum: ['string', 'integer', 'number', 'boolean', 'array', 'enum', 'datetime'],
            },
            required: { type: 'boolean' },
            description: { type: 'string' },
            display_order: {
              type: 'integer',
              description: 'Controls field display order (lower comes first)',
            },
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                type: { type: 'string' },
              },
              required: ['type'],
            },
          },
        },
      },
    },
  },
};

interface RouteParams {
  params: Promise<{ fileId: string }>;
}

interface RunInvokeResponse {
  run_id: string;
  status: string;
  output?: any;
  error?: string | null;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;
    const { fileId } = await params;

    // 1) Fetch the document markdown via data service
    setSessionJwtForUser(user.id, sessionJwt);
    let markdown = '';
    try {
      const mdResponse = await dataFetch(
        `GET /files/${fileId}/markdown`,
        `/files/${fileId}/markdown`,
        { userId: user.id, timeout: 15000 }
      );
      const mdData = await mdResponse.json();
      markdown = mdData?.markdown || mdData?.content || '';
    } catch (err: any) {
      console.error('[generate-schema] Failed to fetch markdown:', err);
      return apiError('Could not fetch document content for schema generation', 502);
    }

    if (!markdown || markdown.length < 50) {
      return apiError('Document has insufficient content for schema generation', 400);
    }

    // Only the first portion is needed to identify document type and fields
    const MAX_DOC_CHARS = 6000;
    const truncated =
      markdown.length > MAX_DOC_CHARS
        ? markdown.slice(0, MAX_DOC_CHARS) + '\n\n[... truncated ...]'
        : markdown;

    // 2) Call agent-api invoke endpoint (auth gateway + deterministic output)
    const agentToken = await getAgentApiToken(user.id, sessionJwt);
    const invokeResult = await agentApiRequest<RunInvokeResponse>(
      agentToken,
      '/runs/invoke',
      {
        method: 'POST',
        body: JSON.stringify({
          agent_name: 'schema-builder',
          input: {
            prompt: USER_PROMPT_PREFIX + truncated,
          },
          response_schema: EXTRACTION_SCHEMA_JSON_SCHEMA,
          agent_tier: 'simple',
        }),
      }
    );

    if (invokeResult.status !== 'succeeded') {
      return NextResponse.json(
        {
          success: false,
          error: invokeResult.error || `Schema generation failed with status ${invokeResult.status}`,
          runId: invokeResult.run_id,
        },
        { status: 422 }
      );
    }

    // 3) Parse agent output
    let schemaJson: Record<string, any> | null = null;
    const rawOutput = invokeResult.output;
    if (rawOutput && typeof rawOutput === 'object' && rawOutput.fields) {
      schemaJson = rawOutput;
    } else if (typeof rawOutput === 'string') {
      try {
        const parsed = JSON.parse(rawOutput);
        if (parsed && typeof parsed === 'object' && parsed.fields) {
          schemaJson = parsed;
        }
      } catch {
        // Ignore; handled below
      }
    }

    if (!schemaJson || !schemaJson.fields) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent did not return a valid schema with fields',
          rawOutput: typeof rawOutput === 'string' ? rawOutput.slice(0, 2000) : rawOutput,
          runId: invokeResult.run_id,
        },
        { status: 422 }
      );
    }

    // Ensure each field has a stable display order so UIs can control layout deterministically.
    const fieldEntries = Object.entries(schemaJson.fields || {});
    schemaJson.fields = Object.fromEntries(
      fieldEntries.map(([fieldName, fieldDef], index) => {
        const current = (fieldDef || {}) as Record<string, any>;
        if (typeof current.display_order !== 'number') {
          current.display_order =
            typeof current.order === 'number' ? current.order : index + 1;
        }
        return [fieldName, current];
      })
    );

    // Extract metadata
    const schemaName = schemaJson.schemaName || schemaJson.displayName || 'Extraction Schema';
    delete schemaJson.schemaName;

    return NextResponse.json({
      success: true,
      schema: schemaJson,
      schemaName,
    });
  } catch (error: any) {
    console.error('[generate-schema] Error:', error);
    return apiError(error.message || 'Failed to generate schema', 500);
  }
}
