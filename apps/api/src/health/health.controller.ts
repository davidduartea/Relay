import { Controller, Get } from "@nestjs/common";

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
