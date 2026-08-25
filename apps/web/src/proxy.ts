import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { INTERNAL_API_URL } from "@/lib/api-url";
import { SESSION_COOKIES } from "@/lib/session-cookies";

/**
 * Guarda de rutas y renovación de la sesión, antes de renderizar nada.
 *
 * Se llama `proxy.ts` y no `middleware.ts`: en Next 16 el convenio
 * `middleware` está deprecado y renombrado, con la misma funcionalidad.
 * 📖 node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
 *
 * Hace dos cosas que sólo se pueden hacer aquí:
 *
 * 1. **Renovar el access token.** Un componente de servidor puede *leer*
 *    cookies pero no escribirlas; sólo un server action o esto pueden. Sin
 *    este paso, entrar en `/chat` con el access caducado mandaría al login
 *    aunque el refresh siguiera siendo válido.
 *
 * 2. **Redirigir según la sesión.** Antes lo hacía `ChatScreen` con un efecto,
 *    así que el navegador llegaba a pintar la pantalla del chat antes de
 *    rebotar. Aquí la decisión se toma antes de mandar nada.
 */

/** Rutas que exigen sesión. */
const PROTECTED = ["/chat"];

/** Rutas que no tienen sentido con la sesión abierta. */
const GUEST_ONLY = ["/login", "/register"];

/**
 * Margen antes de que caduque el access token.
 *
 * Renovar justo en el límite deja una carrera: el token puede expirar entre
 * que el proxy decide que sirve y el componente lo usa.
 */
const RENEW_WITHIN_SECONDS = 60;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const refreshToken = request.cookies.get(SESSION_COOKIES.refresh)?.value;
  const accessToken = request.cookies.get(SESSION_COOKIES.access)?.value;

  if (!refreshToken) {
    // Sin refresh no hay sesión que recuperar.
    return PROTECTED.some((route) => pathname.startsWith(route))
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.next();
  }

  if (GUEST_ONLY.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  if (accessToken && !expiresSoon(accessToken)) {
    return NextResponse.next();
  }

  return renew(request, refreshToken);
}

/**
 * Cambia el refresh por un par nuevo y lo deja en las cookies de la respuesta.
 *
 * El API rota el refresh en cada uso, así que el anterior deja de valer en
 * cuanto éste responde. Si rechaza, se limpian las cookies: conservarlas sólo
 * serviría para repetir el intento fallido en cada navegación.
 */
async function renew(request: NextRequest, refreshToken: string) {
  const apiResponse = await fetch(`${INTERNAL_API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  }).catch(() => null);

  const { pathname } = request.nextUrl;
  const protectedRoute = PROTECTED.some((route) => pathname.startsWith(route));

  if (!apiResponse?.ok) {
    const response = protectedRoute
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.next();

    response.cookies.delete(SESSION_COOKIES.access);
    response.cookies.delete(SESSION_COOKIES.refresh);

    return response;
  }

  const { tokens } = (await apiResponse.json()) as {
    tokens: { accessToken: string; refreshToken: string };
  };

  const response = NextResponse.next();

  response.cookies.set(SESSION_COOKIES.access, tokens.accessToken, {
    ...SESSION_COOKIES.base,
    maxAge: SESSION_COOKIES.accessMaxAge,
  });
  response.cookies.set(SESSION_COOKIES.refresh, tokens.refreshToken, {
    ...SESSION_COOKIES.base,
    maxAge: SESSION_COOKIES.refreshMaxAge,
  });

  return response;
}

/**
 * Si al token le queda menos de un minuto.
 *
 * Lee el `exp` del payload **sin verificar la firma**, que aquí es correcto:
 * el servidor de Next no tiene el secreto, y esto sólo decide si merece la
 * pena intentar una renovación. Quien verifica de verdad es el API, en cada
 * petición. Un token manipulado para parecer fresco no abre ninguna puerta —
 * sólo se salta una renovación y recibe un 401.
 */
function expiresSoon(token: string): boolean {
  const payload = token.split(".")[1];

  if (!payload) {
    return true;
  }

  try {
    const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };

    if (typeof exp !== "number") {
      return true;
    }

    return exp - Date.now() / 1000 < RENEW_WITHIN_SECONDS;
  } catch {
    return true;
  }
}

export const config = {
  /**
   * Sin `matcher` esto correría también sobre `_next/static`, las imágenes y
   * todo lo de `public/`. Además de gastar, la lógica de sesión podría acabar
   * bloqueando el CSS.
   */
  matcher: ["/chat/:path*", "/login", "/register"],
};
