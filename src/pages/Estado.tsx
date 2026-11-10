import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { messageOf } from "../lib/errors";
import { useAuth } from "../lib/auth";
import { BUILD_SHA } from "../config";

export default function Estado() {
  const { me } = useAuth();
  const [clearance, setClearance] = useState<unknown>(null);
  const [checkResult, setCheckResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<unknown>("/clearance")
      .then(setClearance)
      .catch((err) => setError(messageOf(err)));
  }, []);

  async function runCheck() {
    setBusy(true);
    setError(null);
    try {
      setCheckResult(await api<unknown>("/clearance/check", { method: "POST" }));
      setClearance(await api<unknown>("/clearance"));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Estado del equipo</h1>
      <p className="text-sm text-slate-300">Build desplegado: <code>{BUILD_SHA}</code></p>
      {me && (
        <p className="text-sm text-slate-300">
          Piso de Pruebas: {me.clearance.granted ? "abierto" : "cerrado"}
        </p>
      )}
      <button
        type="button"
        onClick={runCheck}
        disabled={busy}
        className="w-fit rounded bg-sky-700 px-4 py-2 hover:bg-sky-600 disabled:opacity-50"
      >
        {busy ? "Revisando…" : "Abrir el Piso de Pruebas"}
      </button>
      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}
      {checkResult !== null && (
        <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs">{JSON.stringify(checkResult, null, 2)}</pre>
      )}
      {clearance !== null && (
        <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs">{JSON.stringify(clearance, null, 2)}</pre>
      )}
    </section>
  );
}
