import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SkipThrottle } from "@nestjs/throttler";

import { Public } from "../auth/public.decorator";
import { THROTTLE_AUTH, THROTTLE_DEFAULT } from "../config/throttling";

export interface HealthResponse {
  status: "ok";
  uptimeSeconds: number;
  version: string;
}

/**
 * Endpoint de liveness. Deliberadamente no toca la base de datos: si el
 * orquestador reinicia el contenedor cada vez que Postgres tiene un hipo,
 * convertimos una degradación en una caída. La comprobación de dependencias
 * va en un `/readyz` aparte cuando exista la base.
 */
// Público: un chequeo de liveness que exigiera credenciales no serviría
// para lo que existe — el orquestador no tiene sesión.
@Public()
/**
 * Y fuera de los dos limitadores.
 *
 * Este endpoint existe **para que lo sondeen sin parar**: el orquestador lo
 * llama cada pocos segundos para decidir si el contenedor sigue vivo.
 * Limitarlo es contradecir su propósito.
 *
 * No es teórico. En Render tumbó el servicio: el sondeo agotaba el cupo por
 * IP, la comprobación recibía un 429, Render daba la instancia por caída y
 * reintentaba más fuerte — con lo que llegaban más 429. Un bucle que en los
 * logs de la aplicación no deja ni rastro, porque el proceso nunca falla.
 *
 * Se nombran los dos limitadores: `@SkipThrottle()` sin argumentos sólo salta
 * el que se llama «default».
 */
@SkipThrottle({ [THROTTLE_DEFAULT]: true, [THROTTLE_AUTH]: true })
@Controller("healthz")
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check(): HealthResponse {
    return {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      version: this.config.getOrThrow<string>("APP_VERSION"),
    };
  }
}
