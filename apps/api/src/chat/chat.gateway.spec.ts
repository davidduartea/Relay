import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import type { Ack, ClientToServerEvents, Message, ServerToClientEvents } from "@relay/shared";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { MessagesService } from "../messages/messages.service";
import { RoomsService } from "../rooms/rooms.service";
import { SocketTicketService } from "../auth/socket-ticket.service";
import { ChatGateway } from "./chat.gateway";
import { MessageRateLimiter } from "./message-rate-limiter";

const ENV: Record<string, string> = {
  JWT_ACCESS_SECRET: "a".repeat(32),
  WEB_ORIGIN: "http://localhost:3000",
};

const ROOM_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ANA = { sub: "user-ana", email: "ana@relay.dev", name: "Ana" };
const BENITO = { sub: "user-benito", email: "benito@relay.dev", name: "Benito" };

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Tests de integración del gateway.
 *
 * Levantan la aplicación de verdad y se conectan con un cliente de Socket.IO
 * real. No hay dobles del transporte: se ejercitan el handshake, la
 * autenticación, las salas y el broadcast tal cual funcionan en producción.
 *
 * Los servicios sí son dobles — la base de datos no aporta nada a lo que se
 * quiere comprobar aquí, que es el comportamiento del socket.
 */
describe("ChatGateway (integración)", () => {
  const messages = { history: vi.fn(), create: vi.fn() };
  const rooms = { existsById: vi.fn() };

  let app: INestApplication;
  let jwt: JwtService;
  let tickets: SocketTicketService;
  let url: string;
  const open: ClientSocket[] = [];

  /** Conecta un cliente y espera a que el servidor acepte o cierre. */
  function connect(ticket?: string): Promise<ClientSocket> {
    const socket: ClientSocket = io(url, {
      transports: ["websocket"],
      auth: ticket ? { ticket } : {},
      reconnection: false,
    });

    open.push(socket);

    return new Promise((resolve, reject) => {
      socket.on("connect", () => resolve(socket));
      socket.on("disconnect", () => reject(new Error("el servidor cerró la conexión")));
      socket.on("connect_error", (error) => reject(error));
    });
  }

  /**
   * Vista sin tipar del socket.
   *
   * Hace falta en dos sitios: para suscribirse a un evento por nombre
   * genérico, y para simular un cliente que manda campos de más. Un atacante
   * no usa nuestros tipos, así que el test tampoco debe.
   */
  const untyped = (socket: ClientSocket) =>
    socket as unknown as {
      once(event: string, listener: (payload: unknown) => void): void;
      emitWithAck(event: string, payload: unknown): Promise<Ack<unknown>>;
    };

  /** Promete el primer evento de ese nombre, con tiempo límite. */
  function nextEvent<K extends keyof ServerToClientEvents>(
    socket: ClientSocket,
    event: K,
    timeoutMs = 2000,
  ): Promise<Parameters<ServerToClientEvents[K]>[0]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`sin "${String(event)}" a tiempo`)),
        timeoutMs,
      );

      untyped(socket).once(String(event), (payload) => {
        clearTimeout(timer);
        resolve(payload as Parameters<ServerToClientEvents[K]>[0]);
      });
    });
  }

  const join = (socket: ClientSocket, roomId = ROOM_ID) =>
    socket.emitWithAck("room:join", { roomId }) as Promise<Ack<{ roomId: string }>>;

  /** Un ticket recién emitido para ese usuario. */
  const ticketFor = async (user: typeof ANA) => (await tickets.issue(user)).ticket;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatGateway,
        MessagesService,
        RoomsService,
        SocketTicketService,
        MessageRateLimiter,
        JwtService,
        ConfigService,
      ],
    })
      .overrideProvider(MessagesService)
      .useValue(messages)
      .overrideProvider(RoomsService)
      .useValue(rooms)
      .overrideProvider(ConfigService)
      .useValue({ getOrThrow: (key: string) => ENV[key] })
      .compile();

    app = moduleRef.createNestApplication();
    jwt = moduleRef.get(JwtService);
    tickets = moduleRef.get(SocketTicketService);

    // Puerto 0: el sistema asigna uno libre, así que los tests no chocan con
    // un servidor de desarrollo levantado ni entre ejecuciones en paralelo.
    await app.listen(0);
    url = `${await app.getUrl()}/chat`.replace("[::1]", "localhost");
  });

  afterEach(() => {
    for (const socket of open.splice(0)) {
      socket.disconnect();
    }
    vi.resetAllMocks();
    rooms.existsById.mockResolvedValue(true);
    messages.history.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("autenticación en el handshake", () => {
    it("rechaza una conexión sin ticket", async () => {
      await expect(connect()).rejects.toThrow();
    });

    it("rechaza un ticket firmado con otro secreto", async () => {
      const forged = await jwt.signAsync(
        { ...ANA, typ: "socket", jti: "falso" },
        { secret: "b".repeat(32) },
      );

      await expect(connect(forged)).rejects.toThrow();
    });

    it("rechaza un ticket caducado", async () => {
      const stale = await jwt.signAsync(
        { ...ANA, typ: "socket", jti: "viejo" },
        { secret: ENV["JWT_ACCESS_SECRET"], expiresIn: "-1s" },
      );

      await expect(connect(stale)).rejects.toThrow();
    });

    it("rechaza un access token normal", async () => {
      // Sin la marca `typ`, un access token robado abriría el socket: los dos
      // llevan la misma firma y el mismo payload, y sólo se distinguen por
      // ahí. Es la razón de que la marca exista.
      const accessToken = await jwt.signAsync(ANA, { secret: ENV["JWT_ACCESS_SECRET"] });

      await expect(connect(accessToken)).rejects.toThrow();
    });

    it("acepta un ticket válido", async () => {
      const socket = await connect(await ticketFor(ANA));

      expect(socket.connected).toBe(true);
    });

    it("rechaza el mismo ticket una segunda vez", async () => {
      // Es lo que acota el daño de un XSS: el ticket queda expuesto al
      // JavaScript, pero sólo sirve para la conexión que ya se hizo.
      const ticket = await ticketFor(ANA);

      await connect(ticket);

      await expect(connect(ticket)).rejects.toThrow();
    });
  });

  describe("room:join", () => {
    it("responde con ack de error si la sala no existe", async () => {
      rooms.existsById.mockResolvedValue(false);
      const socket = await connect(await ticketFor(ANA));

      const ack = await join(socket);

      expect(ack).toMatchObject({ ok: false, error: { code: "ROOM_NOT_FOUND" } });
    });

    it("responde con ack de error si el roomId no es un uuid", async () => {
      const socket = await connect(await ticketFor(ANA));

      const ack = (await socket.emitWithAck("room:join", {
        roomId: "no-es-uuid",
      })) as Ack<unknown>;

      expect(ack).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    });

    it("manda el historial a quien entra", async () => {
      const historic = [{ id: "m1", body: "hola" }];
      messages.history.mockResolvedValue(historic);
      const socket = await connect(await ticketFor(ANA));

      const history = nextEvent(socket, "message:history");
      await join(socket);

      await expect(history).resolves.toMatchObject({ roomId: ROOM_ID, messages: historic });
    });

    it("avisa a los que ya estaban, pero no a quien entra", async () => {
      const ana = await connect(await ticketFor(ANA));
      await join(ana);

      const anaSeesJoin = nextEvent(ana, "presence:join");
      const benito = await connect(await ticketFor(BENITO));
      await join(benito);

      await expect(anaSeesJoin).resolves.toMatchObject({
        roomId: ROOM_ID,
        user: { id: BENITO.sub, displayName: "Benito" },
      });
    });

    it("cuenta una sola vez a un usuario con dos pestañas", async () => {
      const first = await connect(await ticketFor(ANA));
      await join(first);

      const second = await connect(await ticketFor(ANA));
      const sync = nextEvent(second, "presence:sync");
      await join(second);

      const { users } = await sync;
      expect(users.filter((user) => user.id === ANA.sub)).toHaveLength(1);
    });
  });

  describe("message:send", () => {
    it("rechaza escribir en una sala en la que no se ha entrado", async () => {
      const socket = await connect(await ticketFor(ANA));

      const ack = await socket.emitWithAck("message:send", {
        roomId: ROOM_ID,
        body: "hola",
        clientId: "9c858901-8a57-4791-81fe-4c455b099bc9",
      });

      expect(ack).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(messages.create).not.toHaveBeenCalled();
    });

    it("rechaza un mensaje vacío", async () => {
      const socket = await connect(await ticketFor(ANA));
      await join(socket);

      const ack = await socket.emitWithAck("message:send", {
        roomId: ROOM_ID,
        body: "   ",
        clientId: "9c858901-8a57-4791-81fe-4c455b099bc9",
      });

      expect(ack).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    });

    it("toma el autor del token y no del payload", async () => {
      // Si el autor viniera del cliente, cualquiera podría publicar en nombre
      // de otro con sólo cambiar un campo del envío. Se manda por la vista sin
      // tipar porque el contrato compartido no admite `authorId` — que es
      // precisamente la primera línea de defensa que aquí se está saltando.
      const stored = { id: "m1", authorId: ANA.sub } as Message;
      messages.create.mockResolvedValue(stored);
      const socket = await connect(await ticketFor(ANA));
      await join(socket);

      await untyped(socket).emitWithAck("message:send", {
        roomId: ROOM_ID,
        body: "hola",
        clientId: "9c858901-8a57-4791-81fe-4c455b099bc9",
        authorId: "otro-usuario",
      });

      expect(messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: ANA.sub }),
      );
    });

    it("entrega el mensaje al otro miembro de la sala", async () => {
      const stored = { id: "m1", roomId: ROOM_ID, body: "hola" } as Message;
      messages.create.mockResolvedValue(stored);

      const ana = await connect(await ticketFor(ANA));
      const benito = await connect(await ticketFor(BENITO));
      await Promise.all([join(ana), join(benito)]);

      const delivered = nextEvent(benito, "message:new");
      await ana.emitWithAck("message:send", {
        roomId: ROOM_ID,
        body: "hola",
        clientId: "9c858901-8a57-4791-81fe-4c455b099bc9",
      });

      await expect(delivered).resolves.toMatchObject(stored);
    });

    it("también se lo devuelve al autor, para reconciliar su copia optimista", async () => {
      const stored = { id: "m1", roomId: ROOM_ID, body: "hola" } as Message;
      messages.create.mockResolvedValue(stored);
      const ana = await connect(await ticketFor(ANA));
      await join(ana);

      const echo = nextEvent(ana, "message:new");
      await ana.emitWithAck("message:send", {
        roomId: ROOM_ID,
        body: "hola",
        clientId: "9c858901-8a57-4791-81fe-4c455b099bc9",
      });

      await expect(echo).resolves.toMatchObject(stored);
    });

    it("responde con ack de error si falla el guardado", async () => {
      messages.create.mockRejectedValue(new Error("base caída"));
      const socket = await connect(await ticketFor(ANA));
      await join(socket);

      const ack = await socket.emitWithAck("message:send", {
        roomId: ROOM_ID,
        body: "hola",
        clientId: "9c858901-8a57-4791-81fe-4c455b099bc9",
      });

      expect(ack).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    });
  });

  describe("presencia", () => {
    it("avisa a la sala cuando alguien se desconecta", async () => {
      const ana = await connect(await ticketFor(ANA));
      const benito = await connect(await ticketFor(BENITO));
      await Promise.all([join(ana), join(benito)]);

      const left = nextEvent(ana, "presence:leave");
      benito.disconnect();

      await expect(left).resolves.toMatchObject({ roomId: ROOM_ID, userId: BENITO.sub });
    });

    it("propaga el indicador de escritura al resto", async () => {
      const ana = await connect(await ticketFor(ANA));
      const benito = await connect(await ticketFor(BENITO));
      await Promise.all([join(ana), join(benito)]);

      const typing = nextEvent(benito, "typing:update");
      ana.emit("typing:set", { roomId: ROOM_ID, isTyping: true });

      await expect(typing).resolves.toMatchObject({
        userId: ANA.sub,
        displayName: "Ana",
        isTyping: true,
      });
    });
  });
});
