import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { loginSchema, refreshSchema, registerSchema } from "@relay/shared";
import type { AuthSession, JwtPayload, LoginInput, RefreshInput, RegisterInput } from "@relay/shared";

import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { Public } from "./public.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /auth/register — abierto, si no nadie podría crear la primera cuenta. */
  @Public()
  @Post("register")
  register(@Body(new ZodValidationPipe(registerSchema)) input: RegisterInput): Promise<AuthSession> {
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
  refresh(@Body(new ZodValidationPipe(refreshSchema)) input: RefreshInput): Promise<AuthSession> {
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
  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return { id: user.sub, email: user.email, displayName: user.name };
  }
}
