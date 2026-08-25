import { randomUUID } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { JwtPayload } from "@relay/shared";

/** Un ticket vive un minuto. Lo justo para abrir el socket, nada más. */
export const SOCKET_TICKET_TTL_SECONDS = 60;

/** Marca que distingue un ticket de un access token con el mismo secreto. */
const SOCKET_TICKET_TYPE = "socket";

interface SocketTicketPayload extends JwtPayload {
  typ: typeof SOCKET_TICKET_TYPE;
  jti: string;
}

/**
 * Tickets de un solo uso para el handshake del socket.
 *
 * Existe por una tensión concreta: la sesión pasa a vivir en cookies httpOnly,
 * que el JavaScript no puede leer — que es justamente el punto —, pero el
 * handshake de Socket.IO lo abre el navegador y necesita mandar **algo**.
 *
 * La salida es no mandar la sesión. El servidor de Next, que sí puede leer la
 * cookie, pide un ticket y se lo pasa al cliente sólo para conectar. Lo que
 * queda expuesto a un XSS es una credencial que caduca en 60 segundos y no se
 * puede usar dos veces, en vez de un refresh token que dura una semana.
 *
 * Se firma con el secreto del access token y se distingue por la marca `typ`:
 * así un access token robado no vale como ticket, ni al revés. Sin esa marca,
 * los dos serían el mismo objeto con distinta caducidad.
 */
@Injectable()
export class SocketTicketService {
  /**
   * Los `jti` ya gastados, con el instante en que dejan de importar.
   *
   * En memoria a propósito. Un ticket dura 60 segundos, así que este mapa
   * nunca guarda gran cosa, y perderlo al reiniciar sólo significa que un
   * ticket en vuelo podría usarse dos veces en esa ventana — mientras la firma
   * y la caducidad siguen verificándose igual.
   *
   * Con varias instancias haría falta un almacén compartido. Este API se
   * despliega como un proceso único justamente porque el socket mantiene
   * estado, así que la restricción ya estaba asumida.
   */
  private readonly spent = new Map<string, number>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issue(user: JwtPayload): Promise<{ ticket: string; expiresInSeconds: number }> {
    const payload: SocketTicketPayload = {
      sub: user.sub,
      email: user.email,
      name: user.name,
      typ: SOCKET_TICKET_TYPE,
      jti: randomUUID(),
    };

    const ticket = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: `${SOCKET_TICKET_TTL_SECONDS}s`,
    });

    return { ticket, expiresInSeconds: SOCKET_TICKET_TTL_SECONDS };
  }

  /**
   * Canjea el ticket. Sólo la primera vez.
   *
   * Lanza en vez de devolver `null` porque quien llama es el middleware del
   * handshake, y ahí cualquier fallo se traduce en rechazar la conexión: un
   * único camino de salida evita que un `if` olvidado deje pasar a alguien.
   */
  async redeem(ticket: string): Promise<JwtPayload> {
    this.forgetExpired();

    let payload: SocketTicketPayload;

    try {
      payload = await this.jwt.verifyAsync<SocketTicketPayload>(ticket, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Ticket inválido o caducado");
    }

    if (payload.typ !== SOCKET_TICKET_TYPE) {
      throw new UnauthorizedException("Ese token no es un ticket de socket");
    }

    if (this.spent.has(payload.jti)) {
      throw new UnauthorizedException("Ese ticket ya se usó");
    }

    this.spent.set(payload.jti, Date.now() + SOCKET_TICKET_TTL_SECONDS * 1000);

    return { sub: payload.sub, email: payload.email, name: payload.name };
  }

  /**
   * Limpia los `jti` que ya no pueden volver a presentarse.
   *
   * Pasado su vencimiento, la propia verificación de la firma rechaza el
   * ticket, así que recordarlo no aporta nada. Se hace al canjear en vez de
   * con un temporizador: sin tráfico no hay nada que limpiar.
   */
  private forgetExpired(): void {
    const now = Date.now();

    for (const [jti, expiresAt] of this.spent) {
      if (expiresAt <= now) {
        this.spent.delete(jti);
      }
    }
  }
}
