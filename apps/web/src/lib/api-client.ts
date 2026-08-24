import type { AuthSession, LoginInput, RegisterInput, Room } from "@relay/shared";

import { API_URL } from "./api-url";

/**
 * Cuánto esperar cuando el servidor corta por exceso de intentos y no dice
 * cuánto. Coincide con la ventana del throttler del API, que es de un minuto.
 */
const FALLBACK_RETRY_SECONDS = 60;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: { field: string; message: string }[] = [],
    /** Segundos que hay que esperar. Sólo viene con un 429. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  message?: string;
  errors?: { field: string; message: string }[];
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;

    // Los errores de validación del servidor llegan por campo, así que se
    // conservan tal cual: el formulario puede señalar el input concreto en vez
    // de mostrar un mensaje suelto arriba.
    throw new ApiError(
      response.status,
      body.message ?? "Algo salió mal. Inténtalo de nuevo.",
      body.errors ?? [],
      // Al pasarse del límite de intentos, el servidor dice en la cabecera
      // cuántos segundos faltan. Sin ese dato la única salida sería probar y
      // volver a fallar.
      retryAfterSeconds(response),
    );
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/**
 * Los segundos de espera que anuncia un 429.
 *
 * `Retry-After` es la cabecera estándar (RFC 9110 §10.2.3) y la que pone
 * `@nestjs/throttler` al cortar. Admite también una fecha, pero el throttler
 * siempre manda segundos, así que un valor no numérico se descarta en vez de
 * adivinar.
 */
function retryAfterSeconds(response: Response): number | undefined {
  if (response.status !== 429) {
    return undefined;
  }

  const seconds = Number(response.headers.get("Retry-After"));

  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : FALLBACK_RETRY_SECONDS;
}

export const api = {
  register: (input: RegisterInput) =>
    request<AuthSession>("/auth/register", { method: "POST", body: JSON.stringify(input) }),

  login: (input: LoginInput) =>
    request<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify(input) }),

  refresh: (refreshToken: string) =>
    request<AuthSession>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (accessToken: string) =>
    request<void>("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  rooms: () => request<Room[]>("/rooms"),
};
