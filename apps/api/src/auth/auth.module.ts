import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";

import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { SocketTicketService } from "./socket-ticket.service";

/**
 * Autenticación.
 *
 * `JwtModule.register({})` va vacío a propósito: cada firma pasa su propio
 * secreto y su propia expiración, porque access y refresh usan claves
 * distintas. Configurar un secreto global aquí invitaría a olvidarse de
 * pasarlo y firmar el refresh con la clave del access.
 *
 * El provider `APP_GUARD` es lo que hace global al guard: se aplica a TODAS
 * las rutas de la aplicación, no sólo a las de este módulo. Es un token
 * especial de Nest, y por eso el guard se registra aquí aunque proteja
 * también `/rooms`.
 */
@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    SocketTicketService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, SocketTicketService],
})
export class AuthModule {}
