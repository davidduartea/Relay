import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { MessagesModule } from "../messages/messages.module";
import { RoomsModule } from "../rooms/rooms.module";
import { ChatGateway } from "./chat.gateway";

/**
 * El gateway de WebSocket.
 *
 * Importa `RoomsModule` y `MessagesModule` por sus exports — el mismo
 * `RoomsService` que usa el controlador HTTP. Que un provider exportado sirva
 * igual a un controlador y a un gateway es justo lo que hace que el módulo
 * valga la pena frente a una carpeta.
 */
@Module({
  imports: [RoomsModule, MessagesModule, JwtModule.register({})],
  providers: [ChatGateway],
})
export class ChatModule {}
