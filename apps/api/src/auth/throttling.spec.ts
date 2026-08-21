import { Controller, Get, INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { SkipThrottle, Throttle, ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { afterAll, beforeAll, describe, it } from "vitest";

import { ONE_MINUTE, THROTTLE_AUTH, THROTTLE_DEFAULT } from "../config/throttling";

const AUTH_LIMIT = 3;

/**
 * Réplica de la forma real del `AuthController`: límite estricto en la clase
 * y una ruta exenta. No se importa el de verdad para no arrastrar Prisma y la
 * base de datos a un test que sólo mira el freno.
 */
@Throttle({ [THROTTLE_AUTH]: {} })
@Controller("auth")
class FakeAuthController {
  @Get("login")
  login() {
    return { ok: true };
  }

  @SkipThrottle({ [THROTTLE_AUTH]: true })
  @Get("me")
  me() {
    return { ok: true };
  }
}

@Controller("rooms")
class FakeRoomsController {
  @Get()
  list() {
    return [];
  }
}

/**
 * El límite de peticiones, comprobado contra una app de Nest real.
 *
 * Es un test de integración y no unitario a propósito: lo que interesa no es
 * que la configuración tenga los números correctos, sino que el guard esté
 * enganchado y devuelva 429 cuando toca. Un test que sólo leyera el objeto de
 * configuración pasaría igual con el guard sin registrar.
 */
describe("límite de peticiones", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            { name: THROTTLE_DEFAULT, ttl: ONE_MINUTE, limit: 100 },
            { name: THROTTLE_AUTH, ttl: ONE_MINUTE, limit: AUTH_LIMIT },
          ],
        }),
      ],
      controllers: [FakeAuthController, FakeRoomsController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("deja pasar los intentos dentro del límite", async () => {
    for (let attempt = 0; attempt < AUTH_LIMIT; attempt++) {
      await request(app.getHttpServer()).get("/auth/login").expect(200);
    }
  });

  it("responde 429 al superar el límite en credenciales", async () => {
    // Los intentos del test anterior ya consumieron el cupo de esta IP: el
    // contador es por ventana de tiempo, no por test.
    await request(app.getHttpServer()).get("/auth/login").expect(429);
  });

  it("no gasta cupo en las rutas marcadas con SkipThrottle", async () => {
    // /auth/me la llama el cliente al cargar cada página. Si contara, navegar
    // por la aplicación agotaría el límite de credenciales sin intentar
    // ninguna contraseña.
    for (let attempt = 0; attempt < AUTH_LIMIT + 5; attempt++) {
      await request(app.getHttpServer()).get("/auth/me").expect(200);
    }
  });

  it("el resto de la aplicación sigue respondiendo con el límite de auth agotado", async () => {
    // Los dos límites son independientes: quedarse sin intentos de login no
    // puede dejar al usuario sin poder leer las salas.
    await request(app.getHttpServer()).get("/rooms").expect(200);
  });
});
