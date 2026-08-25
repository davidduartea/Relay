"use server";

import { loginSchema, registerSchema } from "@relay/shared";
import type { AuthSession, AuthUser } from "@relay/shared";

import { INTERNAL_API_URL } from "@/lib/api-url";
import {
  clearSessionCookies,
  readAccessToken,
  readRefreshToken,
  writeSessionCookies,
} from "@/lib/session-cookies";

/**
 * Todo lo que toca credenciales, en el servidor.
 *
 * El navegador ya no ve ningún token: manda el formulario a un server action,
 * el servidor habla con el API y guarda la sesión en cookies `httpOnly`. Un
 * XSS que llegue a ejecutarse no encuentra nada que robar — ni access, ni
 * refresh.
 *
 * La protección contra CSRF la pone Next: para un server action compara la
 * cabecera `Origin` con el `Host` y rechaza la petición si no coinciden, así
 * que una web ajena no puede invocarlos aunque la cookie viaje sola. Sumado a
 * `SameSite=Lax`, no hace falta un token de CSRF propio.
 */

export interface ActionResult {
  /** Errores por campo, con la misma forma que devuelve el API. */
  fieldErrors?: Record<string, string>;
  /** Mensaje general: credenciales malas, correo repetido, API caído. */
  error?: string;
  /** Segundos que hay que esperar. Sólo llega con un 429. */
  retryAfter?: number;
}

interface ApiErrorBody {
  message?: string;
  errors?: { field: string; message: string }[];
}

/** Una llamada al API sin sesión: registro y acceso. */
async function authenticate(path: string, body: unknown): Promise<AuthSession | ActionResult> {
  let response: Response;

  try {
    response = await fetch(`${INTERNAL_API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    // El API no respondió. No hay nada que corregir en el formulario, así que
    // el mensaje lo dice de otra forma que un error de validación.
    return { error: "No se pudo conectar." };
  }

  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as ApiErrorBody;

    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After"));

      return {
        error: "Demasiados intentos",
        retryAfter: Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60,
      };
    }

    if (problem.errors?.length) {
      return {
        fieldErrors: Object.fromEntries(problem.errors.map((e) => [e.field, e.message])),
      };
    }

    return { error: problem.message ?? "Algo salió mal. Inténtalo de nuevo." };
  }

  return (await response.json()) as AuthSession;
}

/**
 * Entrar.
 *
 * Devuelve sólo el usuario. Los tokens no salen de aquí: se quedan en las
 * cookies, que es el punto entero de este archivo.
 */
export async function signIn(input: unknown): Promise<AuthUser | ActionResult> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: issuesToFields(parsed.error.issues) };
  }

  const result = await authenticate("/auth/login", parsed.data);

  if (!("user" in result)) {
    return result;
  }

  await writeSessionCookies(result.tokens);

  return result.user;
}

/** Crear cuenta. Deja la sesión abierta, igual que entrar. */
export async function signUp(input: unknown): Promise<AuthUser | ActionResult> {
  const parsed = registerSchema.safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: issuesToFields(parsed.error.issues) };
  }

  const result = await authenticate("/auth/register", parsed.data);

  if (!("user" in result)) {
    return result;
  }

  await writeSessionCookies(result.tokens);

  return result.user;
}

/**
 * Salir.
 *
 * Se avisa al API para que invalide el refresh token — sin eso, borrar la
 * cookie sólo lo olvida en este navegador y el token seguiría valiendo. Si esa
 * llamada falla, las cookies se borran igual: quien pulsa «Salir» tiene que
 * salir pase lo que pase.
 */
export async function signOut(): Promise<void> {
  const accessToken = await readAccessToken();

  if (accessToken) {
    await fetch(`${INTERNAL_API_URL}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }).catch(() => undefined);
  }

  await clearSessionCookies();
}

/**
 * El ticket para abrir el socket.
 *
 * Es lo único de la sesión que llega al navegador, y vive 60 segundos y un
 * solo uso. El cliente lo pide en cada conexión y en cada reconexión.
 */
export async function requestSocketTicket(): Promise<string | null> {
  const accessToken = await readAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${INTERNAL_API_URL}/auth/socket-ticket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const { ticket } = (await response.json()) as { ticket: string };

  return ticket;
}

/**
 * Quién está conectado, según el API.
 *
 * Se pregunta en vez de decodificar el token aquí: el servidor de Next no
 * tiene el secreto, así que decodificar sería leer sin verificar — y una
 * sesión revocada seguiría pareciendo válida.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const accessToken = await readAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${INTERNAL_API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  return (await response.json()) as AuthUser;
}

/**
 * Renueva la sesión con el refresh token.
 *
 * Lo llama el middleware antes de que el access caduque. Aquí también, como
 * red de seguridad para los actions que se encuentren un 401 — la rotación del
 * refresh la hace el API, así que cada renovación invalida la anterior.
 */
export async function refreshSession(): Promise<boolean> {
  const refreshToken = await readRefreshToken();

  if (!refreshToken) {
    return false;
  }

  const response = await fetch(`${INTERNAL_API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    await clearSessionCookies();

    return false;
  }

  const session = (await response.json()) as AuthSession;

  await writeSessionCookies(session.tokens);

  return true;
}

function issuesToFields(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  return Object.fromEntries(issues.map((issue) => [String(issue.path[0]), issue.message]));
}
