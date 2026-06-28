export interface UploadResult {
  id: string;
  url: string;
  size: number;
  contentType: string;
}

export interface StorageAdapter {
  upload(file: File | Buffer | ReadableStream, options: {
    filename: string;
    contentType?: string;
    visibility?: 'private' | 'public';
    metadata?: Record<string, string>;
  }): Promise<UploadResult>;

  download(id: string): Promise<ReadableStream>;
  delete(id: string): Promise<void>;
  getUrl(id: string, options?: { expiresIn?: number }): Promise<string>;
  list?(prefix?: string): Promise<Array<{ id: string; filename: string; size: number }>>;
}
