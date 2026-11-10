import { ApiError } from "./api";

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Email o contraseña incorrectos.",
  EMAIL_TAKEN: "Ese email ya está registrado.",
  TEAM_NAME_TAKEN: "Ya existe una cuadrilla con ese nombre.",
  NETWORK: "Sin conexión con Lumon. Reintenta en un momento.",
  CLEARANCE_REQUIRED: "Este recurso está en el Piso de Pruebas. Debes pasar la revisión automática primero.",
};

export function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? error.message;
  }
  return "Algo salió mal. Intenta de nuevo.";
}

/** Campo del formulario al que corresponde el error, si el servidor lo indica en details.field. */
export function fieldOf(error: unknown): string | null {
  if (error instanceof ApiError && error.details && typeof error.details === "object") {
    const field = (error.details as { field?: unknown }).field;
    if (typeof field === "string") return field;
  }
  return null;
}
