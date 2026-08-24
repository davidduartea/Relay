import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Seal, initials } from "./seal";

describe("initials", () => {
  it("toma la inicial de las dos primeras palabras", () => {
    expect(initials("Ana Ruiz")).toBe("AR");
  });

  it("ignora la tercera palabra en adelante", () => {
    expect(initials("María del Carmen Soler")).toBe("MD");
  });

  it("con una sola palabra toma sus dos primeras letras", () => {
    // Así una sala de una palabra y una persona con nombre y apellido
    // producen sellos del mismo peso visual.
    expect(initials("general")).toBe("GE");
  });

  it("conserva los acentos en mayúscula", () => {
    expect(initials("Ángela Ñuño")).toBe("ÁÑ");
  });

  it("aguanta espacios de sobra", () => {
    expect(initials("  Luis   Corta  ")).toBe("LC");
  });

  it("no revienta con un nombre vacío", () => {
    expect(initials("   ")).toBe("··");
  });
});

describe("Seal", () => {
  it("se oculta al lector de pantalla", () => {
    // Las iniciales no son información: al lado siempre está el nombre
    // completo en texto, así que leer «GE general» sería ruido.
    render(<Seal name="general" />);

    // El texto sigue en el DOM — aria-hidden no lo borra, sólo lo saca del
    // árbol de accesibilidad — así que se comprueba con `ignore`, que es lo
    // que ve de verdad un lector de pantalla.
    expect(screen.getByText("GE")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByText("GE", { ignore: "[aria-hidden='true']" })).not.toBeInTheDocument();
  });
});
