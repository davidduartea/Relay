import type { Message } from "@relay/shared";
import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { MessageList } from "./message-list";
import type { PendingMessage } from "./use-chat";

const ME = "user-ana";
const ROOM = "general";

const message = (overrides: Partial<Message> = {}): Message => ({
  id: "m1",
  roomId: "room-1",
  authorId: "user-benito",
  authorName: "Benito",
  body: "hola",
  clientId: "c1",
  createdAt: "2026-08-20T10:00:00.000Z",
  ...overrides,
});

function list(messages: (Message | PendingMessage)[]) {
  return <MessageList messages={messages} currentUserId={ME} roomName={ROOM} />;
}

beforeAll(() => {
  // jsdom no implementa scrollIntoView y el componente lo llama en un efecto.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("MessageList", () => {
  it("invita a escribir cuando no hay mensajes", () => {
    render(list([]));

    expect(screen.getByText(/todavía no hay mensajes/i)).toBeInTheDocument();
  });

  it("expone la lista como un log accesible", () => {
    // role="log" + aria-live es lo que hace que un lector de pantalla anuncie
    // los mensajes entrantes. Sin esto el contenido cambia solo y quien no ve
    // la pantalla no se entera de nada.
    render(list([message()]));

    const log = screen.getByRole("log", { name: "Mensajes" });

    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("aria-relevant", "additions");
  });

  it("nombra al autor en el texto accesible de los mensajes propios", () => {
    // Visualmente el mensaje propio se distingue por color y alineación, dos
    // pistas que no existen para quien escucha.
    render(list([message({ authorId: ME })]));

    expect(within(screen.getByRole("listitem")).getByText(/tú/i)).toBeInTheDocument();
  });

  it("marca la hora con un elemento time legible por máquinas", () => {
    render(list([message()]));

    const time = screen.getByRole("listitem").querySelector("time");

    expect(time).toHaveAttribute("dateTime", "2026-08-20T10:00:00.000Z");
  });

  it("señala los mensajes que aún no confirmó el servidor", () => {
    const pending: PendingMessage = { ...message({ authorId: ME }), pending: true };

    render(list([pending]));

    expect(screen.getByText(/enviando/i)).toBeInTheDocument();
  });

  it("usa clientId como clave, no id, para que el optimista se reemplace en su sitio", () => {
    // El mensaje optimista y el confirmado comparten clientId pero no id. Si
    // la clave fuera el id, React desmontaría y volvería a montar el nodo, y
    // el mensaje daría un salto visible al confirmarse.
    const optimistic: PendingMessage = { ...message({ id: "c1", authorId: ME }), pending: true };
    const { rerender } = render(list([optimistic]));

    const before = screen.getByRole("listitem");
    rerender(list([message({ id: "server-1", authorId: ME })]));

    expect(screen.getByRole("listitem")).toBe(before);
  });

  it("no repite el nombre en mensajes seguidos del mismo autor", () => {
    render(
      list([
        message({ clientId: "c1", body: "primero" }),
        message({ clientId: "c2", body: "segundo", createdAt: "2026-08-20T10:01:00.000Z" }),
      ]),
    );

    // Una vez en pantalla, y la segunda sólo para el lector de pantalla: quien
    // escucha no tiene la pista visual de que siguen siendo de la misma
    // persona.
    expect(screen.getAllByText(/Benito/)).toHaveLength(2);
    expect(screen.getAllByText(/Benito/)[1]).toHaveClass("sr-only");
  });

  it("vuelve a nombrar al autor cuando otro escribe en medio", () => {
    render(
      list([
        message({ clientId: "c1" }),
        message({ clientId: "c2", authorId: "user-carla", authorName: "Carla" }),
        message({ clientId: "c3" }),
      ]),
    );

    const visible = screen.getAllByText("Benito").filter((el) => !el.classList.contains("sr-only"));

    expect(visible).toHaveLength(2);
  });

  it("separa los días", () => {
    render(
      list([
        message({ clientId: "c1", createdAt: "2026-08-19T10:00:00.000Z" }),
        message({ clientId: "c2", createdAt: "2026-08-20T10:00:00.000Z" }),
      ]),
    );

    expect(screen.getByText(/miércoles 19/i)).toBeInTheDocument();
    expect(screen.getByText(/jueves 20/i)).toBeInTheDocument();
  });
});
