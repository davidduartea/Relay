import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from "@nestjs/websockets";
import {
  ackError,
  ackOk,
  joinRoomSchema,
  sendMessageSchema,
  typingSchema,
} from "@relay/shared";
import type {
  Ack,
  ClientToServerEvents,
  Message,
  PresenceUser,
  ServerToClientEvents,
  SocketData,
} from "@relay/shared";
import type { Server, Socket } from "socket.io";

import { SocketTicketService } from "../auth/socket-ticket.service";
import { loadWebOrigin } from "../config/environment";
import { MessagesService } from "../messages/messages.service";
import { RoomsService } from "../rooms/rooms.service";

/**
 * El socket, tipado con el contrato compartido.
 *
 * Los genéricos de Socket.IO toman los mismos tipos que usa el cliente en
 * `apps/web`. Emitir un evento que no está en `ServerToClientEvents`, o
 * pasarle un payload de otra forma, no compila — ni aquí ni allá.
 */
type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, never, SocketData>;
type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>;

/**
 * El CORS del socket sale del mismo esquema validado que el de HTTP.
 *
 * No se puede inyectar `ConfigService` aquí: los argumentos de un decorador se
 * evalúan al **cargar la clase**, antes de que exista el contenedor de
 * dependencias. Por eso se lee directamente del esquema — un origen mal
 * formado falla igual, en vez de colarse con el valor por defecto de un `??`.
 *
 * `loadWebOrigin` y no `loadEnvironment` a propósito: esto corre al importar
 * el archivo, y exigir el entorno entero obligaría a tener base de datos y
 * secretos sólo para poder importarlo.
 */
@WebSocketGateway({
  namespace: "/chat",
  cors: { origin: loadWebOrigin(), credentials: true },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: ChatServer;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly messages: MessagesService,
    private readonly rooms: RoomsService,
    private readonly tickets: SocketTicketService,
  ) {}

  /**
   * Autentica en el handshake, antes de que la conexión llegue a existir.
   *
   * El guard global de HTTP no cubre WebSockets: no hay cabeceras por mensaje,
   * hay un handshake y luego una conexión abierta. Verificar aquí significa
   * que un socket conectado ya es un socket autenticado, y los handlers no
   * tienen que volver a preguntarlo.
   *
   * Va en un middleware y no en `handleConnection` porque ahí el cliente ya
   * recibió su evento `connect` y sólo después se le echa: para él es
   * indistinguible de una caída de red, así que su lógica de reconexión
   * reintenta en bucle con el mismo token malo. Rechazar en el middleware le
   * llega como `connect_error`, que sí puede distinguir.
   *
   * Lo que viaja es un **ticket de un solo uso**, no la sesión: ésta vive en
   * una cookie httpOnly que el navegador no puede leer. Va en `auth` del
   * handshake y no en la query string, porque las query strings acaban en los
   * logs del proxy.
   */
  afterInit(server: ChatServer): void {
    server.use((socket, next) => {
      const ticket = socket.handshake.auth["ticket"] as unknown;

      if (typeof ticket !== "string" || !ticket) {
        return next(new Error("Falta el ticket de conexión"));
      }

      // Se canjea, no se verifica: el ticket vale una sola vez. Un segundo
      // handshake con el mismo se rechaza aunque la firma siga siendo válida.
      this.tickets
        .redeem(ticket)
        .then((payload) => {
          socket.data.userId = payload.sub;
          socket.data.displayName = payload.name;
          next();
        })
        .catch(() => next(new Error("Ticket inválido, caducado o ya usado")));
    });
  }

  handleConnection(client: ChatSocket): void {
    // `disconnecting` y no `disconnect`: cuando salta el segundo, Socket.IO ya
    // vació `client.rooms` y no quedaría a quién avisar. En el primero las
    // salas siguen ahí.
    client.on("disconnecting", () => {
      for (const roomId of this.joinedRooms(client)) {
        client.to(roomId).emit("presence:leave", { roomId, userId: client.data.userId });
      }
    });
  }

  handleDisconnect(client: ChatSocket): void {
    this.logger.debug(`Desconectado ${client.data.userId ?? "(sin identificar)"}`);
  }

  @SubscribeMessage("room:join")
  async onJoin(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<Ack<{ roomId: string }>> {
    const parsed = joinRoomSchema.safeParse(payload);

    if (!parsed.success) {
      return ackError("VALIDATION_FAILED", "roomId inválido");
    }

    const { roomId } = parsed.data;

    if (!(await this.rooms.existsById(roomId))) {
      return ackError("ROOM_NOT_FOUND", "Esa sala no existe");
    }

    await client.join(roomId);

    const user: PresenceUser = {
      id: client.data.userId,
      displayName: client.data.displayName,
    };

    // El historial va sólo a quien entra; la presencia, a todos menos a él —
    // ya se sabe presente, y verse aparecer a uno mismo es ruido.
    client.emit("message:history", { roomId, messages: await this.messages.history(roomId) });
    client.emit("presence:sync", { roomId, users: await this.presenceIn(roomId) });
    client.to(roomId).emit("presence:join", { roomId, user });

    return ackOk({ roomId });
  }

  @SubscribeMessage("room:leave")
  async onLeave(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<Ack<{ roomId: string }>> {
    const parsed = joinRoomSchema.safeParse(payload);

    if (!parsed.success) {
      return ackError("VALIDATION_FAILED", "roomId inválido");
    }

    const { roomId } = parsed.data;
    await client.leave(roomId);

    this.server.to(roomId).emit("presence:leave", { roomId, userId: client.data.userId });

    return ackOk({ roomId });
  }

  @SubscribeMessage("message:send")
  async onMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<Ack<Message>> {
    const parsed = sendMessageSchema.safeParse(payload);

    if (!parsed.success) {
      // Se devuelve por acknowledgement en vez de lanzar: una excepción en un
      // gateway llega al cliente como un evento suelto de error, sin forma de
      // saber qué envío la provocó. El ack va atado a esta llamada concreta.
      return ackError(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "Mensaje inválido",
      );
    }

    const { roomId, body, clientId } = parsed.data;

    // Pertenecer a la sala es la autorización: sin esta comprobación,
    // cualquiera con sesión podría escribir en salas donde no ha entrado.
    if (!client.rooms.has(roomId)) {
      return ackError("FORBIDDEN", "No estás en esa sala");
    }

    try {
      const message = await this.messages.create({
        roomId,
        body,
        clientId,
        authorId: client.data.userId,
      });

      // A la sala entera, incluido el autor: así el mensaje confirmado llega
      // por el mismo camino a todos y el cliente reconcilia su copia optimista
      // con `clientId` sin tener dos rutas distintas.
      this.server.to(roomId).emit("message:new", message);

      return ackOk(message);
    } catch (error) {
      this.logger.error(`No se pudo guardar el mensaje en ${roomId}`, error);

      return ackError("INTERNAL", "No se pudo enviar el mensaje");
    }
  }

  @SubscribeMessage("typing:set")
  onTyping(@ConnectedSocket() client: ChatSocket, @MessageBody() payload: unknown): void {
    const parsed = typingSchema.safeParse(payload);

    if (!parsed.success || !client.rooms.has(parsed.data.roomId)) {
      return;
    }

    // Sin ack a propósito: es señal efímera y de alta frecuencia. Confirmar
    // cada pulsación duplicaría el tráfico para un dato que caduca en dos
    // segundos.
    client.to(parsed.data.roomId).emit("typing:update", {
      roomId: parsed.data.roomId,
      userId: client.data.userId,
      displayName: client.data.displayName,
      isTyping: parsed.data.isTyping,
    });
  }

  /** Quién está en una sala, según los sockets conectados. */
  private async presenceIn(roomId: string): Promise<PresenceUser[]> {
    const sockets = await this.server.in(roomId).fetchSockets();

    // Un usuario con dos pestañas abiertas son dos sockets y una sola persona:
    // el Map deduplica por id.
    const byUser = new Map<string, PresenceUser>();

    for (const socket of sockets) {
      byUser.set(socket.data.userId, {
        id: socket.data.userId,
        displayName: socket.data.displayName,
      });
    }

    return [...byUser.values()];
  }

  /** Las salas del cliente, sin la suya propia. */
  private joinedRooms(client: ChatSocket): string[] {
    // Socket.IO mete a cada socket en una sala con su propio id; no es una
    // sala de chat y filtrarla evita emitir presencia contra ella.
    return [...client.rooms].filter((room) => room !== client.id);
  }
}
