import { Controller, Get } from "@nestjs/common";

import { Public } from "../auth/public.decorator";

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
@Controller("healthz")
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env["APP_VERSION"] ?? "dev",
    };
  }
}
