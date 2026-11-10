import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Shell() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-3">
        <div>
          <Link to="/files" className="font-semibold">
            Lumon · Macrodata Refinement
          </Link>
          {me && (
            <p className="text-xs text-slate-400">
              {me.team.name} ({me.team.code}) · {me.role.name}
            </p>
          )}
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/files" className={({ isActive }) => (isActive ? "underline" : "text-slate-400")}>
            Archivos
          </NavLink>
          <NavLink to="/piso" className={({ isActive }) => (isActive ? "underline" : "text-slate-400")}>
            Personal
          </NavLink>
          <NavLink to="/equipo" className={({ isActive }) => (isActive ? "underline" : "text-slate-400")}>
            Equipo
          </NavLink>
          <NavLink to="/integraciones" className={({ isActive }) => (isActive ? "underline" : "text-slate-400")}>
            Integraciones
          </NavLink>
          <NavLink to="/estado" className={({ isActive }) => (isActive ? "underline" : "text-slate-400")}>
            Estado
          </NavLink>
          <button type="button" onClick={onLogout} className="rounded bg-slate-800 px-3 py-1 hover:bg-slate-700">
            Cerrar sesión
          </button>
        </nav>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
