import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearSession, refreshSession } from "./api";
import { getRefresh, onBroadcast, setAccess, setRefresh } from "./tokens";

export interface Me {
  team: { code: string; name: string };
  role: { code: string; name: string };
  permissions: string[];
  clearance: { granted: boolean; grantedAt?: string | null };
}

interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: number; email: string; displayName: string };
}

type Status = "booting" | "anon" | "authed";

interface AuthValue {
  status: Status;
  me: Me | null;
  notice: string | null;
  can: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (teamName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("booting");
  const [me, setMe] = useState<Me | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    const data = await api<Me>("/auth/me");
    setMe(data);
    setStatus("authed");
  }, []);

  const drop = useCallback((reason: string | null) => {
    setMe(null);
    setStatus("anon");
    setNotice(reason);
  }, []);

  // Restauración de sesión: se muestra "verificando" hasta saber si hay sesión válida.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getRefresh()) {
        setStatus("anon");
        return;
      }
      const ok = await refreshSession();
      if (cancelled) return;
      if (!ok) {
        setStatus("anon");
        return;
      }
      try {
        await loadMe();
      } catch {
        if (!cancelled) setStatus("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe]);

  // Cierre de sesión y revocaciones, en esta pestaña y en las demás.
  useEffect(() => {
    const onEnded = (event: Event) => drop((event as CustomEvent<string | null>).detail ?? null);
    window.addEventListener("lumon:session-ended", onEnded);
    const offBroadcast = onBroadcast((message) => clearSession(message.reason, false));
    return () => {
      window.removeEventListener("lumon:session-ended", onEnded);
      offBroadcast();
    };
  }, [drop]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await api<SessionResponse>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
        { auth: false },
      );
      setAccess(session.accessToken);
      setRefresh(session.refreshToken);
      setNotice(null);
      await loadMe();
    },
    [loadMe],
  );

  const register = useCallback(
    async (teamName: string, email: string, password: string) => {
      const session = await api<SessionResponse>(
        "/auth/register",
        { method: "POST", body: JSON.stringify({ teamName, email, password }) },
        { auth: false },
      );
      setAccess(session.accessToken);
      setRefresh(session.refreshToken);
      setNotice(null);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* la sesión ya estaba cerrada en el servidor */
    }
    clearSession("Sesión cerrada.", true);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      me,
      notice,
      can: (permission: string) => Boolean(me?.permissions.includes(permission)),
      login,
      register,
      logout,
    }),
    [status, me, notice, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth fuera de AuthProvider");
  return value;
}
