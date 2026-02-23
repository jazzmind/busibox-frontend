/**
 * Agent API Video Client
 *
 * Thin client for proxying video operations through the Agent API.
 * The Agent API forwards requests to LiteLLM which holds the OpenAI key --
 * the Busibox Portal never sees or stores the raw API key.
 *
 * Endpoints used:
 *   POST  /llm/videos/create            – create a video generation job
 *   GET   /llm/videos/{video_id}        – retrieve video status
 *   GET   /llm/videos/{video_id}/content – download video bytes
 */

const AGENT_API_URL =
  process.env.AGENT_API_URL ||
  process.env.NEXT_PUBLIC_AGENT_API_URL ||
  'http://localhost:8000';

// ---- Types matching OpenAI video response shape ----

export interface AgentVideoResponse {
  id: string;
  status: string;        // "queued" | "in_progress" | "completed" | "failed"
  progress?: number | null;
  error?: { message?: string } | null;
  [key: string]: unknown; // pass through any extra fields
}

export interface CreateVideoViaAgentParams {
  model?: string;
  prompt: string;
  seconds: string;
  size: string;
  /** Base64-encoded reference image (already resized) */
  inputReferenceBase64?: string;
  /** Filename for the reference image */
  inputReferenceFilename?: string;
}

// ---- Client functions ----

/**
 * Create a video generation job via Agent API -> LiteLLM -> OpenAI.
 */
export async function createVideoViaAgent(
  agentToken: string,
  params: CreateVideoViaAgentParams
): Promise<AgentVideoResponse> {
  const body: Record<string, unknown> = {
    model: params.model ?? 'video',
    prompt: params.prompt,
    seconds: params.seconds,
    size: params.size,
  };

  if (params.inputReferenceBase64) {
    body.input_reference_base64 = params.inputReferenceBase64;
    body.input_reference_filename =
      params.inputReferenceFilename ?? `reference-${Date.now()}.jpg`;
  }

  const res = await fetch(`${AGENT_API_URL}/llm/videos/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${agentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Agent API video creation failed (${res.status}): ${text}`
    );
  }

  return (await res.json()) as AgentVideoResponse;
}

/**
 * Retrieve video status via Agent API -> LiteLLM -> OpenAI.
 */
export async function getVideoStatusViaAgent(
  agentToken: string,
  openaiVideoId: string
): Promise<AgentVideoResponse> {
  const res = await fetch(
    `${AGENT_API_URL}/llm/videos/${openaiVideoId}`,
    {
      headers: { Authorization: `Bearer ${agentToken}` },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Agent API video status failed (${res.status}): ${text}`
    );
  }

  return (await res.json()) as AgentVideoResponse;
}

/**
 * Download video content bytes via Agent API -> LiteLLM -> OpenAI.
 *
 * Returns a Buffer with the full video file.
 */
export async function downloadVideoViaAgent(
  agentToken: string,
  openaiVideoId: string
): Promise<Buffer> {
  const res = await fetch(
    `${AGENT_API_URL}/llm/videos/${openaiVideoId}/content`,
    {
      headers: { Authorization: `Bearer ${agentToken}` },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Agent API video content download failed (${res.status}): ${text}`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
