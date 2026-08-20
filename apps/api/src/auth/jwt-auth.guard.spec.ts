import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JwtAuthGuard } from "./jwt-auth.guard";
import type { AuthenticatedRequest } from "./jwt-auth.guard";

const ACCESS_SECRET = "a".repeat(32);

/** Construye un ExecutionContext con la cabecera que interese. */
function contextWith(authorization?: string) {
  const request = { headers: authorization ? { authorization } : {} } as AuthenticatedRequest;

  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => vi.fn(),
      getClass: () => vi.fn(),
    } as unknown as ExecutionContext,
  };
}

describe("JwtAuthGuard", () => {
  const reflector = { getAllAndOverride: vi.fn() };

  let guard: JwtAuthGuard;
  let jwt: JwtService;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [JwtAuthGuard, JwtService, ConfigService, Reflector],
    })
      .overrideProvider(ConfigService)
      .useValue({ getOrThrow: () => ACCESS_SECRET })
      .overrideProvider(Reflector)
      .useValue(reflector)
      .compile();

    guard = moduleRef.get(JwtAuthGuard);
    jwt = moduleRef.get(JwtService);
  });

  it("deja pasar una ruta marcada como pública sin mirar la cabecera", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context } = contextWith();

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rechaza cuando no hay cabecera Authorization", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { context } = contextWith();

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("rechaza un esquema que no sea Bearer", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const token = await jwt.signAsync({ sub: "u1" }, { secret: ACCESS_SECRET });
    const { context } = contextWith(`Basic ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("acepta 'bearer' en minúsculas: el esquema HTTP no distingue mayúsculas", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const token = await jwt.signAsync({ sub: "u1", email: "a@b.c" }, { secret: ACCESS_SECRET });
    const { context } = contextWith(`bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rechaza un token firmado con otro secreto", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const token = await jwt.signAsync({ sub: "u1" }, { secret: "b".repeat(32) });
    const { context } = contextWith(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("rechaza un token expirado", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const token = await jwt.signAsync(
      { sub: "u1" },
      { secret: ACCESS_SECRET, expiresIn: "-1s" },
    );
    const { context } = contextWith(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("cuelga el payload del request para que lo lea @CurrentUser", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const token = await jwt.signAsync(
      { sub: "u1", email: "ana@relay.dev", name: "Ana" },
      { secret: ACCESS_SECRET },
    );
    const { context, request } = contextWith(`Bearer ${token}`);

    await guard.canActivate(context);

    expect(request.user).toMatchObject({ sub: "u1", email: "ana@relay.dev", name: "Ana" });
  });
});
