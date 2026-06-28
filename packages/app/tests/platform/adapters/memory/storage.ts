import { randomUUID } from 'crypto';
import type { StorageAdapter, UploadResult } from '../../../../src/platform/interfaces/storage';

interface StoredFile {
  id: string;
  filename: string;
  data: Buffer;
  contentType: string;
  visibility: 'private' | 'public';
  metadata?: Record<string, string>;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private files: Map<string, StoredFile> = new Map();

  reset(): void {
    this.files.clear();
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
    let buffer: Buffer;

    if (file instanceof Buffer) {
      buffer = file;
    } else if (file instanceof File) {
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      // ReadableStream
      const chunks: Uint8Array[] = [];
      const reader = (file as ReadableStream<Uint8Array>).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      buffer = Buffer.concat(chunks);
    }

    const id = randomUUID();
    const stored: StoredFile = {
      id,
      filename: options.filename,
      data: buffer,
      contentType: options.contentType ?? 'application/octet-stream',
      visibility: options.visibility ?? 'private',
      metadata: options.metadata,
    };

    this.files.set(id, stored);

    return {
      id,
      url: `memory://files/${id}`,
      size: buffer.length,
      contentType: stored.contentType,
    };
  }

  async download(id: string): Promise<ReadableStream> {
    const file = this.files.get(id);
    if (!file) throw new Error(`File not found: ${id}`);

    const data = file.data;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(data));
        controller.close();
      },
    });
  }

  async delete(id: string): Promise<void> {
    if (!this.files.has(id)) throw new Error(`File not found: ${id}`);
    this.files.delete(id);
  }

  async getUrl(id: string): Promise<string> {
    const file = this.files.get(id);
    if (!file) throw new Error(`File not found: ${id}`);
    return `memory://files/${id}`;
  }

  async list(prefix?: string): Promise<Array<{ id: string; filename: string; size: number }>> {
    return Array.from(this.files.values())
      .filter((f) => !prefix || f.filename.startsWith(prefix))
      .map((f) => ({ id: f.id, filename: f.filename, size: f.data.length }));
  }
}
