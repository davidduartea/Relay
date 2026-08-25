import type { Message } from "@relay/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChat } from "@/modules/chat/hooks/useChat";

/** Socket falso: guarda los listeners para poder dispararlos desde el test. */
function createFakeSocket() {
  const listeners = new Map<string, ((payload: unknown) => void)[]>();

  return {
    listeners,
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    }),
    off: vi.fn((event: string, handler: (payload: unknown) => void) => {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((h) => h !== handler),
      );
    }),
    emit: vi.fn(),
    emitWithAck: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
    /** Dispara un evento como si viniera del servidor. */
    fire(event: string, payload: unknown) {
      for (const handler of listeners.get(event) ?? []) {
        handler(payload);
      }
    },
  };
}

let fakeSocket = createFakeSocket();

type SocketOptions = { auth: (done: (data: unknown) => void) => void };

/**
 * El mock de `io`, expuesto para inspeccionar las opciones que recibe.
 *
 * Va dentro de `vi.hoisted` porque `vi.mock` se eleva al principio del
 * archivo: una constante normal todavía no existiría cuando la fábrica del
 * mock la usa, y el módulo falla con «Cannot access before initialization».
 * 📖 https://vitest.dev/api/vi.html#vi-hoisted
 */
const { ioMock } = vi.hoisted(() => ({
  ioMock: vi.fn<(url: string, options: SocketOptions) => unknown>(),
}));

vi.mock("socket.io-client", () => ({ io: ioMock }));

/** Las opciones con las que se creó el socket en este test. */
const socketOptions = () => ioMock.mock.calls[0]![1];

const ANA = { id: "user-ana", displayName: "Ana" };
const ROOM = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

/** La entrega el servidor en el render, no una variable del bundle. */
const SOCKET_URL = "http://localhost:4000";

/** El proveedor de tickets, que en la aplicación es un server action. */
const getTicket = vi.fn<() => Promise<string | null>>(() => Promise.resolve("un-ticket"));

const message = (overrides: Partial<Message> = {}): Message => ({
  id: "m1",
  roomId: ROOM,
  authorId: "user-benito",
  authorName: "Benito",
  body: "hola",
  clientId: "c1",
  createdAt: "2026-08-20T10:00:00.000Z",
  ...overrides,
});

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeSocket = createFakeSocket();
    ioMock.mockReturnValue(fakeSocket);
    getTicket.mockResolvedValue("un-ticket");
  });

  it("engancha los listeners desde el primer render", async () => {
    // El socket se crea ya, sin esperar al ticket: `auth` es una función que
    // Socket.IO llama al conectar. Antes había que esperar a leer el token de
    // localStorage, y el efecto de los listeners llegaba tarde.
    renderHook(() =>
      useChat({ getTicket, socketUrl: SOCKET_URL, roomId: ROOM, currentUser: ANA }),
    );

    await waitFor(() => {
      expect(fakeSocket.listeners.has("message:history")).toBe(true);
      expect(fakeSocket.listeners.has("presence:sync")).toBe(true);
    });
  });

  it("pide un ticket nuevo en cada intento de conexión", async () => {
    // Un ticket vale una sola vez. Si `auth` fuera un objeto fijo, la
    // reconexión reenviaría el mismo, gastado, y no volvería a conectar nunca.
    renderHook(() =>
      useChat({ getTicket, socketUrl: SOCKET_URL, roomId: ROOM, currentUser: ANA }),
    );

    const options = socketOptions();
    const first = await new Promise((resolve) => options.auth(resolve));
    const second = await new Promise((resolve) => options.auth(resolve));

    expect(first).toEqual({ ticket: "un-ticket" });
    expect(second).toEqual({ ticket: "un-ticket" });
    expect(getTicket).toHaveBeenCalledTimes(2);
  });

  it("carga el historial que manda el servidor al entrar", async () => {
    const { result } = renderHook(() =>
      useChat({ getTicket, socketUrl: SOCKET_URL, roomId: ROOM, currentUser: ANA }),
    );

    await waitFor(() => expect(fakeSocket.listeners.has("message:history")).toBe(true));

    act(() => fakeSocket.fire("message:history", { roomId: ROOM, messages: [message()] }));

    expect(result.current.messages).toHaveLength(1);
  });

  it("reemplaza el mensaje optimista en vez de duplicarlo al confirmarse", async () => {
    const { result } = renderHook(() =>
      useChat({ getTicket, socketUrl: SOCKET_URL, roomId: ROOM, currentUser: ANA }),
    );

    await waitFor(() => expect(fakeSocket.listeners.has("message:new")).toBe(true));

    // El clientId lo genera el hook, así que se toma del envío real en vez de
    // inventarlo: el servidor lo devuelve tal cual, y es la única pista que
    // tiene el cliente para saber que ese mensaje es su copia optimista.
    fakeSocket.emitWithAck.mockImplementation(
      (_event: string, payload: { clientId: string }) => {
        const confirmed = message({
          id: "server-1",
          clientId: payload.clientId,
          authorId: ANA.id,
        });
        fakeSocket.fire("message:new", confirmed);

        return Promise.resolve({ ok: true, data: confirmed });
      },
    );

    // El servidor devuelve el mensaje a todos, incluido el autor. Si no se
    // reconciliara por clientId, quien escribe vería su mensaje dos veces.
    await act(async () => {
      await result.current.send("hola");
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.id).toBe("server-1");
  });

  it("retira el optimista cuando el servidor rechaza el envío", async () => {
    const { result } = renderHook(() =>
      useChat({ getTicket, socketUrl: SOCKET_URL, roomId: ROOM, currentUser: ANA }),
    );

    await waitFor(() => expect(fakeSocket.listeners.has("message:new")).toBe(true));
    fakeSocket.emitWithAck.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "No estás en esa sala" },
    });

    await act(async () => {
      await result.current.send("hola");
    });

    // Dejarlo puesto le diría al usuario que su mensaje llegó cuando no lo hizo.
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toBe("No estás en esa sala");
  });

  it("trata un fallo de conexión con sesión válida como caída de red", async () => {
    // Un ticket gastado o caducado ocurre en cada reconexión normal. Marcarlo
    // como sesión perdida mandaría al login cada vez que se va el wifi.
    const { result } = renderHook(() =>
      useChat({ getTicket, socketUrl: SOCKET_URL, roomId: ROOM, currentUser: ANA }),
    );

    await waitFor(() => expect(fakeSocket.listeners.has("connect_error")).toBe(true));

    act(() => fakeSocket.fire("connect_error", new Error("Ticket ya usado")));

    expect(result.current.status).toBe("offline");
  });

  it("marca sesión perdida cuando ya no hay ticket que pedir", async () => {
    // `getTicket` devuelve null cuando el refresh tampoco vale. Es la única
    // señal fiable de que hay que volver a entrar.
    getTicket.mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useChat({ getTicket, socketUrl: SOCKET_URL, roomId: ROOM, currentUser: ANA }),
    );

    const options = socketOptions();
    await new Promise((resolve) => options.auth(resolve));

    await waitFor(() => expect(fakeSocket.listeners.has("connect_error")).toBe(true));
    act(() => fakeSocket.fire("connect_error", new Error("Falta el ticket de conexión")));

    expect(result.current.status).toBe("unauthorized");
  });

  it("saca de la presencia a quien se desconecta", async () => {
    const { result } = renderHook(() =>
      useChat({ getTicket, socketUrl: SOCKET_URL, roomId: ROOM, currentUser: ANA }),
    );

    await waitFor(() => expect(fakeSocket.listeners.has("presence:sync")).toBe(true));

    act(() =>
      fakeSocket.fire("presence:sync", {
        roomId: ROOM,
        users: [ANA, { id: "user-benito", displayName: "Benito" }],
      }),
    );
    expect(result.current.members).toHaveLength(2);

    act(() => fakeSocket.fire("presence:leave", { roomId: ROOM, userId: "user-benito" }));

    expect(result.current.members).toHaveLength(1);
    expect(result.current.others).toHaveLength(0);
  });
});
