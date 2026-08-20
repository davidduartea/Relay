import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { HealthController } from "./health.controller";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    // Se construye a través del TestingModule y no con `new HealthController()`
    // a propósito: así el test también verifica que el contenedor de DI puede
    // resolver el controlador. Cuando gane dependencias, el test no cambia.
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

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

  it("cae a 'dev' cuando no hay APP_VERSION en el entorno", () => {
    delete process.env["APP_VERSION"];

    expect(controller.check().version).toBe("dev");
  });
});
