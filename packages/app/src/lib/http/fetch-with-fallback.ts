export type FallbackPolicy = {
  fallbackStatuses: number[];
  fallbackOnNetworkError: boolean;
};

export type ServiceCall = {
  baseUrl?: string;
  path: string;
  init?: RequestInit;
};

export type NextCall = {
  nextApiBasePath?: string;
  path: string;
  init?: RequestInit;
};

export type FetchWithFallbackArgs = {
  service: ServiceCall;
  next: NextCall;
  /**
   * Defaults are set by BusiboxApiProvider, but callers may override.
   */
  fallback: FallbackPolicy;
  /**
   * Headers to apply to the *service* request.
   * (Next route typically relies on cookie auth in the consuming app.)
   */
  serviceHeaders?: Record<string, string>;
};

function joinUrl(baseUrl: string, path: string) {
  const base = baseUrl.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function applyNextBasePath(nextApiBasePath: string | undefined, path: string) {
  const base = (nextApiBasePath ?? '').replace(/\/+$/, '');
  if (!base) return path;
  if (!path.startsWith('/')) return `${base}/${path}`;
  return `${base}${path}`;
}

function shouldFallbackStatus(status: number, policy: FallbackPolicy) {
  return policy.fallbackStatuses.includes(status);
}

/**
 * Migration helper: try a service endpoint first, then fallback to Next.js route
 * when the service endpoint is missing/unavailable.
 *
 * NOTE: The caller should still inspect the returned response for non-OK status.
 */
export async function fetchServiceFirstFallbackNext(args: FetchWithFallbackArgs): Promise<Response> {
  const policy = args.fallback;

  // 1) Service call (if baseUrl provided)
  if (args.service.baseUrl) {
    const serviceUrl = joinUrl(args.service.baseUrl, args.service.path);
    try {
      const init: RequestInit = {
        ...args.service.init,
        headers: {
          ...(args.service.init?.headers ?? {}),
          ...(args.serviceHeaders ?? {}),
        },
      };

      const res = await fetch(serviceUrl, init);
      if (res.ok) return res;
      if (!shouldFallbackStatus(res.status, policy)) return res;
      // else: fallback
    } catch (err) {
      if (!policy.fallbackOnNetworkError) throw err;
      // else: fallback
    }
  }

  // 2) Next.js route fallback
  const nextUrl = applyNextBasePath(args.next.nextApiBasePath, args.next.path);
  return fetch(nextUrl, args.next.init);
}










