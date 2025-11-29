export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

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

  return response.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>('POST', path, body);
}

export async function apiPatch<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>('PATCH', path, body);
}
