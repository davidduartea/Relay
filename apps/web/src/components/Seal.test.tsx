import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Seal } from "@/components/Seal";

describe("Seal", () => {
  it("se oculta al lector de pantalla", () => {
    // Las iniciales no son información: al lado siempre está el nombre
    // completo en texto, así que leer «GE general» sería ruido.
    render(<Seal name="general" />);

    // El texto sigue en el DOM — aria-hidden no lo borra, sólo lo saca del
    // árbol de accesibilidad — así que se comprueba con `ignore`, que es lo
    // que ve de verdad un lector de pantalla.
    expect(screen.getByText("GE")).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.queryByText("GE", { ignore: "[aria-hidden='true']" }),
    ).not.toBeInTheDocument();
  });
});
