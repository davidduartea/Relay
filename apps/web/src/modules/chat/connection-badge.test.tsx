import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConnectionBadge } from "./connection-badge";
import { CONNECTION_STATUS } from "./connection-status";
import type { ConnectionState } from "./use-chat";

const STATES = Object.keys(CONNECTION_STATUS) as ConnectionState[];

describe("ConnectionBadge", () => {
  it.each(STATES)("dice en palabras el estado %s", (status) => {
    render(<ConnectionBadge status={status} />);

    expect(screen.getByText(CONNECTION_STATUS[status].label)).toBeInTheDocument();
  });

  it("da a cada estado un texto distinto", () => {
    // Si dos estados dijeran lo mismo, el color sería la única diferencia — y
    // saber si tus mensajes están saliendo no puede depender de distinguir dos
    // tonos.
    const labels = STATES.map((status) => CONNECTION_STATUS[status].label);

    expect(new Set(labels).size).toBe(STATES.length);
  });

  it("se anuncia solo, porque cambia sin que nadie lo pida", () => {
    const { container } = render(<ConnectionBadge status="offline" />);

    expect(container.firstElementChild).toHaveAttribute("aria-live", "polite");
  });

  it("oculta el glifo al lector de pantalla: el texto ya lo dice", () => {
    render(<ConnectionBadge status="connected" />);

    expect(screen.getByText("●")).toHaveAttribute("aria-hidden", "true");
  });
});
