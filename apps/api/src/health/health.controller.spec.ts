import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { HealthController } from "./health.controller";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    // Se construye a través del TestingModule y no con `new HealthController()`
    // a propósito: así el test también verifica que el contenedor de DI puede
    // resolver el controlador con todas sus dependencias.
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [ConfigService],
    })
      .overrideProvider(ConfigService)
      .useValue({ getOrThrow: () => "1.2.3" })
      .compile();

    controller = moduleRef.get(HealthController);
  });

  it("reporta estado ok", () => {
    expect(controller.check().status).toBe("ok");
  });

  it("reporta el uptime como entero de segundos", () => {
    const { uptimeSeconds } = controller.check();

    expect(uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(uptimeSeconds)).toBe(true);
  });

  it("devuelve la versión que dice la configuración", () => {
    // Sale del esquema de entorno validado, no de `process.env` directamente:
    // así una variable ausente la cubre el valor por defecto del esquema, en
    // un solo sitio.
    expect(controller.check().version).toBe("1.2.3");
  });
});
