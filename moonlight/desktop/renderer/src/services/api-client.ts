// MoonLight v2.6-1: API base resolution priority:
//  1. VITE_API_BASE_URL (dev override / cluster preview environments)
//  2. window.moonlight.getBackendPort() → Electron bridge (packaged .exe)
//  3. http://localhost:8001 fallback (plain-browser dev)
//
// The Electron path is async — we resolve once at module load, cache the
// result, and use a synchronous placeholder until it's available. A few
// UI pages might fire requests before resolution completes; those hit the
// fallback port which is correct in the vast majority of cases.

type MoonlightBridge = {
  getBackendPort: () => Promise<number | null>;
};

declare global {
  interface Window {
    moonlight?: MoonlightBridge;
  }
}

const FALLBACK_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8001';

let resolvedBase: string = FALLBACK_BASE;
let resolving: Promise<string> | null = null;

/**
 * Synchronous base getter for components that can't (or don't want to)
 * await the async resolver. Returns the *currently resolved* base; the
 * very first render before `resolveApiBase()` finishes may still hit the
 * FALLBACK_BASE, which in the packaged app is `http://localhost:8001`
 * — the preferred backend port. Within a tick of module load, the real
 * dynamic port (if different) is patched in and subsequent fetches hit
 * the correct port.
 */
export function getApiBase(): string {
  return resolvedBase;
}

async function resolveApiBase(): Promise<string> {
  if (resolving) return resolving;
  resolving = (async () => {
    // Dev / preview: VITE_API_BASE_URL wins so proxy works.
    if (import.meta.env.VITE_API_BASE_URL) {
      return FALLBACK_BASE;
    }
    const bridge = typeof window !== 'undefined' ? window.moonlight : undefined;
    if (bridge && typeof bridge.getBackendPort === 'function') {
      try {
        const port = await bridge.getBackendPort();
        if (port && Number.isFinite(port)) {
          resolvedBase = `http://127.0.0.1:${port}`;
        }
      } catch {
        /* fall through to default */
      }
    }
    return resolvedBase;
  })();
  return resolving;
}

// Kick off resolution ASAP; we don't await it at module load.
void resolveApiBase();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const base = resolving ? await resolving : resolvedBase;
  const url = `${base}${path}`;

  const headers: Record<string, string> = {};

  // Hard timeout so the UI never gets stuck on a request that never resolves
  // (e.g. edge proxies that keep connections hanging). 8s is generous for
  // LAN/localhost API calls while still keeping the UI responsive.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const options: RequestInit = {
    method,
    mode: 'cors',
    cache: 'no-store',
    signal: controller.signal,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  options.headers = headers;

  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiError(0, `Request timeout after 8s: ${method} ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(
      response.status,
      `HTTP ${response.status}: ${response.statusText}`,
      errorText,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  // NOTE: using response.text() + JSON.parse() (instead of response.json())
  // is a more deterministic path through certain edge proxies (e.g. Cloudflare
  // in our preview environment) that occasionally kept response.json() in a
  // streaming state and never resolved.
  const raw = await response.text();
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PUT', path, body);
}

export async function apiDelete<T>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}
