import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { loginSchema, refreshSchema, registerSchema } from "@relay/shared";
import type {
  AuthSession,
  JwtPayload,
  LoginInput,
  RefreshInput,
  RegisterInput,
} from "@relay/shared";

import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { THROTTLE_AUTH } from "../config/throttling";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { Public } from "./public.decorator";
import { SocketTicketService } from "./socket-ticket.service";

/**
 * Todo lo que toca credenciales corre bajo el límite estricto.
 *
 * Se aplica al controlador entero, no endpoint por endpoint: así un método
 * nuevo nace protegido. Es el mismo criterio que con `@Public()` — proteger
 * por defecto y hacer explícita la excepción.
 */
@Throttle({ [THROTTLE_AUTH]: {} })
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tickets: SocketTicketService,
  ) {}

  /** POST /auth/register — abierto, si no nadie podría crear la primera cuenta. */
  @Public()
  @Post("register")
  register(
    @Body(new ZodValidationPipe(registerSchema)) input: RegisterInput,
  ): Promise<AuthSession> {
    return this.auth.register(input);
  }

  /**
   * POST /auth/login
   *
   * 200 y no 201: no se está creando un recurso, se está abriendo una sesión.
   * Nest pone 201 por defecto en todo POST, así que hay que decirlo.
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body(new ZodValidationPipe(loginSchema)) input: LoginInput): Promise<AuthSession> {
    return this.auth.login(input);
  }

  /**
   * POST /auth/refresh
   *
   * Pública en cuanto a access token — precisamente se llama cuando el access
   * expiró. La credencial aquí es el refresh token del cuerpo, que el servicio
   * verifica contra el hash guardado.
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) input: RefreshInput,
  ): Promise<AuthSession> {
    return this.auth.refresh(input.refreshToken);
  }

  /** POST /auth/logout — protegida: sólo se cierra la sesión propia. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  logout(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.auth.logout(user.sub);
  }

  /**
   * GET /auth/me
   *
   * No consulta la base: todo lo que devuelve ya viaja dentro del token. Es la
   * forma barata de que el cliente sepa quién es tras recargar la página.
   */
  // SkipThrottle sin argumentos sólo salta el throttler llamado "default";
  // hay que nombrar el estricto para que tampoco cuente ahí.
  @SkipThrottle({ [THROTTLE_AUTH]: true })
  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return { id: user.sub, email: user.email, displayName: user.name };
  }

  /**
   * POST /auth/socket-ticket
   *
   * Devuelve una credencial de un solo uso y 60 segundos de vida, pensada
   * únicamente para el handshake del socket.
   *
   * Existe porque la sesión vive en cookies httpOnly que el JavaScript no ve,
   * y el handshake lo abre el navegador. En vez de devolverle la sesión, el
   * servidor de Next — que sí lee la cookie — pide esto y le pasa sólo el
   * ticket.
   *
   * Fuera del límite estricto de credenciales: se pide en cada reconexión del
   * socket, y una red inestable agotaría los cinco intentos por minuto en
   * segundos. Sigue protegida por el guard, así que hace falta una sesión
   * válida para llegar aquí.
   */
  @SkipThrottle({ [THROTTLE_AUTH]: true })
  @HttpCode(HttpStatus.OK)
  @Post("socket-ticket")
  socketTicket(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ ticket: string; expiresInSeconds: number }> {
    return this.tickets.issue(user);
  }
}
