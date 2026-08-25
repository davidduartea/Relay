import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { SOCKET_TICKET_TTL_SECONDS, SocketTicketService } from "./socket-ticket.service";

const SECRET = "a".repeat(32);
const ANA = { sub: "user-ana", email: "ana@relay.dev", name: "Ana" };

describe("SocketTicketService", () => {
  let tickets: SocketTicketService;
  let jwt: JwtService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SocketTicketService, JwtService, ConfigService],
    })
      .overrideProvider(ConfigService)
      .useValue({ getOrThrow: () => SECRET })
      .compile();

    tickets = moduleRef.get(SocketTicketService);
    jwt = moduleRef.get(JwtService);
  });

  it("emite un ticket que devuelve al mismo usuario al canjearlo", async () => {
    const { ticket } = await tickets.issue(ANA);

    await expect(tickets.redeem(ticket)).resolves.toEqual(ANA);
  });

  it("anuncia cuánto dura", async () => {
    // El cliente lo necesita para pedir otro antes de reconectar, en vez de
    // intentar el handshake con uno caducado y descubrirlo por el error.
    const { expiresInSeconds } = await tickets.issue(ANA);

    expect(expiresInSeconds).toBe(SOCKET_TICKET_TTL_SECONDS);
  });

  it("vale una sola vez", async () => {
    // Es lo que acota el daño de un XSS: el ticket queda a la vista del
    // JavaScript, pero sólo sirve para una conexión.
    const { ticket } = await tickets.issue(ANA);

    await tickets.redeem(ticket);

    await expect(tickets.redeem(ticket)).rejects.toThrow(/ya se usó/);
  });

  it("emite tickets distintos para el mismo usuario", async () => {
    // Comparten payload salvo el `jti`. Sin él serían idénticos byte a byte
    // dentro del mismo segundo — `iat` va en segundos — y el segundo se
    // rechazaría por gastado nada más emitirlo.
    const [uno, dos] = await Promise.all([tickets.issue(ANA), tickets.issue(ANA)]);

    expect(uno.ticket).not.toBe(dos.ticket);
    await expect(tickets.redeem(dos.ticket)).resolves.toEqual(ANA);
  });

  it("rechaza un access token normal", async () => {
    // Sin la marca `typ`, un access token robado abriría el socket: mismo
    // secreto y mismo payload. Es la razón de que la marca exista.
    const accessToken = await jwt.signAsync(ANA, { secret: SECRET });

    await expect(tickets.redeem(accessToken)).rejects.toThrow(/no es un ticket/);
  });

  it("rechaza una firma de otro secreto", async () => {
    const forged = await jwt.signAsync(
      { ...ANA, typ: "socket", jti: "falso" },
      { secret: "b".repeat(32) },
    );

    await expect(tickets.redeem(forged)).rejects.toThrow(/inválido o caducado/);
  });

  it("rechaza un ticket caducado", async () => {
    const stale = await jwt.signAsync(
      { ...ANA, typ: "socket", jti: "viejo" },
      { secret: SECRET, expiresIn: "-1s" },
    );

    await expect(tickets.redeem(stale)).rejects.toThrow(/inválido o caducado/);
  });

  it("rechaza cualquier cosa que no sea un token", async () => {
    await expect(tickets.redeem("no-es-un-jwt")).rejects.toThrow();
  });
});
