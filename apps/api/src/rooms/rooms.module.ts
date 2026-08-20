import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";

/**
 * Un módulo de funcionalidad: agrupa todo lo que tiene que ver con salas.
 *
 * Las cuatro llaves del decorador son el contrato del módulo:
 *
 *   imports      de qué otros módulos necesito los exports
 *   controllers  quién atiende peticiones HTTP
 *   providers    qué puede inyectarse DENTRO de este módulo
 *   exports      qué de lo mío pueden usar los módulos que me importen
 *
 * `PrismaModule` está en `imports` porque `RoomsService` inyecta su
 * `PrismaService`, y un provider sólo es visible para otro módulo si el módulo
 * dueño lo exporta y el consumidor lo importa. Las dos mitades hacen falta.
 *
 * `RoomsService` va en `providers` y además en `exports`: sin exportarlo, el
 * gateway de WebSocket de la fase 1 no podría inyectarlo aunque importara este
 * módulo. Un provider no exportado es privado del módulo — ese encapsulamiento
 * es la diferencia entre un módulo y una carpeta.
 */
@Module({
  imports: [PrismaModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
