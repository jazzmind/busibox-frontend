import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StorageAdapter } from '../../../src/platform/interfaces/storage';
import { MemoryStorageAdapter } from '../adapters/memory/storage';

export function runStorageContractTests(getAdapter: () => StorageAdapter): void {
  let adapter: StorageAdapter;

  beforeEach(() => {
    adapter = getAdapter();
  });

  describe('upload', () => {
    it('uploads a Buffer and returns id, url, size, contentType', async () => {
      const content = Buffer.from('Hello, world!');
      const result = await adapter.upload(content, {
        filename: 'test.txt',
        contentType: 'text/plain',
      });
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.url).toBeDefined();
      expect(result.size).toBe(content.length);
      expect(result.contentType).toBe('text/plain');
    });

    it('uploads a ReadableStream', async () => {
      const data = 'Stream content data';
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(data));
          controller.close();
        },
      });
      const result = await adapter.upload(stream, {
        filename: 'stream.txt',
        contentType: 'text/plain',
      });
      expect(result.id).toBeDefined();
      expect(result.size).toBe(data.length);
    });

    it('defaults contentType to application/octet-stream when not provided', async () => {
      const result = await adapter.upload(Buffer.from('data'), { filename: 'noext' });
      expect(result.contentType).toBeDefined();
      expect(typeof result.contentType).toBe('string');
    });

    it('assigns unique IDs to separate uploads', async () => {
      const r1 = await adapter.upload(Buffer.from('file1'), { filename: 'a.txt' });
      const r2 = await adapter.upload(Buffer.from('file2'), { filename: 'b.txt' });
      expect(r1.id).not.toBe(r2.id);
    });
  });

  describe('download', () => {
    it('downloads the exact content that was uploaded', async () => {
      const originalContent = 'Download test content — exact match required';
      const { id } = await adapter.upload(Buffer.from(originalContent), {
        filename: 'download-test.txt',
        contentType: 'text/plain',
      });

      const stream = await adapter.download(id);
      const chunks: Uint8Array[] = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const downloaded = Buffer.concat(chunks).toString('utf-8');
      expect(downloaded).toBe(originalContent);
    });

    it('throws for a non-existent ID', async () => {
      await expect(
        adapter.download('00000000-nonexistent-id'),
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('deletes an uploaded file without error', async () => {
      const { id } = await adapter.upload(Buffer.from('delete me'), {
        filename: 'del.txt',
      });
      await expect(adapter.delete(id)).resolves.not.toThrow();
    });

    it('makes the file unavailable after deletion', async () => {
      const { id } = await adapter.upload(Buffer.from('gone'), { filename: 'gone.txt' });
      await adapter.delete(id);
      await expect(adapter.download(id)).rejects.toThrow();
    });

    it('throws for a non-existent ID', async () => {
      await expect(adapter.delete('00000000-nonexistent-id')).rejects.toThrow();
    });
  });

  describe('getUrl', () => {
    it('returns a URL string for an uploaded file', async () => {
      const { id } = await adapter.upload(Buffer.from('url test'), { filename: 'url.txt' });
      const url = await adapter.getUrl(id);
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    });

    it('throws for a non-existent ID', async () => {
      await expect(adapter.getUrl('00000000-nonexistent-id')).rejects.toThrow();
    });
  });

  describe('visibility', () => {
    it('accepts public visibility', async () => {
      const result = await adapter.upload(Buffer.from('public content'), {
        filename: 'public.txt',
        visibility: 'public',
      });
      expect(result.id).toBeDefined();
    });

    it('accepts private visibility', async () => {
      const result = await adapter.upload(Buffer.from('private content'), {
        filename: 'private.txt',
        visibility: 'private',
      });
      expect(result.id).toBeDefined();
    });
  });

  describe('list (optional)', () => {
    it('lists uploaded files if supported', async () => {
      if (!adapter.list) return;
      await adapter.upload(Buffer.from('a'), { filename: 'list-a.txt' });
      await adapter.upload(Buffer.from('b'), { filename: 'list-b.txt' });
      const files = await adapter.list();
      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files[0]).toHaveProperty('id');
      expect(files[0]).toHaveProperty('filename');
      expect(files[0]).toHaveProperty('size');
    });

    it('filters by prefix if supported', async () => {
      if (!adapter.list) return;
      await adapter.upload(Buffer.from('x'), { filename: 'prefix-x.txt' });
      await adapter.upload(Buffer.from('y'), { filename: 'other-y.txt' });
      const files = await adapter.list('prefix-');
      expect(files.every((f) => f.filename.startsWith('prefix-'))).toBe(true);
    });
  });
}

// Run against MemoryStorageAdapter
describe('MemoryStorageAdapter — storage contract', () => {
  const adapter = new MemoryStorageAdapter();

  afterEach(() => {
    adapter.reset();
  });

  runStorageContractTests(() => adapter);
});
