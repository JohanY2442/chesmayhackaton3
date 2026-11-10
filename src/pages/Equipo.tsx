import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { messageOf } from "../lib/errors";
import { useAuth } from "../lib/auth";

interface Member {
  nombre: string;
  codigo: string;
}

const EMPTY: Member[] = [
  { nombre: "", codigo: "" },
  { nombre: "", codigo: "" },
  { nombre: "", codigo: "" },
];

export default function Equipo() {
  const { can } = useAuth();
  const [members, setMembers] = useState<Member[]>(EMPTY);
  const [chaos, setChaos] = useState<0 | 1 | 2>(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canManage = can("team:manage");

  useEffect(() => {
    api<{ integrantes?: Member[] }>("/team/roster")
      .then((data) => {
        if (Array.isArray(data.integrantes) && data.integrantes.length > 0) {
          setMembers([...data.integrantes, ...EMPTY].slice(0, 3));
        }
      })
      .catch((err) => setError(messageOf(err)));
  }, []);

  async function saveRoster(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      // Formato asumido a partir de hackathon.json; verificar contra Swagger.
      await api("/team/roster", { method: "PUT", body: JSON.stringify({ integrantes: members }) });
      setMessage("Integrantes inscritos.");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveChaos(level: 0 | 1 | 2) {
    setBusy(true);
    setError(null);
    try {
      await api("/workspace/chaos", { method: "PUT", body: JSON.stringify({ level }) });
      setChaos(level);
      setMessage(`Modo caos en nivel ${level}.`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Equipo</h1>

      <form onSubmit={saveRoster} className="flex flex-col gap-3">
        <h2 className="font-semibold">Integrantes (3)</h2>
        {members.map((member, index) => (
          <div key={index} className="flex flex-wrap gap-2">
            <input
              aria-label={`Nombre ${index + 1}`}
              placeholder="Nombre"
              value={member.nombre}
              disabled={!canManage}
              onChange={(e) => setMembers((list) => list.map((m, i) => (i === index ? { ...m, nombre: e.target.value } : m)))}
              className="rounded bg-slate-900 px-3 py-2 disabled:opacity-50"
            />
            <input
              aria-label={`Código ${index + 1}`}
              placeholder="Código UTEC"
              value={member.codigo}
              disabled={!canManage}
              onChange={(e) => setMembers((list) => list.map((m, i) => (i === index ? { ...m, codigo: e.target.value } : m)))}
              className="rounded bg-slate-900 px-3 py-2 disabled:opacity-50"
            />
          </div>
        ))}
        {canManage ? (
          <button type="submit" disabled={busy} className="w-fit rounded bg-sky-700 px-4 py-2 disabled:opacity-50">
            Guardar integrantes
          </button>
        ) : (
          <p className="text-sm text-slate-400">Tu rol no puede modificar el equipo.</p>
        )}
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">Modo caos (para probar)</h2>
        <div className="flex gap-2">
          {([0, 1, 2] as const).map((level) => (
            <button
              key={level}
              type="button"
              disabled={busy || !canManage}
              onClick={() => saveChaos(level)}
              className={`rounded px-3 py-1 disabled:opacity-40 ${chaos === level ? "bg-amber-700" : "bg-slate-800"}`}
            >
              Nivel {level}
            </button>
          ))}
        </div>
      </div>

      {message && <p role="status" className="text-emerald-300">{message}</p>}
      {error && <p role="alert" className="text-red-400">{error}</p>}
    </section>
  );
}
