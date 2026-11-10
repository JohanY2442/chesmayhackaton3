import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { messageOf } from "../lib/errors";

interface Challenge {
  token?: string;
  path?: string;
  [key: string]: unknown;
}

export default function Integraciones() {
  const [origin, setOrigin] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [verifyResult, setVerifyResult] = useState<unknown>(null);
  const [status, setStatus] = useState<unknown>(null);
  const [storageBody, setStorageBody] = useState("{\n  \n}");
  const [storageResult, setStorageResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refreshStatus() {
    api<unknown>("/integrations/status")
      .then(setStatus)
      .catch((err) => setError(messageOf(err)));
  }

  useEffect(refreshStatus, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      refreshStatus();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Integraciones</h1>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">Dominio desplegado</h2>
        <p className="text-sm text-slate-400">
          Escribe la URL https de tu despliegue (sin barra final). Después publica el token en
          <code> /.well-known/lumon-verification.txt</code> de esa app y verifica.
        </p>
        <input
          aria-label="Origen desplegado"
          placeholder="https://tu-app.vercel.app"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="rounded bg-slate-900 px-3 py-2"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !origin}
            onClick={() =>
              run(async () => {
                setChallenge(await api<Challenge>("/integrations/deploy/challenge", {
                  method: "POST",
                  body: JSON.stringify({ origin }),
                }));
              })
            }
            className="rounded bg-slate-800 px-3 py-1 disabled:opacity-40"
          >
            Pedir token
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                setVerifyResult(await api<unknown>("/integrations/deploy/verify", { method: "POST", body: "{}" }));
              })
            }
            className="rounded bg-sky-700 px-3 py-1 disabled:opacity-40"
          >
            Verificar dominio
          </button>
        </div>
        {challenge?.token && (
          <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs">{JSON.stringify(challenge, null, 2)}</pre>
        )}
        {verifyResult !== null && (
          <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs">{JSON.stringify(verifyResult, null, 2)}</pre>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">Storage de imágenes</h2>
        <p className="text-sm text-slate-400">
          Escribe la configuración en JSON (proveedor y valores públicos). Nunca pongas claves secretas aquí ni en el
          código: el formato exacto está en Swagger.
        </p>
        <textarea
          aria-label="Configuración del storage"
          rows={8}
          value={storageBody}
          onChange={(e) => setStorageBody(e.target.value)}
          className="rounded bg-slate-900 p-3 font-mono text-xs"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const parsed: unknown = JSON.parse(storageBody);
              setStorageResult(await api<unknown>("/integrations/storage", {
                method: "PUT",
                body: JSON.stringify(parsed),
              }));
            })
          }
          className="w-fit rounded bg-sky-700 px-3 py-1 disabled:opacity-40"
        >
          Registrar y verificar storage
        </button>
        {storageResult !== null && (
          <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs">{JSON.stringify(storageResult, null, 2)}</pre>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">Estado</h2>
        <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs">{JSON.stringify(status, null, 2)}</pre>
      </div>

      {error && <p role="alert" className="text-red-400">{error}</p>}
    </section>
  );
}
