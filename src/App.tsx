import { useCallback, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { api } from "./lib/api";
import { AuthProvider } from "./lib/auth";
import { RequireAuth, RequirePerm } from "./components/Guards";
import { Connecting } from "./components/Splash";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Files from "./pages/Files";
import Refine from "./pages/Refine";
import Estado from "./pages/Estado";
import Equipo from "./pages/Equipo";
import Integraciones from "./pages/Integraciones";
import Piso from "./pages/Piso";
import RefinerEdit from "./pages/RefinerEdit";
import Incidents from "./pages/Incidents";
import { NoPermission, NotFound } from "./pages/Errors";

function useHealth() {
  const [state, setState] = useState({ ok: false, attempt: 0, nonce: 0 });

  useEffect(() => {
    if (state.ok) return;
    const wait = state.attempt === 0 ? 0 : Math.min(15000, 1000 * 2 ** state.attempt);
    const timer = window.setTimeout(async () => {
      try {
        await api("/meta/health", {}, { auth: false });
        setState((s) => ({ ...s, ok: true }));
      } catch {
        setState((s) => ({ ...s, attempt: s.attempt + 1 }));
      }
    }, wait);
    return () => window.clearTimeout(timer);
  }, [state.ok, state.attempt, state.nonce]);

  const retry = useCallback(() => setState((s) => ({ ok: false, attempt: 0, nonce: s.nonce + 1 })), []);
  return { ok: state.ok, attempt: state.attempt, retry };
}

export default function App() {
  const health = useHealth();

  if (!health.ok) {
    return <Connecting attempt={health.attempt} onRetry={health.retry} />;
  }

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<RequireAuth />}>
          <Route element={<Shell />}>
            <Route path="/" element={<RequirePerm perm="files:read"><Files /></RequirePerm>} />
            <Route path="/files" element={<RequirePerm perm="files:read"><Files /></RequirePerm>} />
            <Route path="/files/:id/refine" element={<RequirePerm perm="files:read"><Refine /></RequirePerm>} />
            <Route path="/estado" element={<Estado />} />
            <Route path="/equipo" element={<Equipo />} />
            <Route path="/integraciones" element={<Integraciones />} />
            <Route path="/piso" element={<RequirePerm perm="refiners:read"><Piso /></RequirePerm>} />
            <Route path="/refiners/:id/edit" element={<RequirePerm perm="refiners:write"><RefinerEdit /></RequirePerm>} />
            <Route path="/incidents" element={<RequirePerm perm="incidents:read"><Incidents /></RequirePerm>} />
          </Route>
        </Route>
        <Route path="/sin-permiso" element={<NoPermission />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
