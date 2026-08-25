import "server-only";

import { cookies } from "next/headers";
import type { TokenPair } from "@relay/shared";

/**
 * Dónde vive la sesión ahora.
 *
 * En cookies `httpOnly` del origen de Next, no en `localStorage`. La
 * diferencia es lo que este módulo existe para conseguir: un script inyectado
 * por XSS puede leer `localStorage` entero, y no puede leer estas cookies —
 * el navegador no se las enseña al JavaScript, sólo las manda en las
 * peticiones.
 *
 * `import "server-only"` hace que el build falle si alguien importa esto desde
 * un componente de cliente. Es la red de seguridad: sin ella, el error sería
 * un `cookies is not a function` en tiempo de ejecución, y sólo en la rama de
 * código que nadie probó.
 */

const ACCESS_COOKIE = "relay_access";
const REFRESH_COOKIE = "relay_refresh";

/**
 * Cuánto vive cada cookie en el navegador.
 *
 * Se corresponde con la vida de cada token en el servidor. La del access no
 * tiene por qué ser exacta — el API la verifica igual —, pero una cookie que
 * sobrevive a su token sólo sirve para provocar un 401 evitable.
 */
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

const BASE = {
  httpOnly: true,
  /**
   * `lax` y no `strict`.
   *
   * Con `strict`, volver a la aplicación desde un enlace externo llegaría sin
   * cookie y parecería una sesión caducada. `lax` la manda en la navegación
   * de nivel superior y la retiene en las peticiones que originan otros
   * sitios, que es de donde vendría un CSRF.
   */
  sameSite: "lax",
  /**
   * Sólo por HTTPS en producción. En desarrollo se sirve por http y una cookie
   * `secure` no llegaría nunca.
   */
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export async function writeSessionCookies(tokens: TokenPair): Promise<void> {
  const jar = await cookies();

  jar.set(ACCESS_COOKIE, tokens.accessToken, { ...BASE, maxAge: ACCESS_MAX_AGE });
  jar.set(REFRESH_COOKIE, tokens.refreshToken, { ...BASE, maxAge: REFRESH_MAX_AGE });
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();

  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function readAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function readRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

/** Los nombres, para el middleware — que lee las cookies de otra forma. */
export const SESSION_COOKIES = {
  access: ACCESS_COOKIE,
  refresh: REFRESH_COOKIE,
  accessMaxAge: ACCESS_MAX_AGE,
  refreshMaxAge: REFRESH_MAX_AGE,
  base: BASE,
} as const;
