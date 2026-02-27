/**
 * Generate Extraction Schema API Route
 *
 * POST: Starts async schema generation via agent-api /runs/invoke-async.
 *       Returns a runId immediately for the frontend to poll.
 * GET:  Polls the agent-api run status and, when complete, parses the schema.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';
import { getAgentApiToken, agentApiRequest } from '@jazzmind/busibox-app/lib/agent/chat-api-client';

const USER_PROMPT_PREFIX = `Analyze this document and generate an extraction schema.

IMPORTANT: Be extremely conservative with required fields. Mark a field as required ONLY if it is absolutely guaranteed to appear in EVERY document of this type. Typically only 1-2 fields should be required. Most fields should NOT be required.

For each field, you may optionally include a "search" array indicating how the field should be indexed:
- "keyword": for keyword-searchable fields (names, IDs, statuses, categories, tags, dates, numbers, booleans, enums)
- "embed": for semantically searchable fields (descriptions, summaries, notes, long-form text, content)
- "graph": for entity-like fields that should be extracted into a knowledge graph (people names, organizations, locations, skills, relationships)

A field can have multiple search modes, or none (stored but not indexed). Examples:
- A person's name: ["keyword", "graph"]
- A list of skills/tags: ["keyword", "embed", "graph"]
- A summary or description: ["embed"]
- A date or numeric ID: ["keyword"]
- An organization name: ["keyword", "graph"]
- A phone number or address: [] (not indexed, just stored)

Document content:
`;

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
            search: {
              type: 'array',
              description: 'Optional search/indexing modes: "keyword" for BM25 keyword search, "embed" for semantic vector search, "graph" for knowledge graph entity extraction. Omit or use empty array for fields that are stored but not indexed.',
              items: {
                type: 'string',
                enum: ['keyword', 'embed', 'graph'],
              },
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

/**
 * POST — kick off async schema generation and return the run_id.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;
    const { fileId } = await params;

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

    const MAX_DOC_CHARS = 6000;
    const truncated =
      markdown.length > MAX_DOC_CHARS
        ? markdown.slice(0, MAX_DOC_CHARS) + '\n\n[... truncated ...]'
        : markdown;

    const agentToken = await getAgentApiToken(user.id, sessionJwt);
    const asyncResult = await agentApiRequest<{ run_id: string; status: string }>(
      agentToken,
      '/runs/invoke-async',
      {
        method: 'POST',
        body: JSON.stringify({
          agent_name: 'schema-builder',
          input: { prompt: USER_PROMPT_PREFIX + truncated },
          response_schema: EXTRACTION_SCHEMA_JSON_SCHEMA,
          agent_tier: 'complex',
        }),
      }
    );

    return NextResponse.json({
      success: true,
      runId: asyncResult.run_id,
      status: 'accepted',
    });
  } catch (error: any) {
    console.error('[generate-schema] Error:', error);
    return apiError(error.message || 'Failed to start schema generation', 500);
  }
}

/**
 * Parse raw agent output into a validated schema object.
 */
function parseSchemaOutput(rawOutput: any): { schema: Record<string, any>; schemaName: string } | null {
  let schemaJson: Record<string, any> | null = null;
  if (rawOutput && typeof rawOutput === 'object' && rawOutput.fields) {
    schemaJson = rawOutput;
  } else if (typeof rawOutput === 'string') {
    try {
      const parsed = JSON.parse(rawOutput);
      if (parsed && typeof parsed === 'object' && parsed.fields) {
        schemaJson = parsed;
      }
    } catch {
      // not JSON
    }
  }

  if (!schemaJson || !schemaJson.fields) return null;

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

  // Cap required fields: if the LLM marked more than 3 fields as required,
  // keep only the first 2 (by display_order) and demote the rest.
  const MAX_REQUIRED_FIELDS = 3;
  const requiredFields = Object.entries(schemaJson.fields)
    .filter(([, def]: [string, any]) => def?.required === true)
    .sort(([, a]: [string, any], [, b]: [string, any]) =>
      (a.display_order ?? 999) - (b.display_order ?? 999)
    );

  if (requiredFields.length > MAX_REQUIRED_FIELDS) {
    const toKeep = new Set(requiredFields.slice(0, MAX_REQUIRED_FIELDS).map(([name]) => name));
    for (const [fieldName, fieldDef] of Object.entries(schemaJson.fields) as [string, any][]) {
      if (fieldDef?.required === true && !toKeep.has(fieldName)) {
        fieldDef.required = false;
      }
    }
  }

  const schemaName = schemaJson.schemaName || schemaJson.displayName || 'Extraction Schema';
  delete schemaJson.schemaName;

  return { schema: schemaJson, schemaName };
}

/**
 * GET — poll the run status and return the parsed schema when complete.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;
    await params;

    const runId = request.nextUrl.searchParams.get('runId');
    if (!runId) {
      return apiError('runId query parameter is required', 400);
    }

    const agentToken = await getAgentApiToken(user.id, sessionJwt);
    const run = await agentApiRequest<{
      id: string;
      status: string;
      output?: Record<string, any> | null;
    }>(agentToken, `/runs/${runId}`, { method: 'GET' });

    if (run.status === 'pending' || run.status === 'running') {
      return NextResponse.json({ status: run.status, runId });
    }

    if (run.status === 'failed' || run.status === 'timeout') {
      const errorMsg =
        run.output?.error || `Schema generation ${run.status}`;
      return NextResponse.json(
        { status: run.status, error: errorMsg, runId },
        { status: 422 }
      );
    }

    // succeeded — parse the output
    const rawOutput = run.output?.result ?? run.output?.data ?? run.output;
    const parsed = parseSchemaOutput(rawOutput);
    if (!parsed) {
      return NextResponse.json(
        {
          status: 'failed',
          error: 'Agent did not return a valid schema with fields',
          rawOutput: typeof rawOutput === 'string' ? rawOutput.slice(0, 2000) : rawOutput,
          runId,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      status: 'succeeded',
      success: true,
      schema: parsed.schema,
      schemaName: parsed.schemaName,
      runId,
    });
  } catch (error: any) {
    console.error('[generate-schema] Poll error:', error);
    return apiError(error.message || 'Failed to check schema generation status', 500);
  }
}
