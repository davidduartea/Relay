import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { MessagesModule } from "../messages/messages.module";
import { RoomsModule } from "../rooms/rooms.module";
import { ChatGateway } from "./chat.gateway";
import { MessageRateLimiter } from "./message-rate-limiter";

/**
 * El gateway de WebSocket.
 *
 * Importa `RoomsModule` y `MessagesModule` por sus exports — el mismo
 * `RoomsService` que usa el controlador HTTP. Que un provider exportado sirva
 * igual a un controlador y a un gateway es justo lo que hace que el módulo
 * valga la pena frente a una carpeta.
 */
@Module({
  // `AuthModule` por `SocketTicketService`: el handshake canjea el ticket que
  // emite el endpoint de auth, así que el mismo almacén de `jti` gastados tiene
  // que servir a los dos lados.
  imports: [RoomsModule, MessagesModule, AuthModule],
  providers: [ChatGateway, MessageRateLimiter],
})
export class ChatModule {}
