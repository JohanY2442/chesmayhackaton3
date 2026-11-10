import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { messageOf } from "../lib/errors";

interface Department {
  id: number | string;
  name: string;
}

interface RefinerRow {
  id: number | string;
  displayName?: string;
  name?: string;
  department?: { name?: string } | string | null;
}

interface RefinersPage {
  items: RefinerRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

function label(row: RefinerRow): string {
  return row.displayName ?? row.name ?? `Expediente ${row.id}`;
}

export default function Piso() {
  const [params, setParams] = useSearchParams();
  const department = params.get("department") ?? "";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [data, setData] = useState<RefinersPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [draftQ, setDraftQ] = useState(q);

  function update(patch: Record<string, string | undefined>, replace = false) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace });
  }

  useEffect(() => {
    api<Department[]>("/departments")
      .then(setDepartments)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 423) setClosed(true);
        else setError(messageOf(err));
      });
  }, []);

  useEffect(() => {
    if (draftQ === q) return;
    const timer = window.setTimeout(() => update({ q: draftQ, page: "1" }, true), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQ]);

  useEffect(() => {
    const controller = new AbortController();
    const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (department) qs.set("department", department);
    if (q) qs.set("q", q);
    setError(null);
    api<RefinersPage>(`/refiners?${qs.toString()}`, {}, { signal: controller.signal })
      .then(setData)
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 423) setClosed(true);
        else setError(messageOf(err));
      });
    return () => controller.abort();
  }, [department, q, page]);

  if (closed) {
    return (
      <section className="max-w-xl">
        <h1 className="mb-2 text-2xl font-semibold">Piso de Pruebas cerrado</h1>
        <p className="text-slate-400">
          Tu equipo todavía no pasó la revisión automática. Ve a <Link to="/estado" className="underline">Estado</Link>.
        </p>
      </section>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Directorio del personal</h1>
      <div className="flex flex-wrap gap-3 text-sm">
        <input
          aria-label="Buscar personal"
          placeholder="Buscar"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          className="rounded bg-slate-900 px-3 py-2"
        />
        <select
          aria-label="Departamento"
          value={department}
          onChange={(e) => update({ department: e.target.value, page: "1" })}
          className="rounded bg-slate-900 px-3 py-2"
        >
          <option value="">Todos los departamentos</option>
          {departments.map((d) => (
            <option key={d.id} value={String(d.id)}>
              {d.name}
            </option>
          ))}
        </select>
        <Link to="/incidents" className="rounded bg-slate-800 px-3 py-2">
          Incidencias
        </Link>
      </div>

      {error && <p role="alert" className="text-red-400">{error}</p>}
      {!data && !error && <p role="status" className="text-slate-400">Cargando personal…</p>}

      {data && (
        <>
          <ul className="divide-y divide-slate-800 rounded border border-slate-800">
            {data.items.length === 0 && <li className="p-4 text-slate-400">Sin resultados.</li>}
            {data.items.map((row) => (
              <li key={row.id} className="flex items-center justify-between p-3">
                <span>{label(row)}</span>
                <Link to={`/refiners/${row.id}/edit`} className="underline">
                  Editar
                </Link>
              </li>
            ))}
          </ul>
          <nav className="flex items-center gap-3 text-sm" aria-label="Paginación">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
              className="rounded bg-slate-800 px-3 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => update({ page: String(page + 1) })}
              className="rounded bg-slate-800 px-3 py-1 disabled:opacity-40"
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
