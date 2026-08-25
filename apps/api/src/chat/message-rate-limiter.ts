import { Injectable } from "@nestjs/common";

/** Mensajes permitidos en la ventana. */
export const MESSAGE_BURST = 10;

/** Cuánto dura la ventana. */
export const MESSAGE_WINDOW_MS = 10_000;

/**
 * Límite de envíos por socket.
 *
 * El throttler de `@nestjs/throttler` sólo cubre HTTP: mira `req.ip` y cuenta
 * peticiones. Un WebSocket es **una** petición que luego lleva miles de
 * mensajes, así que los eventos del socket no pasaban por ningún control.
 *
 * Con sesión válida, un cliente podía emitir `message:send` tan rápido como
 * diera la red, y cada uno es una escritura en la base. No hacía falta ningún
 * fallo de autenticación para tumbar el servicio: bastaba una cuenta.
 *
 * Es un cubo de fichas por socket, no por usuario ni por IP: el socket ya está
 * autenticado y se destruye al desconectar, así que la limpieza es automática y
 * no hace falta recordar nada de quien se fue.
 *
 * Diez en diez segundos deja escribir de forma natural — nadie manda un mensaje
 * pensado cada segundo durante diez segundos seguidos — y corta el bucle
 * automatizado en el primer intento.
 */
@Injectable()
export class MessageRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  /**
   * Registra un envío y dice si estaba permitido.
   *
   * Devuelve `false` cuando ya se pasó del cupo, para que quien llama responda
   * con un acknowledgement de error en vez de escribir en la base.
   */
  allow(socketId: string, now = Date.now()): boolean {
    const window = this.windows.get(socketId);

    if (!window || window.resetAt <= now) {
      this.windows.set(socketId, { count: 1, resetAt: now + MESSAGE_WINDOW_MS });

      return true;
    }

    if (window.count >= MESSAGE_BURST) {
      return false;
    }

    window.count += 1;

    return true;
  }

  /**
   * Olvida un socket al desconectarse.
   *
   * Sin esto el mapa crecería con cada conexión que pasara por el servidor y no
   * se vaciaría nunca — una fuga de memoria lenta, de las que sólo aparecen en
   * producción y tras semanas.
   */
  forget(socketId: string): void {
    this.windows.delete(socketId);
  }
}
