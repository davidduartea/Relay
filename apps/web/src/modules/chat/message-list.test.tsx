import type { Message } from "@relay/shared";
import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { MessageList } from "./message-list";
import type { PendingMessage } from "./use-chat";

const ME = "user-ana";

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

beforeAll(() => {
  // jsdom no implementa scrollIntoView y el componente lo llama en un efecto.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("MessageList", () => {
  it("invita a escribir cuando no hay mensajes", () => {
    render(<MessageList messages={[]} currentUserId={ME} />);

    expect(screen.getByText(/todavía no hay mensajes/i)).toBeInTheDocument();
  });

  it("expone la lista como un log accesible", () => {
    // role="log" + aria-live es lo que hace que un lector de pantalla anuncie
    // los mensajes entrantes. Sin esto el contenido cambia solo y quien no ve
    // la pantalla no se entera de nada.
    render(<MessageList messages={[message()]} currentUserId={ME} />);

    const log = screen.getByRole("log", { name: "Mensajes" });

    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("aria-relevant", "additions");
  });

  it("nombra al autor en el texto accesible de los mensajes propios", () => {
    // Visualmente el mensaje propio se distingue por color y alineación, dos
    // pistas que no existen para quien escucha.
    render(<MessageList messages={[message({ authorId: ME })]} currentUserId={ME} />);

    expect(within(screen.getByRole("listitem")).getByText(/tú/i)).toBeInTheDocument();
  });

  it("marca la hora con un elemento time legible por máquinas", () => {
    render(<MessageList messages={[message()]} currentUserId={ME} />);

    const time = screen.getByRole("listitem").querySelector("time");

    expect(time).toHaveAttribute("dateTime", "2026-08-20T10:00:00.000Z");
  });

  it("señala los mensajes que aún no confirmó el servidor", () => {
    const pending: PendingMessage = { ...message({ authorId: ME }), pending: true };

    render(<MessageList messages={[pending]} currentUserId={ME} />);

    expect(screen.getByText(/enviando/i)).toBeInTheDocument();
  });

  it("usa clientId como clave, no id, para que el optimista se reemplace en su sitio", () => {
    // El mensaje optimista y el confirmado comparten clientId pero no id. Si
    // la clave fuera el id, React desmontaría y volvería a montar el nodo, y
    // el mensaje daría un salto visible al confirmarse.
    const optimistic: PendingMessage = { ...message({ id: "c1", authorId: ME }), pending: true };
    const { rerender } = render(<MessageList messages={[optimistic]} currentUserId={ME} />);

    const before = screen.getByRole("listitem");
    rerender(<MessageList messages={[message({ id: "server-1", authorId: ME })]} currentUserId={ME} />);

    expect(screen.getByRole("listitem")).toBe(before);
  });
});
