import type { StorageAdapter, UploadResult } from '../../interfaces/storage';

interface BusiboxStorageConfig {
  dataApiUrl?: string;
  getToken: () => Promise<string>;
}

export class BusiboxStorageAdapter implements StorageAdapter {
  private baseUrl: string;
  private getToken: () => Promise<string>;

  constructor(config: BusiboxStorageConfig) {
    this.baseUrl =
      config.dataApiUrl ??
      (() => {
        const host = process.env.DATA_API_HOST ?? 'localhost';
        const port = process.env.DATA_API_PORT ?? '8002';
        return `http://${host}:${port}`;
      })();
    this.getToken = config.getToken;
  }

  async upload(
    file: File | Buffer | ReadableStream,
    options: {
      filename: string;
      contentType?: string;
      visibility?: 'private' | 'public';
      metadata?: Record<string, string>;
    },
  ): Promise<UploadResult> {
    const token = await this.getToken();

    const formData = new FormData();

    if (file instanceof Buffer) {
      formData.append(
        'file',
        new Blob([file.buffer as ArrayBuffer], { type: options.contentType ?? 'application/octet-stream' }),
        options.filename,
      );
    } else if (file instanceof File) {
      formData.append('file', file, options.filename);
    } else {
      // ReadableStream: collect chunks then upload as blob
      const chunks: Uint8Array[] = [];
      const reader = (file as ReadableStream<Uint8Array>).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const blob = new Blob(chunks.map(c => c.buffer as ArrayBuffer), { type: options.contentType ?? 'application/octet-stream' });
      formData.append('file', blob, options.filename);
    }

    if (options.visibility) formData.append('visibility', options.visibility);
    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    const response = await fetch(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Storage upload error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      id: string;
      url?: string;
      size: number;
      content_type?: string;
    };

    return {
      id: data.id,
      url: data.url ?? `${this.baseUrl}/files/${data.id}`,
      size: data.size,
      contentType: data.content_type ?? options.contentType ?? 'application/octet-stream',
    };
  }

  async download(id: string): Promise<ReadableStream> {
    const token = await this.getToken();

    const response = await fetch(`${this.baseUrl}/files/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 404) throw new Error(`File not found: ${id}`);
      throw new Error(`Storage download error: ${response.status} ${response.statusText}`);
    }

    return response.body!;
  }

  async delete(id: string): Promise<void> {
    const token = await this.getToken();

    const response = await fetch(`${this.baseUrl}/files/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 404) throw new Error(`File not found: ${id}`);
      throw new Error(`Storage delete error: ${response.status} ${response.statusText}`);
    }
  }

  async getUrl(id: string, options?: { expiresIn?: number }): Promise<string> {
    const token = await this.getToken();

    const params = options?.expiresIn ? `?expires_in=${options.expiresIn}` : '';
    const response = await fetch(`${this.baseUrl}/files/${id}/url${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 404) throw new Error(`File not found: ${id}`);
      throw new Error(`Storage getUrl error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { url: string };
    return data.url;
  }

  async list(prefix?: string): Promise<Array<{ id: string; filename: string; size: number }>> {
    const token = await this.getToken();
    const params = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';

    const response = await fetch(`${this.baseUrl}/files${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Storage list error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      files: Array<{ id: string; filename: string; size: number }>;
    };
    return data.files ?? [];
  }
}
