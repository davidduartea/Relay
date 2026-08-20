import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "@node-rs/argon2";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

const ENV: Record<string, string> = {
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  JWT_ACCESS_TTL: "15m",
  JWT_REFRESH_TTL: "7d",
};

const PROFILE = { id: "u1", email: "ana@relay.dev", displayName: "Ana" };
const PASSWORD = "contrasena-larga-123";

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6",
  });

describe("AuthService", () => {
  const user = { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() };

  let service: AuthService;

  beforeEach(async () => {
    vi.resetAllMocks();
    user.update.mockResolvedValue(PROFILE);

    const moduleRef = await Test.createTestingModule({
      providers: [AuthService, PrismaService, JwtService, ConfigService],
    })
      .overrideProvider(PrismaService)
      .useValue({ user })
      .overrideProvider(ConfigService)
      .useValue({ getOrThrow: (key: string) => ENV[key] })
      .compile();

    service = moduleRef.get(AuthService);
  });

  describe("register", () => {
    it("no guarda la contraseña en claro", async () => {
      user.create.mockResolvedValue(PROFILE);

      await service.register({ ...PROFILE, password: PASSWORD });

      const stored = user.create.mock.calls[0]?.[0].data.passwordHash;
      expect(stored).not.toBe(PASSWORD);
      expect(stored).toMatch(/^\$argon2id\$/);
    });

    it("convierte el correo repetido en 409", async () => {
      user.create.mockRejectedValue(uniqueViolation());

      await expect(service.register({ ...PROFILE, password: PASSWORD })).rejects.toThrow(
        ConflictException,
      );
    });

    it("guarda el refresh token hasheado, nunca en claro", async () => {
      user.create.mockResolvedValue(PROFILE);

      const session = await service.register({ ...PROFILE, password: PASSWORD });

      const stored = user.update.mock.calls[0]?.[0].data.refreshTokenHash;
      expect(stored).not.toBe(session.tokens.refreshToken);
      expect(stored).toMatch(/^\$argon2id\$/);
    });
  });

  describe("login", () => {
    it("devuelve una sesión con la contraseña correcta", async () => {
      user.findUnique.mockResolvedValue({ ...PROFILE, passwordHash: await hash(PASSWORD) });

      const session = await service.login({ email: PROFILE.email, password: PASSWORD });

      expect(session.user).toEqual(PROFILE);
      expect(session.tokens.accessToken).toEqual(expect.any(String));
    });

    it("nunca devuelve el hash de la contraseña al llamador", async () => {
      user.findUnique.mockResolvedValue({ ...PROFILE, passwordHash: await hash(PASSWORD) });

      const session = await service.login({ email: PROFILE.email, password: PASSWORD });

      expect(session.user).not.toHaveProperty("passwordHash");
    });

    it("rechaza la contraseña incorrecta", async () => {
      user.findUnique.mockResolvedValue({ ...PROFILE, passwordHash: await hash(PASSWORD) });

      await expect(
        service.login({ email: PROFILE.email, password: "equivocada" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("da el mismo mensaje exista o no la cuenta", async () => {
      // Un mensaje distinto por caso le diría a un atacante qué correos están
      // registrados sin necesidad de adivinar contraseñas.
      user.findUnique.mockResolvedValue({ ...PROFILE, passwordHash: await hash(PASSWORD) });
      const wrongPassword = await service
        .login({ email: PROFILE.email, password: "equivocada" })
        .catch((error: Error) => error.message);

      user.findUnique.mockResolvedValue(null);
      const noAccount = await service
        .login({ email: "nadie@relay.dev", password: PASSWORD })
        .catch((error: Error) => error.message);

      expect(wrongPassword).toBe(noAccount);
    });
  });

  describe("issueTokens", () => {
    it("emite refresh tokens distintos en llamadas consecutivas", async () => {
      // REGRESIÓN: sin un `jti` único, dos tokens firmados dentro del mismo
      // segundo salen idénticos — `iat` va en segundos, así que el payload
      // entero coincide y con él la firma. La rotación entonces no rota nada y
      // un refresh robado sigue sirviendo tras la renovación del usuario.
      user.create.mockResolvedValue(PROFILE);

      const first = await service.register({ ...PROFILE, password: PASSWORD });
      const second = await service.register({ ...PROFILE, password: PASSWORD });

      expect(first.tokens.refreshToken).not.toBe(second.tokens.refreshToken);
    });

    it("firma access y refresh con secretos distintos", async () => {
      user.create.mockResolvedValue(PROFILE);
      const jwt = new JwtService();

      const { tokens } = await service.register({ ...PROFILE, password: PASSWORD });

      // El access no debe verificar contra la clave del refresh: si lo hiciera,
      // un access interceptado valdría para renovar la sesión indefinidamente.
      await expect(
        jwt.verifyAsync(tokens.accessToken, { secret: ENV["JWT_REFRESH_SECRET"] }),
      ).rejects.toThrow();
    });

    it("no mete nada sensible en el token", async () => {
      // Un JWT va firmado, no cifrado: cualquiera con el token lee el payload.
      user.create.mockResolvedValue(PROFILE);

      const { tokens } = await service.register({ ...PROFILE, password: PASSWORD });
      const [, body] = tokens.accessToken.split(".");
      const payload = JSON.parse(Buffer.from(body ?? "", "base64url").toString()) as object;

      expect(Object.keys(payload).sort()).toEqual(["email", "exp", "iat", "name", "sub"]);
    });
  });

  describe("refresh", () => {
    it("rechaza un token que no corresponde al hash guardado", async () => {
      user.create.mockResolvedValue(PROFILE);
      const { tokens } = await service.register({ ...PROFILE, password: PASSWORD });

      // El usuario ya rotó: la base guarda el hash de OTRO token.
      user.findUnique.mockResolvedValue({
        ...PROFILE,
        refreshTokenHash: await hash("un-refresh-token-distinto"),
      });

      await expect(service.refresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it("rechaza cuando el usuario cerró sesión", async () => {
      user.create.mockResolvedValue(PROFILE);
      const { tokens } = await service.register({ ...PROFILE, password: PASSWORD });

      user.findUnique.mockResolvedValue({ ...PROFILE, refreshTokenHash: null });

      await expect(service.refresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it("rechaza un access token usado como refresh", async () => {
      user.create.mockResolvedValue(PROFILE);
      const { tokens } = await service.register({ ...PROFILE, password: PASSWORD });

      await expect(service.refresh(tokens.accessToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("logout", () => {
    it("borra el hash para invalidar el refresh en circulación", async () => {
      await service.logout("u1");

      expect(user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { refreshTokenHash: null },
      });
    });
  });
});
