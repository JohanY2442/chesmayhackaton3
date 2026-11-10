import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { messageOf } from "../lib/errors";
import { findGroup, type GroupResult, type Rules } from "../lib/groups";
import { TileStore } from "../lib/tiles";

const CELL = 24; // px por celda
const LETTER: Record<string, string> = { WO: "W", FC: "F", DR: "D", MA: "M" };
const BIN_BG: Record<string, string> = {
  W: "bg-sky-900/70",
  F: "bg-emerald-900/70",
  D: "bg-violet-900/70",
  M: "bg-rose-900/70",
};

interface FileDetail {
  id: number | string;
  name: string;
  rows: number;
  cols: number;
  tileSize: number;
  status?: string;
  progress?: number;
}

type Selection = { loading: true } | ({ loading: false } & GroupResult);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function Refine() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();

  const [file, setFile] = useState<FileDetail | null>(null);
  const [rules, setRules] = useState<Rules | null>(null);
  const [store, setStore] = useState<TileStore | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  const [viewport, setViewport] = useState({ top: 0, left: 0, width: 800, height: 480 });
  const [cursor, setCursor] = useState({ r: Number(params.get("r")) || 0, c: Number(params.get("c")) || 0 });
  const [sel, setSel] = useState<Selection | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const busyRef = useRef(false);
  const selToken = useRef(0);
  const focusNext = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Carga de archivo y reglas. Cambiar de archivo descarta lo anterior.
  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    setFile(null);
    setStore(null);
    setSel(null);
    Promise.all([
      api<FileDetail>(`/files/${id}`, {}, { signal: controller.signal }),
      api<Rules>(`/files/${id}/rules`, {}, { signal: controller.signal }),
    ])
      .then(([detail, loadedRules]) => {
        if (controller.signal.aborted) return;
        setFile(detail);
        setRules(loadedRules);
        setStore(new TileStore(String(detail.id), detail.tileSize, detail.rows, detail.cols));
      })
      .catch((err) => {
        if (!controller.signal.aborted) setLoadError(messageOf(err));
      });
    return () => controller.abort();
  }, [id]);

  // Re-render al llegar bloques; al cambiar de archivo, cancelar sus cargas.
  useEffect(() => {
    if (!store) return;
    const off = store.subscribe(() => redraw());
    return () => {
      off();
      store.abortAll();
    };
  }, [store]);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewport({ top: el.scrollTop, left: el.scrollLeft, width: el.clientWidth, height: el.clientHeight });
  }, []);

  // Posición inicial desde la URL (?r=&c=), sin llenar el historial.
  useEffect(() => {
    if (!file) return;
    const start = { r: clamp(cursor.r, 0, file.rows - 1), c: clamp(cursor.c, 0, file.cols - 1) };
    setCursor(start);
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = Math.max(0, start.r * CELL - el.clientHeight / 2);
      el.scrollLeft = Math.max(0, start.c * CELL - el.clientWidth / 2);
    }
    measure();
    // Solo al cargar el archivo: el cursor se mueve por la grilla, no por este efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Rango visible con margen; solo se renderizan estas celdas (virtualización).
  const range = useMemo(() => {
    if (!file) return null;
    return {
      r0: Math.max(0, Math.floor(viewport.top / CELL) - 2),
      r1: Math.min(file.rows - 1, Math.floor((viewport.top + viewport.height) / CELL) + 2),
      c0: Math.max(0, Math.floor(viewport.left / CELL) - 2),
      c1: Math.min(file.cols - 1, Math.floor((viewport.left + viewport.width) / CELL) + 2),
    };
  }, [file, viewport]);

  // Pide solo los bloques de la vista, sin duplicados, y cancela los que salieron de ella.
  const ensureVisible = useCallback(() => {
    if (!store || !file || !range) return;
    const ts = file.tileSize;
    const keep = new Set<string>();
    for (let tr = Math.floor(range.r0 / ts); tr <= Math.floor(range.r1 / ts); tr++) {
      for (let tc = Math.floor(range.c0 / ts); tc <= Math.floor(range.c1 / ts); tc++) {
        const k = store.key(tr, tc);
        keep.add(k);
        if (!store.tiles.has(k)) {
          store.load(tr, tc, { viewport: true }).catch((err) => {
            const aborted = err instanceof DOMException && err.name === "AbortError";
            if (!aborted) setMessage(messageOf(err));
          });
        }
      }
    }
    store.pruneViewport(keep);
  }, [store, file, range]);

  useEffect(() => {
    ensureVisible();
  }, [ensureVisible]);

  // Foco al mover el cursor con teclado (sin robar foco en otros casos).
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    scrollRef.current?.querySelector<HTMLElement>('[data-cursor="true"]')?.focus({ preventScroll: true });
  }, [cursor, range]);

  const moveCursor = useCallback(
    (r: number, c: number) => {
      if (!file) return;
      const nr = clamp(r, 0, file.rows - 1);
      const nc = clamp(c, 0, file.cols - 1);
      setCursor({ r: nr, c: nc });
      focusNext.current = true;
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("r", String(nr));
          next.set("c", String(nc));
          return next;
        },
        { replace: true },
      );
      const el = scrollRef.current;
      if (el) {
        const top = nr * CELL;
        const left = nc * CELL;
        if (top < el.scrollTop) el.scrollTop = top;
        else if (top + CELL > el.scrollTop + el.clientHeight) el.scrollTop = top + CELL - el.clientHeight;
        if (left < el.scrollLeft) el.scrollLeft = left;
        else if (left + CELL > el.scrollLeft + el.clientWidth) el.scrollLeft = left + CELL - el.clientWidth;
        measure();
      }
    },
    [file, setParams, measure],
  );

  const select = useCallback(
    async (r: number, c: number) => {
      if (!store || !rules) return;
      const token = ++selToken.current;
      setSel({ loading: true });
      setMessage(null);
      try {
        const result = await findGroup(store, { r, c }, rules);
        if (token !== selToken.current) return;
        setSel({ loading: false, ...result });
      } catch (err) {
        if (token !== selToken.current) return;
        setSel(null);
        setMessage(messageOf(err));
      }
    },
    [store, rules],
  );

  const refine = useCallback(
    async (bin: string) => {
      if (!file || !store || !sel || sel.loading || sel.problem || busyRef.current) return;
      if (!can("files:refine")) {
        setMessage("Tu rol solo puede leer: no puedes refinar.");
        return;
      }
      busyRef.current = true;
      setBusy(true);
      const cells = sel.cells.map(({ r, c }) => ({ r, c }));
      // Una key por intención: los reintentos automáticos de api() reutilizan esta misma.
      const key = crypto.randomUUID();
      try {
        await api(`/files/${file.id}/refinements`, {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({ bin, cells }),
        });
        store.markBins(cells, LETTER[bin] ?? bin.charAt(0));
        selToken.current++;
        setSel(null);
        setMessage(`Grupo de ${cells.length} celdas llevado a ${bin}.`);
        api<FileDetail>(`/files/${file.id}`)
          .then(setFile)
          .catch(() => undefined);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const keys = cells.map(({ r, c }) => {
            const [tr, tc] = store.coords(r, c);
            return store.key(tr, tc);
          });
          store.invalidate(keys);
          ensureVisible();
          selToken.current++;
          setSel(null);
          setMessage("Esas celdas ya estaban refinadas. Recargué sus bloques.");
        } else if (err instanceof ApiError && err.code === "WRONG_BIN") {
          setMessage("Caja incorrecta: Lumon registró un error de refinamiento.");
        } else if (err instanceof ApiError && err.status === 422) {
          const reason = (err.details as { reason?: string } | null)?.reason;
          setMessage(reason ? `El grupo no se puede refinar: ${reason}.` : err.message);
        } else {
          setMessage(messageOf(err));
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [file, store, sel, can, ensureVisible],
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!file) return;
    const { r, c } = cursor;
    const page = Math.max(1, Math.floor(viewport.height / CELL) - 1);
    let handled = true;
    switch (event.key) {
      case "ArrowUp":
        moveCursor(r - 1, c);
        break;
      case "ArrowDown":
        moveCursor(r + 1, c);
        break;
      case "ArrowLeft":
        moveCursor(r, c - 1);
        break;
      case "ArrowRight":
        moveCursor(r, c + 1);
        break;
      case "PageUp":
        moveCursor(r - page, c);
        break;
      case "PageDown":
        moveCursor(r + page, c);
        break;
      case "Home":
        moveCursor(r, 0);
        break;
      case "End":
        moveCursor(r, file.cols - 1);
        break;
      case "Enter":
        void select(r, c);
        break;
      case "Escape":
        selToken.current++;
        setSel(null);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        if (rules && sel && !sel.loading) void refine(rules.binning.order[Number(event.key) - 1]);
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  }

  if (loadError) {
    return (
      <p role="alert" className="text-red-400">
        {loadError}
      </p>
    );
  }
  if (!file || !rules || !store || !range) {
    return <p role="status" className="text-slate-400">Cargando archivo…</p>;
  }

  const threshold = rules.tremorThreshold;
  const selectedKeys = sel && !sel.loading ? new Set(sel.cells.map(({ r, c }) => `${r},${c}`)) : new Set<string>();
  const completed = file.status === "COMPLETED" || (typeof file.progress === "number" && file.progress >= 100);

  const cellNodes: ReactNode[] = [];
  for (let r = range.r0; r <= range.r1; r++) {
    for (let c = range.c0; c <= range.c1; c++) {
      const info = store.cellAt(r, c);
      const isCursor = r === cursor.r && c === cursor.c;
      const classes = [
        "absolute flex items-center justify-center border border-slate-900 font-mono text-[11px] select-none",
        info ? (info.bin !== "." ? BIN_BG[info.bin] ?? "bg-slate-800" : "bg-slate-800/60") : "bg-slate-900 text-transparent",
        info && info.tremor >= threshold ? "text-amber-300 motion-safe:animate-tremor" : "text-slate-400",
        selectedKeys.has(`${r},${c}`) ? "ring-2 ring-amber-400 z-10" : "",
        isCursor ? "outline outline-2 outline-sky-400 z-20" : "",
      ].join(" ");
      cellNodes.push(
        <div
          key={`${r}:${c}`}
          role="gridcell"
          aria-rowindex={r + 1}
          aria-colindex={c + 1}
          aria-selected={selectedKeys.has(`${r},${c}`) || undefined}
          tabIndex={isCursor ? 0 : -1}
          data-cursor={isCursor ? "true" : undefined}
          onClick={() => {
            moveCursor(r, c);
            void select(r, c);
          }}
          className={classes}
          style={{ top: r * CELL, left: c * CELL, width: CELL, height: CELL }}
        >
          {info ? info.digit : ""}
        </div>,
      );
    }
  }

  const localCounts: Record<string, number> = { W: 0, F: 0, D: 0, M: 0 };
  for (const tile of store.tiles.values()) {
    for (const b of tile.bins) if (b in localCounts) localCounts[b]++;
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">{file.name}</h1>
        <p className="text-sm text-slate-400">
          {file.rows} × {file.cols}
          {typeof file.progress === "number" ? ` · progreso ${Math.round(file.progress)} %` : ""}
        </p>
      </header>

      {completed && <p className="rounded bg-emerald-900/40 p-3">Archivo completado.</p>}

      <p role="status" aria-live="polite" className="min-h-6 text-sm text-amber-200">
        {message}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div
          ref={scrollRef}
          role="grid"
          aria-label={`Grilla de ${file.name}`}
          aria-rowcount={file.rows}
          aria-colcount={file.cols}
          tabIndex={-1}
          onScroll={measure}
          onKeyDown={onKeyDown}
          className="relative h-[60vh] overflow-auto rounded border border-slate-700 bg-slate-950"
        >
          <div style={{ position: "relative", width: file.cols * CELL, height: file.rows * CELL }}>{cellNodes}</div>
        </div>

        <aside className="flex flex-col gap-4 text-sm">
          <div className="rounded border border-slate-700 p-3">
            <h2 className="mb-2 font-semibold">Grupo seleccionado</h2>
            {sel === null && (
              <p className="text-slate-400">
                Elige una celda que dé miedo (clic o Enter) para seleccionar su grupo completo.
              </p>
            )}
            {sel?.loading && <p role="status">Buscando el grupo completo…</p>}
            {sel && !sel.loading && (
              <>
                {sel.problem === "not_fear" && <p>Esta celda no da miedo.</p>}
                {sel.problem === "too_small" && (
                  <p>Grupo de {sel.cells.length} celdas: es ruido (mínimo {rules.minGroupSize}).</p>
                )}
                {sel.problem === "too_big" && (
                  <p>Grupo de más de {rules.maxGroupSize} celdas: es ruido (máximo {rules.maxGroupSize}).</p>
                )}
                {sel.problem === "already_refined" && <p>El grupo ya tiene celdas refinadas.</p>}
                {sel.problem === null && (
                  <>
                    <p>
                      Tamaño: <strong>{sel.cells.length}</strong> · Caja según las reglas:{" "}
                      <strong>{sel.bin}</strong>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rules.binning.order.map((bin, index) => (
                        <button
                          key={bin}
                          type="button"
                          disabled={busy || !can("files:refine")}
                          onClick={() => void refine(bin)}
                          className={`rounded px-3 py-1 disabled:opacity-40 ${
                            bin === sel.bin ? "bg-sky-700" : "bg-slate-800"
                          }`}
                        >
                          {bin} <span className="text-xs text-slate-300">({index + 1})</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="rounded border border-slate-700 p-3">
            <h2 className="mb-2 font-semibold">Cajas (bloques cargados)</h2>
            <ul className="flex flex-col gap-1">
              {rules.binning.order.map((bin) => (
                <li key={bin} className="flex justify-between">
                  <span>{bin}</span>
                  <span className="font-mono">{localCounts[LETTER[bin] ?? bin.charAt(0)] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-500">
            Teclado: flechas, PageUp/PageDown, Home/End mueven el cursor; Enter selecciona el grupo; 1–4 lo llevan
            a la caja; Escape cancela.
          </p>
        </aside>
      </div>
    </section>
  );
}
