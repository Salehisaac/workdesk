// Every call carries the bridge's initData verbatim as the auth header — see
// plan section 5. Goravel's custom guard re-derives the HMAC locally; nothing
// here needs to know how that verification works.
import { bridge } from '../../bridge';

const API_BASE = '/api/v1';
// Plain fetch() has NO default timeout — if the backend is unreachable in a way
// that doesn't actively refuse the connection (firewalled, DNS black hole,
// misconfigured proxy target), the request just hangs forever and the UI is
// stuck on its loading state with no error, no matter how long you wait. Bound
// every call so it always resolves to a visible error within a fixed window.
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Carries the HTTP status alongside the message so callers can branch on it
 * (see getCollection). `message` is unchanged from what plain Errors used to
 * carry, so every existing `error.message` call site keeps working.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { initData } = bridge.getEnv();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${initData}`,
        ...init?.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`API ${path}: پاسخی از سرور دریافت نشد (زمان درخواست به پایان رسید)`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, `API ${res.status} ${path}: ${body || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<T>(path, { method: 'POST', body: form });
  },
};

/**
 * GET a collection, reading "this route doesn't exist on the backend yet" as
 * an empty collection instead of a hard error.
 *
 * Every collection the dashboard reads has a route now (API_CONTRACT.md), but
 * they didn't all land at once — sessions, decisions and notes were queried by
 * the home dashboard for weeks before their endpoints existed, rendering an
 * empty section instead of an error screen. Kept for the same reason it was
 * introduced: a frontend deployed ahead of its backend, or against an older
 * server, degrades to "nothing here yet" rather than a wall of failures. A 5xx
 * or an auth failure still throws, so real outages stay visible.
 */
export async function getCollection<T>(path: string): Promise<T[]> {
  try {
    return await apiClient.get<T[]>(path);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 501)) return [];
    throw error;
  }
}
