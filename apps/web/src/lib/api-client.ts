import type { AuthSession, LoginInput, RegisterInput, Room } from "@relay/shared";

export const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: { field: string; message: string }[] = [],
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
    );
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
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
