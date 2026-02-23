/**
 * FastEmbed Embeddings Client for busibox-app
 * 
 * Connects to the data service's embeddings API endpoint
 * for generating embeddings using FastEmbed (bge-large-en-v1.5).
 * 
 * Model: BAAI/bge-large-en-v1.5 (1024 dimensions)
 */

const DEFAULT_DATA_HOST = process.env.DATA_API_HOST || 'localhost';
const DEFAULT_DATA_PORT = process.env.DATA_API_PORT || '8002';
const DEFAULT_DATA_URL = process.env.NEXT_PUBLIC_DATA_API_URL || `http://${DEFAULT_DATA_HOST}:${DEFAULT_DATA_PORT}`;

interface EmbeddingRequest {
  input: string | string[];
  model?: string;
  encoding_format?: string;
}

interface EmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingsClientOptions {
  /** User ID (server-side) */
  userId?: string;
  /** Custom token acquisition function (server-side) */
  getAuthzToken?: (userId: string, audience: string, scopes: string[]) => Promise<string>;
  /** Override data service URL */
  dataUrl?: string;
}

/**
 * Get authorization header for embeddings API calls
 */
async function getAuthHeader(options: EmbeddingsClientOptions): Promise<string | undefined> {
  // Server-side: use custom token acquisition
  if (options.getAuthzToken && options.userId) {
    const token = await options.getAuthzToken(options.userId, 'data-api', []);
    return `Bearer ${token}`;
  }

  // No authentication provided
  return undefined;
}

/**
 * Generate embeddings for multiple texts using FastEmbed
 * 
 * @param texts - Array of texts to embed
 * @param options - Client options (tokenManager or userId + getAuthzToken)
 * @returns Array of embedding vectors (1024 dimensions)
 */
export async function generateEmbeddings(
  texts: string[],
  options: EmbeddingsClientOptions
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const baseUrl = options.dataUrl || DEFAULT_DATA_URL;
  const authHeader = await getAuthHeader(options);

  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: texts,
        model: 'bge-large-en-v1.5',
        encoding_format: 'float',
      } as EmbeddingRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding generation failed: ${response.statusText} - ${errorText}`);
    }

    const data: EmbeddingResponse = await response.json();
    return data.data.map(item => item.embedding);
  } catch (error: any) {
    console.error('[FastEmbed] Failed to generate embeddings:', error);
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

/**
 * Generate a single embedding for text using FastEmbed
 * 
 * @param text - Text to embed
 * @param options - Client options
 * @returns Embedding vector (1024 dimensions)
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingsClientOptions
): Promise<number[]> {
  const embeddings = await generateEmbeddings([text], options);
  return embeddings[0];
}

/**
 * Check if the embeddings service is configured and available
 */
export function isEmbeddingsConfigured(): boolean {
  return !!DEFAULT_DATA_URL;
}

/**
 * Get the embedding dimension for the FastEmbed model
 */
export function getEmbeddingDimension(): number {
  return 1024; // bge-large-en-v1.5 produces 1024-dimensional embeddings
}

