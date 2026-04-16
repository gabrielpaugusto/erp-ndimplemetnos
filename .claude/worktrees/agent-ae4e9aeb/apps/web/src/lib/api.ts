/**
 * Cliente HTTP autenticado com refresh automático de token JWT.
 *
 * - apiFetch('/api/company', { method: 'PATCH', body: JSON.stringify(data) })
 * - authHeader()  — para casos legados que ainda usam fetch manual
 *
 * Em caso de 401, renova o accessToken via refreshToken e repete a requisição.
 * Se o refresh também falhar, limpa os tokens e redireciona para /login.
 */

// ---------------------------------------------------------------------------
// Helpers de token
// ---------------------------------------------------------------------------

function getToken(): string {
  return typeof window !== 'undefined' ? (localStorage.getItem('accessToken') ?? '') : '';
}

function getRefreshToken(): string {
  return typeof window !== 'undefined' ? (localStorage.getItem('refreshToken') ?? '') : '';
}

function saveTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

/** Monta headers de autorização — compatível com o padrão legado. */
export function authHeader(extra?: HeadersInit): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
    ...(extra as Record<string, string> ?? {}),
  };
}

// ---------------------------------------------------------------------------
// Refresh automático (singleton — evita múltiplas chamadas simultâneas)
// ---------------------------------------------------------------------------

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) { clearTokens(); return false; }
      const data = await res.json();
      if (data.accessToken) {
        saveTokens(data.accessToken, data.refreshToken);
        return true;
      }
      clearTokens();
      return false;
    } catch {
      clearTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ---------------------------------------------------------------------------
// apiFetch — substitui fetch + authHeader em todo o sistema
// ---------------------------------------------------------------------------

function buildHeaders(init?: RequestInit): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
    ...(init?.headers as Record<string, string> ?? {}),
  };
}

/**
 * fetch autenticado com retry automático após refresh de token.
 */
export async function apiFetch(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, { ...init, headers: buildHeaders(init) });

  if (res.status !== 401) return res;

  // Token expirado — tentar renovar
  const refreshed = await tryRefresh();
  if (!refreshed) {
    if (typeof window !== 'undefined') {
      clearTokens();
      window.location.href = '/login';
    }
    return res;
  }

  // Retry com novo token
  return fetch(input, { ...init, headers: buildHeaders(init) });
}

// ---------------------------------------------------------------------------
// api<T> — wrapper tipado legado (mantido para compatibilidade)
// ---------------------------------------------------------------------------

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function api<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `/api${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') searchParams.append(key, String(value));
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await apiFetch(url, fetchOptions);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Erro na requisição');
  }

  return res.json();
}
