import type { ThrottlerModuleOptions } from "@nestjs/throttler";

import { loadEnvironment } from "./environment";

/**
 * Límites de peticiones.
 *
 * Dos nombres en vez de uno, porque los endpoints de credenciales necesitan
 * un techo mucho más bajo que el resto: en `/auth/login` cada intento es una
 * contraseña probada, mientras que en `/rooms` sólo es una lectura.
 *
 * Los límites se aplican por IP. Eso deja fuera al atacante distribuido, que
 * se combate con otras herramientas — pero corta en seco el caso común, que
 * es un script desde una sola máquina.
 */
export const THROTTLE_DEFAULT = "default";
export const THROTTLE_AUTH = "auth";

export const ONE_MINUTE = 60_000;

export function buildThrottlingOptions(env = loadEnvironment()): ThrottlerModuleOptions {
  return {
    throttlers: [
      { name: THROTTLE_DEFAULT, ttl: ONE_MINUTE, limit: env.DEFAULT_RATE_LIMIT },

      // Por defecto 5 intentos por minuto: suficiente para quien se equivoca
      // al teclear, inservible para probar un diccionario.
      { name: THROTTLE_AUTH, ttl: ONE_MINUTE, limit: env.AUTH_RATE_LIMIT },
    ],
  };
}
