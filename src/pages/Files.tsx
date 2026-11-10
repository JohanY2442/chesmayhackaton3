import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { messageOf } from "../lib/errors";

interface FileItem {
  id: number | string;
  name: string;
  status: string;
  rows: number;
  cols: number;
  progress?: number;
}

interface FilesPage {
  items: FileItem[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZES = [10, 20, 50];
const SORTS = ["name", "-name", "progress", "-progress"];

export default function Files() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const sort = SORTS.includes(params.get("sort") ?? "") ? (params.get("sort") as string) : "name";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = PAGE_SIZES.includes(Number(params.get("pageSize"))) ? Number(params.get("pageSize")) : 20;

  const [draftQ, setDraftQ] = useState(q);
  const [data, setData] = useState<FilesPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Todo el estado vive en la URL: recargar, compartir y atrás/adelante muestran lo mismo.
  function update(patch: Record<string, string | undefined>, replace = false) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace });
  }

  // Búsqueda con debounce: no hay una request por tecla.
  useEffect(() => {
    if (draftQ === q) return;
    const timer = window.setTimeout(() => update({ q: draftQ, page: "1" }, true), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQ]);

  // Una respuesta vieja nunca pisa a una nueva: cada cambio aborta la anterior.
  useEffect(() => {
    const controller = new AbortController();
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort });
    if (q) qs.set("q", q);
    if (status) qs.set("status", status);
    setLoading(true);
    setError(null);
    api<FilesPage>(`/files?${qs.toString()}`, {}, { signal: controller.signal })
      .then((result) => setData(result))
      .catch((err) => {
        if (!controller.signal.aborted) setError(messageOf(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [q, status, sort, page, pageSize]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Archivos de datos</h1>

      <div className="flex flex-wrap gap-3 text-sm">
        <input
          aria-label="Buscar archivo"
          placeholder="Buscar por nombre"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          className="rounded bg-slate-900 px-3 py-2"
        />
        <select
          aria-label="Estado"
          value={status}
          onChange={(e) => update({ status: e.target.value, page: "1" })}
          className="rounded bg-slate-900 px-3 py-2"
        >
          <option value="">Todos los estados</option>
          <option value="IN_PROGRESS">En curso</option>
          <option value="COMPLETED">Completado</option>
        </select>
        <select
          aria-label="Orden"
          value={sort}
          onChange={(e) => update({ sort: e.target.value, page: "1" })}
          className="rounded bg-slate-900 px-3 py-2"
        >
          <option value="name">Nombre ↑</option>
          <option value="-name">Nombre ↓</option>
          <option value="progress">Progreso ↑</option>
          <option value="-progress">Progreso ↓</option>
        </select>
        <select
          aria-label="Tamaño de página"
          value={pageSize}
          onChange={(e) => update({ pageSize: e.target.value, page: "1" })}
          className="rounded bg-slate-900 px-3 py-2"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} por página
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}
      {loading && !data && <p role="status" className="text-slate-400">Cargando archivos…</p>}

      {data && (
        <>
          <ul className="divide-y divide-slate-800 rounded border border-slate-800">
            {data.items.length === 0 && <li className="p-4 text-slate-400">No hay archivos con esos filtros.</li>}
            {data.items.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <Link to={`/files/${file.id}/refine`} className="font-medium underline">
                    {file.name}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {file.rows} × {file.cols} · {file.status}
                  </p>
                </div>
                {typeof file.progress === "number" && (
                  <span className="text-sm text-slate-300">{Math.round(file.progress)} %</span>
                )}
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
