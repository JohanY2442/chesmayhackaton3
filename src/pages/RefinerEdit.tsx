import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { messageOf } from "../lib/errors";

type Expediente = Record<string, unknown> & { id?: number | string; version?: number };

// Campos que no se editan desde el formulario genérico.
const READ_ONLY = new Set(["id", "version", "badgeMediaId", "createdAt", "updatedAt"]);

function editableKeys(record: Expediente): string[] {
  return Object.keys(record).filter(
    (k) => !READ_ONLY.has(k) && (typeof record[k] === "string" || typeof record[k] === "number"),
  );
}

export default function RefinerEdit() {
  const { id = "" } = useParams();
  const [server, setServer] = useState<Expediente | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<{ current: Expediente; etag: string | null } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load(): Promise<void> {
    let tag: string | null = null;
    return api<Expediente>(`/refiners/${id}`, {}, { onResponse: (res) => (tag = res.headers.get("ETag")) })
      .then((data) => {
        setServer(data);
        setEtag(tag);
        setForm(Object.fromEntries(editableKeys(data).map((k) => [k, String(data[k])])));
        setConflict(null);
      })
      .catch((err) => setError(messageOf(err)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Regla de Milchick: If-Match con el ETag leído; nunca se sobrescribe en silencio.
  async function save(useTag: string | null, event?: FormEvent) {
    event?.preventDefault();
    if (!server || !useTag) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api<Expediente>(`/refiners/${id}`, {
        method: "PATCH",
        headers: { "If-Match": useTag },
        body: JSON.stringify(form),
      });
      setServer(updated);
      setForm(Object.fromEntries(editableKeys(updated).map((k) => [k, String(updated[k])])));
      setEtag(useTag);
      setMessage("Expediente guardado.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 412) {
        const current = (err.details as { current?: Expediente } | null)?.current ?? null;
        const newTag = err.headers?.get("ETag") ?? null;
        if (current) setConflict({ current, etag: newTag });
        setError("Alguien cambió este expediente mientras lo editabas.");
      } else {
        setError(messageOf(err));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!server) {
    return error ? <p role="alert" className="text-red-400">{error}</p> : <p role="status">Cargando expediente…</p>;
  }

  const keys = editableKeys(server);

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Editar expediente {String(server.id ?? id)}</h1>

      {conflict ? (
        <div role="alert" className="flex flex-col gap-3 rounded border border-amber-600 p-3">
          <p>Conflicto de versión. Compara lo que escribiste con lo que hay ahora en el servidor:</p>
          <table className="text-sm">
            <thead>
              <tr>
                <th className="pr-4 text-left">Campo</th>
                <th className="pr-4 text-left">Tu versión</th>
                <th className="text-left">En el servidor</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k}>
                  <td className="pr-4">{k}</td>
                  <td className="pr-4">{form[k]}</td>
                  <td>{String(conflict.current[k] ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => save(conflict.etag)}
              className="rounded bg-sky-700 px-3 py-1 disabled:opacity-40"
            >
              Guardar mi versión sobre la actual
            </button>
            <button
              type="button"
              onClick={() => {
                setServer(conflict.current);
                setEtag(conflict.etag);
                setForm(Object.fromEntries(editableKeys(conflict.current).map((k) => [k, String(conflict.current[k] ?? "")])));
                setConflict(null);
              }}
              className="rounded bg-slate-800 px-3 py-1"
            >
              Usar la versión del servidor
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => save(etag, e)} className="flex flex-col gap-3">
          {keys.map((k) => (
            <label key={k} className="flex flex-col gap-1 text-sm">
              {k}
              <input
                value={form[k] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                className="rounded bg-slate-900 px-3 py-2"
              />
            </label>
          ))}
          <button type="submit" disabled={busy || !etag} className="w-fit rounded bg-sky-700 px-4 py-2 disabled:opacity-40">
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </form>
      )}

      {message && <p role="status" className="text-emerald-300">{message}</p>}
      {error && !conflict && <p role="alert" className="text-red-400">{error}</p>}
    </section>
  );
}
