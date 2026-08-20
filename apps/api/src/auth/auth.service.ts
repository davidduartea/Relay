import { randomUUID } from "node:crypto";

import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { JwtSignOptions } from "@nestjs/jwt";
import { hash, verify } from "@node-rs/argon2";
import { Prisma } from "@prisma/client";
import type {
  AuthSession,
  AuthUser,
  JwtPayload,
  LoginInput,
  RefreshPayload,
  RegisterInput,
  TokenPair,
} from "@relay/shared";

import { PrismaService } from "../prisma/prisma.service";

const UNIQUE_VIOLATION = "P2002";

type Expiry = NonNullable<JwtSignOptions["expiresIn"]>;

/**
 * Mensaje único para credenciales malas.
 *
 * Distinguir "ese correo no existe" de "la contraseña no coincide" le regala a
 * un atacante un oráculo para averiguar qué cuentas existen. Los dos caminos
 * responden lo mismo.
 */
const BAD_CREDENTIALS = "Correo o contraseña incorrectos";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterInput): Promise<AuthSession> {
    const passwordHash = await hash(input.password);

    try {
      const user = await this.prisma.user.create({
        data: { email: input.email, displayName: input.displayName, passwordHash },
        select: USER_SHAPE,
      });

      return this.startSession(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        throw new ConflictException("Ese correo ya está registrado");
      }

      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { ...USER_SHAPE, passwordHash: true },
    });

    if (!user) {
      // Se verifica igualmente contra un hash de descarte para que la
      // respuesta tarde lo mismo exista o no la cuenta. Sin esto, el tiempo de
      // respuesta delata qué correos están registrados.
      await verify(DUMMY_HASH, input.password).catch(() => false);
      throw new UnauthorizedException(BAD_CREDENTIALS);
    }

    const valid = await verify(user.passwordHash, input.password).catch(() => false);

    if (!valid) {
      throw new UnauthorizedException(BAD_CREDENTIALS);
    }

    const { passwordHash: _discard, ...profile } = user;

    return this.startSession(profile);
  }

  /**
   * Renueva la pareja de tokens y rota el refresh.
   *
   * La rotación es lo que convierte un refresh robado en un problema
   * detectable: si el atacante lo usa, el del usuario legítimo deja de valer y
   * el usuario nota que le cerraron la sesión.
   */
  async refresh(refreshToken: string): Promise<AuthSession> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { ...USER_SHAPE, refreshTokenHash: true },
    });

    // Sin hash guardado el usuario cerró sesión: la firma del token sigue
    // siendo válida, pero ya no corresponde a ninguna sesión viva.
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException("La sesión ya no es válida");
    }

    const matches = await verify(user.refreshTokenHash, refreshToken).catch(() => false);

    if (!matches) {
      throw new UnauthorizedException("La sesión ya no es válida");
    }

    const { refreshTokenHash: _discard, ...profile } = user;

    return this.startSession(profile);
  }

  /** Borra el hash: el refresh en circulación deja de servir de inmediato. */
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  private async startSession(user: AuthUser): Promise<AuthSession> {
    const tokens = await this.issueTokens(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await hash(tokens.refreshToken) },
    });

    return { user, tokens };
  }

  private async issueTokens(user: AuthUser): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email, name: user.displayName };

    // `jti` hace único cada refresh. Sin él, dos emitidos en el mismo segundo
    // comparten payload — `iat` va en segundos — y por tanto firma y string,
    // con lo que rotar el token no lo cambia y el anterior sigue sirviendo.
    const refreshPayload: RefreshPayload = { ...payload, jti: randomUUID() };

    // Se firman en paralelo porque son independientes; en serie sólo sumarían
    // latencia a cada login.
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.ttl("JWT_ACCESS_TTL"),
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.ttl("JWT_REFRESH_TTL"),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * `expiresIn` no acepta un string cualquiera: su tipo es la unión de
   * literales de la librería `ms` ("15m", "7d", …), que Zod no puede reproducir
   * sin duplicarla entera. El esquema de entorno ya comprobó el formato con una
   * expresión regular, así que aquí sólo se estrecha el tipo.
   */
  private ttl(key: "JWT_ACCESS_TTL" | "JWT_REFRESH_TTL"): Expiry {
    return this.config.getOrThrow<string>(key) as Expiry;
  }

  private async verifyRefreshToken(token: string): Promise<RefreshPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("La sesión ya no es válida");
    }
  }
}

const USER_SHAPE = { id: true, email: true, displayName: true } satisfies Prisma.UserSelect;

/**
 * Hash de argon2 de una contraseña cualquiera, sólo para quemar el mismo
 * tiempo cuando el correo no existe.
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$YXNkZmFzZGZhc2RmYXNkZmFzZGZhc2RmYXNkZmFzZGY";
