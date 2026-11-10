import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { fieldOf, messageOf } from "../lib/errors";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ field: string | null; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors(null);
    try {
      await register(teamName, email, password);
      navigate("/files", { replace: true });
    } catch (err) {
      setErrors({ field: fieldOf(err), message: messageOf(err) });
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (name: string) =>
    errors?.field === name ? (
      <span role="alert" className="text-xs text-red-400">
        {errors.message}
      </span>
    ) : null;

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-semibold">Registrar cuadrilla</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Nombre de la cuadrilla
          <input
            required
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="rounded bg-slate-900 px-3 py-2"
          />
          {fieldError("teamName")}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded bg-slate-900 px-3 py-2"
          />
          {fieldError("email")}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Contraseña
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded bg-slate-900 px-3 py-2"
          />
          {fieldError("password")}
        </label>
        {errors && errors.field === null && (
          <p role="alert" className="text-sm text-red-400">
            {errors.message}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-sky-700 px-4 py-2 hover:bg-sky-600 disabled:opacity-50"
        >
          {busy ? "Registrando…" : "Registrar"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/login" className="underline">
          Ya tengo cuenta
        </Link>
      </p>
    </main>
  );
}
