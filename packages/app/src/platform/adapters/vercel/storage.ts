import type { StorageAdapter, UploadResult } from '../../interfaces/storage';

interface VercelStorageConfig {
  token?: string;
  /** S3-compatible endpoint for non-Vercel environments */
  s3Endpoint?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3Bucket?: string;
}

export class VercelStorageAdapter implements StorageAdapter {
  private config: VercelStorageConfig;

  constructor(config: VercelStorageConfig = {}) {
    this.config = config;
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
    const { put } = await this.importVercelBlob();

    const access = options.visibility === 'public' ? 'public' : 'private';

    let data: File | Blob | Buffer | ReadableStream;
    if (file instanceof Buffer) {
      data = new Blob([file.buffer as ArrayBuffer], {
        type: options.contentType ?? 'application/octet-stream',
      });
    } else {
      data = file;
    }

    const result = await put(options.filename, data as Blob, {
      access,
      contentType: options.contentType,
      addRandomSuffix: true,
      token: this.config.token ?? process.env.BLOB_READ_WRITE_TOKEN,
    });

    const blobResult = result as unknown as Record<string, unknown>;
    return {
      id: result.url,
      url: result.url,
      size: (blobResult['size'] as number | undefined) ?? 0,
      contentType: result.contentType ?? options.contentType ?? 'application/octet-stream',
    };
  }

  async download(id: string): Promise<ReadableStream> {
    // id is the blob URL for Vercel Blob
    const response = await fetch(id);
    if (!response.ok) {
      if (response.status === 404) throw new Error(`File not found: ${id}`);
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    return response.body!;
  }

  async delete(id: string): Promise<void> {
    const { del } = await this.importVercelBlob();
    try {
      await del(id, {
        token: this.config.token ?? process.env.BLOB_READ_WRITE_TOKEN,
      });
    } catch (err) {
      if (String(err).includes('not found')) {
        throw new Error(`File not found: ${id}`);
      }
      throw err;
    }
  }

  async getUrl(id: string): Promise<string> {
    // For Vercel Blob, the id IS the URL
    if (!id) throw new Error(`File not found: ${id}`);
    return id;
  }

  async list(prefix?: string): Promise<Array<{ id: string; filename: string; size: number }>> {
    const { list } = await this.importVercelBlob();

    const result = await list({
      prefix,
      token: this.config.token ?? process.env.BLOB_READ_WRITE_TOKEN,
    });

    return result.blobs.map((b) => ({
      id: b.url,
      filename: b.pathname,
      size: (b as unknown as Record<string, unknown>)['size'] as number ?? 0,
    }));
  }

  private async importVercelBlob() {
    try {
      return await import('@vercel/blob');
    } catch {
      throw new Error(
        'Vercel storage adapter requires "@vercel/blob". Run: pnpm add @vercel/blob',
      );
    }
  }
}
