import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { JwtPayload } from "@relay/shared";

import type { AuthenticatedRequest } from "./jwt-auth.guard";

/**
 * Inyecta el usuario autenticado en un parámetro del handler.
 *
 * Evita repetir `@Req() req` y `req.user` en cada método, y de paso da un tipo
 * decente: `@Req()` devuelve el request entero, donde `user` es opcional y hay
 * que comprobarlo aunque el guard ya garantice que está.
 *
 * Se ejecuta DESPUÉS de los guards, que es justo lo que lo hace seguro: si el
 * guard no dejó pasar, este código nunca corre.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      // Sólo puede pasar si alguien pone @CurrentUser en una ruta @Public.
      throw new Error("@CurrentUser requiere una ruta protegida por JwtAuthGuard");
    }

    return request.user;
  },
);
