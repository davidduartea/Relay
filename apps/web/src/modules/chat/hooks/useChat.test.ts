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

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => fakeSocket),
}));

const ANA = { id: "user-ana", displayName: "Ana" };
const ROOM = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

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
  });

  it("engancha los listeners cuando el token llega DESPUÉS del primer render", async () => {
    // REGRESIÓN: la sesión se lee de localStorage en un efecto, así que en el
    // primer render no hay token y no hay socket. Cuando el socket vivía en una
    // ref, el efecto que registra los listeners corría una sola vez, con la ref
    // aún vacía, y no volvía a correr: al recargar la página el chat aparecía
    // sin historial y sin presencia para siempre.
    const { rerender } = renderHook(
      ({ token }: { token: string | null }) =>
        useChat({ accessToken: token, roomId: ROOM, currentUser: ANA }),
      { initialProps: { token: null as string | null } },
    );

    expect(fakeSocket.on).not.toHaveBeenCalled();

    rerender({ token: "un-token" });

    await waitFor(() => {
      expect(fakeSocket.listeners.has("message:history")).toBe(true);
      expect(fakeSocket.listeners.has("presence:sync")).toBe(true);
    });
  });

  it("carga el historial que manda el servidor al entrar", async () => {
    const { result } = renderHook(() =>
      useChat({ accessToken: "un-token", roomId: ROOM, currentUser: ANA }),
    );

    await waitFor(() => expect(fakeSocket.listeners.has("message:history")).toBe(true));

    act(() => fakeSocket.fire("message:history", { roomId: ROOM, messages: [message()] }));

    expect(result.current.messages).toHaveLength(1);
  });

  it("reemplaza el mensaje optimista en vez de duplicarlo al confirmarse", async () => {
    const { result } = renderHook(() =>
      useChat({ accessToken: "un-token", roomId: ROOM, currentUser: ANA }),
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
      useChat({ accessToken: "un-token", roomId: ROOM, currentUser: ANA }),
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

  it("distingue un token inválido de una caída de red", async () => {
    const { result } = renderHook(() =>
      useChat({ accessToken: "un-token", roomId: ROOM, currentUser: ANA }),
    );

    await waitFor(() => expect(fakeSocket.listeners.has("connect_error")).toBe(true));

    act(() => fakeSocket.fire("connect_error", new Error("Token inválido o expirado")));

    // Con la red caída hay que reintentar; con un token malo, dejar de hacerlo
    // y mandar al login. Tratarlos igual deja al usuario en un bucle.
    expect(result.current.status).toBe("unauthorized");
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });

  it("saca de la presencia a quien se desconecta", async () => {
    const { result } = renderHook(() =>
      useChat({ accessToken: "un-token", roomId: ROOM, currentUser: ANA }),
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
