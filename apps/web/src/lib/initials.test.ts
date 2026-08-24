import { describe, expect, it } from "vitest";

import { initials } from "./initials";

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
