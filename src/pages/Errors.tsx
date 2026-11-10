import { Link } from "react-router-dom";

export function NoPermission() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-2xl font-semibold">Sin permiso</h1>
      <p className="text-slate-400">Tu rol en esta cuadrilla no puede ver esta sección.</p>
      <Link to="/files" className="mt-4 inline-block underline">
        Volver a archivos
      </Link>
    </main>
  );
}

export function NotFound() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-2xl font-semibold">Página no encontrada</h1>
      <Link to="/files" className="underline">
        Ir a archivos
      </Link>
    </main>
  );
}
