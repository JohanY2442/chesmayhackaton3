// El access token vive solo en memoria. El refresh token se persiste (es de un solo uso).
export type SessionMessage = { type: "revoked"; reason: string };

const REFRESH_KEY = "lumon.refresh";

let accessToken: string | null = null;

export function getAccess(): string | null {
  return accessToken;
}

export function setAccess(token: string | null): void {
  accessToken = token;
}

export function getRefresh(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setRefresh(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(REFRESH_KEY, token);
    else window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* almacenamiento bloqueado: la sesión queda solo en memoria */
  }
}

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("lumon-session") : null;

export function broadcast(message: SessionMessage): void {
  channel?.postMessage(message);
}

export function onBroadcast(handler: (message: SessionMessage) => void): () => void {
  if (!channel) return () => undefined;
  const listener = (event: MessageEvent<SessionMessage>) => handler(event.data);
  channel.addEventListener("message", listener);
  return () => channel.removeEventListener("message", listener);
}
