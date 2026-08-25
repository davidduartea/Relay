import { beforeEach, describe, expect, it } from "vitest";

import { MESSAGE_BURST, MESSAGE_WINDOW_MS, MessageRateLimiter } from "./message-rate-limiter";

const SOCKET = "socket-ana";
const OTHER = "socket-benito";

describe("MessageRateLimiter", () => {
  let limiter: MessageRateLimiter;

  beforeEach(() => {
    limiter = new MessageRateLimiter();
  });

  it("deja pasar hasta el cupo", () => {
    for (let i = 0; i < MESSAGE_BURST; i += 1) {
      expect(limiter.allow(SOCKET), `el envío ${i + 1} debería pasar`).toBe(true);
    }
  });

  it("corta el siguiente", () => {
    for (let i = 0; i < MESSAGE_BURST; i += 1) {
      limiter.allow(SOCKET);
    }

    expect(limiter.allow(SOCKET)).toBe(false);
  });

  it("vuelve a permitir cuando pasa la ventana", () => {
    const start = 1_000;

    for (let i = 0; i < MESSAGE_BURST; i += 1) {
      limiter.allow(SOCKET, start);
    }

    expect(limiter.allow(SOCKET, start)).toBe(false);
    expect(limiter.allow(SOCKET, start + MESSAGE_WINDOW_MS)).toBe(true);
  });

  it("cuenta por socket y no en un cubo compartido", () => {
    // Si el cubo fuera global, un cliente ruidoso silenciaría a los demás —
    // que es exactamente el fallo que este limitador viene a evitar, no a
    // reproducir.
    for (let i = 0; i < MESSAGE_BURST; i += 1) {
      limiter.allow(SOCKET);
    }

    expect(limiter.allow(SOCKET)).toBe(false);
    expect(limiter.allow(OTHER)).toBe(true);
  });

  it("olvida el socket al desconectarse", () => {
    // Sin esto el mapa crece con cada conexión que pase por el servidor: una
    // fuga de memoria lenta, de las que sólo aparecen tras semanas en
    // producción.
    for (let i = 0; i < MESSAGE_BURST; i += 1) {
      limiter.allow(SOCKET);
    }

    limiter.forget(SOCKET);

    expect(limiter.allow(SOCKET)).toBe(true);
  });
});
