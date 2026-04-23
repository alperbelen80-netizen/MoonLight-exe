const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

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
  const url = `${API_BASE_URL}${path}`;

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
