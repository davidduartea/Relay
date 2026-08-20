import { MESSAGE_MAX_LENGTH } from "@relay/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("expone un h1 como encabezado principal", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Relay" })).toBeInTheDocument();
  });

  it("nombra cada sección con su encabezado", () => {
    render(<HomePage />);

    // getByRole con `name` sólo encuentra la región si el aria-labelledby
    // apunta a un id que existe. El test falla si alguien renombra el heading
    // y olvida el atributo — que es justo el bug de accesibilidad silencioso.
    expect(screen.getByRole("region", { name: "Avance" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "El contrato compartido ya funciona" }),
    ).toBeInTheDocument();
  });

  it("lista las cuatro fases del proyecto", () => {
    render(<HomePage />);

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("muestra el límite que define el paquete compartido", () => {
    render(<HomePage />);

    expect(screen.getByText(String(MESSAGE_MAX_LENGTH))).toBeInTheDocument();
  });
});
