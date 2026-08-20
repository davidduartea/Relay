import { describe, expect, it } from "vitest";

import { assertSecretsDiffer, loadEnvironment } from "./environment";

const VALID = {
  DATABASE_URL: "postgresql://relay:relay@localhost:5432/relay",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
};

describe("loadEnvironment", () => {
  it("acepta una configuración mínima válida", () => {
    expect(() => loadEnvironment(VALID)).not.toThrow();
  });

  it("aplica los valores por defecto", () => {
    const env = loadEnvironment(VALID);

    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.JWT_ACCESS_TTL).toBe("15m");
  });

  it("convierte PORT a número: process.env siempre da strings", () => {
    const env = loadEnvironment({ ...VALID, PORT: "8080" });

    expect(env.PORT).toBe(8080);
  });

  it("nombra la variable que falta en el mensaje de error", () => {
    const { DATABASE_URL: _omitted, ...incomplete } = VALID;

    expect(() => loadEnvironment(incomplete)).toThrow(/DATABASE_URL/);
  });

  it("rechaza un secreto demasiado corto", () => {
    expect(() => loadEnvironment({ ...VALID, JWT_ACCESS_SECRET: "corto" })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });
});

describe("assertSecretsDiffer", () => {
  it("pasa cuando los secretos son distintos", () => {
    expect(() => assertSecretsDiffer(loadEnvironment(VALID))).not.toThrow();
  });

  it("falla cuando coinciden: un access token valdría como refresh", () => {
    const env = loadEnvironment({ ...VALID, JWT_REFRESH_SECRET: VALID.JWT_ACCESS_SECRET });

    expect(() => assertSecretsDiffer(env)).toThrow(/no pueden ser iguales/);
  });
});
