import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { messageOf } from "../lib/errors";

interface Incident {
  id: number | string;
  description?: string;
  createdAt?: string;
}

export default function Incidents() {
  const [items, setItems] = useState<Incident[] | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api<Incident[] | { items: Incident[] }>("/incidents")
      .then((data) => setItems(Array.isArray(data) ? data : data.items))
      .catch((err) => setError(messageOf(err)));
  }

  useEffect(load, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Las fotos (1 a 3) no están implementadas: requieren el flujo de media con storage verificado.
      await api("/incidents", { method: "POST", body: JSON.stringify({ description }) });
      setDescription("");
      load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Incidencias</h1>
      <form onSubmit={create} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Descripción
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded bg-slate-900 p-2"
          />
        </label>
        <button type="submit" disabled={busy} className="w-fit rounded bg-sky-700 px-4 py-2 disabled:opacity-40">
          Reportar incidencia
        </button>
      </form>
      {error && <p role="alert" className="text-red-400">{error}</p>}
      {items === null && !error && <p role="status" className="text-slate-400">Cargando…</p>}
      {items && (
        <ul className="divide-y divide-slate-800 rounded border border-slate-800">
          {items.length === 0 && <li className="p-3 text-slate-400">Sin incidencias.</li>}
          {items.map((item) => (
            <li key={item.id} className="p-3">
              <p>{item.description ?? `Incidencia ${item.id}`}</p>
              {item.createdAt && <p className="text-xs text-slate-500">{item.createdAt}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
