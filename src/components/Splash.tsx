export function Splash({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-slate-400" role="status">
        {text}
      </p>
    </main>
  );
}

export function Connecting({ attempt, onRetry }: { attempt: number; onRetry: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Conectando con Lumon…</h1>
      <p className="text-slate-400" role="status">
        {attempt === 0 ? "Verificando el servicio." : `Reintentando automáticamente (intento ${attempt + 1}).`}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600"
      >
        Reintentar ahora
      </button>
    </main>
  );
}
