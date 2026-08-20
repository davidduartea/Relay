import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { JwtPayload } from "@relay/shared";
import type { Request } from "express";

import { IS_PUBLIC } from "./public.decorator";

/** El usuario autenticado, colgado del request para que lo lea el decorador. */
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Deja pasar sólo peticiones con un access token válido.
 *
 * Un guard responde una única pregunta — ¿puede pasar esto? — y sólo puede
 * devolver true o lanzar. Validar la *forma* del payload es trabajo de un
 * pipe; decidir *quién* entra es de un guard. Mezclarlos es el error clásico.
 *
 * Este guard se registra global en AuthModule, así que protege todo por
 * defecto. Las rutas abiertas se marcan con `@Public()`. El orden importa:
 * una lista blanca de rutas privadas se olvida al añadir un endpoint nuevo;
 * una de rutas públicas falla hacia el lado seguro.
 *
 * No se usa Passport a propósito. Para un JWT simétrico añade una capa de
 * indirección — estrategias, serializadores — sobre lo que aquí son doce
 * líneas legibles.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // getAllAndOverride mira primero el handler y luego la clase: así un
    // controlador entero puede ser público y un método suyo volver a exigir
    // sesión, o al revés.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Falta el token de acceso");
    }

    try {
      request.user = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
    } catch {
      // El motivo real — expirado, firma mala, malformado — se queda dentro.
      // Decirle a quien prueba tokens cuál de los tres falló le ahorra trabajo.
      throw new UnauthorizedException("Token inválido o expirado");
    }

    return true;
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  const [scheme, token] = header?.split(" ") ?? [];

  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}
