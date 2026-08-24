import type { PresenceUser } from "@relay/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TypingIndicator } from "@/modules/chat/components/TypingIndicator";

const who = (displayName: string): PresenceUser => ({ id: displayName, displayName });

describe("TypingIndicator", () => {
  it("nombra a quien escribe cuando es una sola persona", () => {
    render(<TypingIndicator users={[who("Marta")]} />);

    expect(screen.getByText("Marta está escribiendo…")).toBeInTheDocument();
  });

  it("nombra a las dos cuando son dos", () => {
    render(<TypingIndicator users={[who("Marta"), who("Luis")]} />);

    expect(screen.getByText("Marta y Luis están escribiendo…")).toBeInTheDocument();
  });

  it("resume a partir de tres", () => {
    render(<TypingIndicator users={[who("Marta"), who("Luis"), who("Nuria"), who("Ana")]} />);

    expect(screen.getByText("Marta y 3 más están escribiendo…")).toBeInTheDocument();
  });

  it("reserva su altura estando vacío", () => {
    // Sin altura fija, la lista de mensajes da un salto cada vez que alguien
    // empieza o deja de escribir.
    const { container } = render(<TypingIndicator users={[]} />);

    expect(container.firstElementChild).toHaveClass("h-7");
  });

  it("se anuncia sin interrumpir la lectura", () => {
    const { container } = render(<TypingIndicator users={[who("Marta")]} />);

    expect(container.firstElementChild).toHaveAttribute("aria-live", "polite");
  });
});
