'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBusiboxApi, useCrossAppBasePath } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../http/fetch-with-fallback';

export interface ImageMeta {
  is_duplicate?: boolean;
  is_decorative?: boolean;
  is_background?: boolean;
}

export interface ImageUrlsResult {
  urls: Record<string, string>;
  metadata: Record<string, ImageMeta>;
  loading: boolean;
}

/**
 * Fetches presigned MinIO image URLs for a document and returns them
 * as absolute URLs ready for use in <img> tags.
 */
export function useImageUrls(fileId: string | null): ImageUrlsResult {
  const api = useBusiboxApi();
  const documentsBase = useCrossAppBasePath('documents');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [metadata, setMetadata] = useState<Record<string, ImageMeta>>({});
  const [loading, setLoading] = useState(false);

  const fetchImageUrls = useCallback(async (fid: string) => {
    try {
      const response = await fetchServiceFirstFallbackNext({
        service: { baseUrl: api.services?.dataApiUrl, path: `/files/${fid}/image-urls`, init: { method: 'GET' } },
        next: { nextApiBasePath: documentsBase, path: `/api/documents/${fid}/image-urls`, init: { method: 'GET' } },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: [
            ...(api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504]),
            400, 401, 403,
          ],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });
      if (response.ok) {
        const data = await response.json();
        const rawUrls = (data.urls as Record<string, string>) ?? {};
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const absoluteUrls: Record<string, string> = {};
        for (const [key, val] of Object.entries(rawUrls)) {
          absoluteUrls[key] = val.startsWith('/') && !val.startsWith('//') ? origin + val : val;
        }
        return {
          urls: absoluteUrls,
          metadata: (data.metadata as Record<string, ImageMeta>) ?? {},
        };
      }
    } catch (e) {
      console.warn('Failed to fetch batch image URLs', e);
    }
    return { urls: {} as Record<string, string>, metadata: {} as Record<string, ImageMeta> };
  }, [api.fallback, api.services?.dataApiUrl, api.serviceRequestHeaders, documentsBase]);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    setLoading(true);
    fetchImageUrls(fileId).then((result) => {
      if (!cancelled) {
        setUrls(result.urls);
        setMetadata(result.metadata);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [fileId, fetchImageUrls]);

  return { urls, metadata, loading };
}
