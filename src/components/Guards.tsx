import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { NoPermission } from "../pages/Errors";
import { Splash } from "./Splash";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "booting") return <Splash text="Verificando sesión…" />;
  if (status === "anon") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

export function RequirePerm({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  return can(perm) ? <>{children}</> : <NoPermission />;
}
