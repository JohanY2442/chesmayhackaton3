import { API_BASE_URL, BUILD_SHA } from "../config";
import { broadcast, getAccess, getRefresh, setAccess, setRefresh } from "./tokens";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  headers: Headers | null = null;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const SESSION_ENDED: Record<string, string> = {
  REFRESH_REUSED: "Se detectó un uso repetido de tu sesión y se cerró en todas las pestañas. Inicia sesión de nuevo.",
  SESSION_REVOKED: "Tu sesión fue revocada. Inicia sesión de nuevo.",
  TOKEN_INVALID: "Tu sesión ya no es válida. Inicia sesión de nuevo.",
};

const EXPIRED_MESSAGE = "Tu sesión venció. Inicia sesión de nuevo.";

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function retryAfterMs(res: Response, fallbackMs: number): number {
  const seconds = Number(res.headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : fallbackMs;
}

function baseHeaders(hasBody: boolean, auth: boolean, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (hasBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("X-Lumon-Build", BUILD_SHA);
  const token = getAccess();
  if (auth && token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function readError(res: Response): Promise<ApiError> {
  let body: { error?: string; message?: string; details?: unknown } | null = null;
  try {
    body = await res.json();
  } catch {
    /* sin cuerpo JSON */
  }
  const error = new ApiError(
    res.status,
    body?.error ?? `HTTP_${res.status}`,
    body?.message ?? `Error ${res.status}`,
    body?.details ?? null,
  );
  error.headers = res.headers;
  return error;
}

/** Cierra la sesión local. Con announce, avisa a las demás pestañas (menos de 2 s). */
export function clearSession(reason: string | null, announce: boolean): void {
  setAccess(null);
  setRefresh(null);
  if (announce && reason) broadcast({ type: "revoked", reason });
  window.dispatchEvent(new CustomEvent<string | null>("lumon:session-ended", { detail: reason }));
}

// Refresh coordinado: dentro de una pestaña hay como máximo un POST /auth/refresh en vuelo,
// y entre pestañas el lock evita presentar dos veces el mismo refresh token.
let inflight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (!inflight) {
    inflight = withRefreshLock(doRefresh).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("lumon-refresh", task);
  }
  return task();
}

async function doRefresh(): Promise<boolean> {
  // Se lee dentro del lock: otra pestaña pudo haber rotado el token mientras esperábamos.
  const refreshToken = getRefresh();
  if (!refreshToken) return false;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: baseHeaders(true, false),
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      if (attempt < 3) {
        await sleep(500 * attempt);
        continue;
      }
      return false;
    }

    if (res.ok) {
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      setAccess(data.accessToken);
      setRefresh(data.refreshToken);
      return true;
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt < 3) {
        await sleep(retryAfterMs(res, 500 * attempt));
        continue;
      }
      return false;
    }

    const err = await readError(res);
    clearSession(SESSION_ENDED[err.code] ?? EXPIRED_MESSAGE, true);
    return false;
  }
  return false;
}

interface RequestOptions {
  auth?: boolean;
  signal?: AbortSignal;
  onResponse?: (res: Response) => void;
}

/** Llamada a la API: añade cabeceras, reintenta 429/503/red y refresca una vez ante TOKEN_EXPIRED. */
export async function api<T>(path: string, init: RequestInit = {}, opts: RequestOptions = {}): Promise<T> {
  const auth = opts.auth ?? true;
  let refreshed = false;
  let attempts = 0;

  for (;;) {
    attempts += 1;
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: baseHeaders(init.body !== undefined && init.body !== null, auth, init.headers),
        signal: opts.signal,
      });
    } catch (error) {
      if (opts.signal?.aborted) throw error;
      if (attempts < 4) {
        await sleep(400 * 2 ** attempts);
        continue;
      }
      throw new ApiError(0, "NETWORK", "Sin conexión con Lumon. Reintenta en un momento.");
    }

    if (res.ok) {
      opts.onResponse?.(res);
      return (res.status === 204 ? undefined : await res.json()) as T;
    }

    if ((res.status === 429 || res.status === 503) && attempts < 8) {
      await sleep(retryAfterMs(res, Math.min(8000, 500 * attempts)));
      continue;
    }

    const err = await readError(res);

    if (res.status === 401 && auth) {
      if (err.code === "TOKEN_EXPIRED" && !refreshed) {
        refreshed = true;
        if (await refreshSession()) continue;
        clearSession(EXPIRED_MESSAGE, true);
        throw err;
      }
      if (err.code in SESSION_ENDED) {
        clearSession(SESSION_ENDED[err.code], true);
      }
    }
    throw err;
  }
}
