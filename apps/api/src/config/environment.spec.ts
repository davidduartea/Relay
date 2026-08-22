import { describe, expect, it } from "vitest";

import { assertProductionConfig, assertSecretsDiffer, loadEnvironment } from "./environment";

const VALID = {
  DATABASE_URL: "postgresql://relay:relay@localhost:5432/relay",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
};

/** Configuración que sí valdría desplegada. */
const PRODUCTION = {
  ...VALID,
  NODE_ENV: "production",
  WEB_ORIGIN: "https://relay.example.com",
  DATABASE_URL: "postgresql://relay:secreto@db.interno:5432/relay",
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

describe("assertProductionConfig", () => {
  it("no exige nada fuera de producción", () => {
    // En desarrollo los valores por defecto son justo lo que se quiere: que
    // `pnpm dev` funcione recién clonado el repositorio.
    expect(() => assertProductionConfig(loadEnvironment(VALID))).not.toThrow();
  });

  it("acepta una configuración de producción correcta", () => {
    expect(() => assertProductionConfig(loadEnvironment(PRODUCTION))).not.toThrow();
  });

  it("rechaza WEB_ORIGIN apuntando a localhost en producción", () => {
    // Desplegar así deja CORS aceptando peticiones del navegador de
    // cualquiera y rechazando las del dominio real.
    const env = loadEnvironment({ ...PRODUCTION, WEB_ORIGIN: "http://localhost:3000" });

    expect(() => assertProductionConfig(env)).toThrow(/WEB_ORIGIN/);
  });

  it("rechaza también 127.0.0.1, no sólo la palabra localhost", () => {
    const env = loadEnvironment({ ...PRODUCTION, WEB_ORIGIN: "http://127.0.0.1:3000" });

    expect(() => assertProductionConfig(env)).toThrow(/WEB_ORIGIN/);
  });

  it("rechaza DATABASE_URL apuntando a localhost en producción", () => {
    // Dentro de un contenedor, localhost es el propio contenedor.
    const env = loadEnvironment({ ...PRODUCTION, DATABASE_URL: VALID.DATABASE_URL });

    expect(() => assertProductionConfig(env)).toThrow(/DATABASE_URL/);
  });

  it("nombra todos los problemas a la vez, no sólo el primero", () => {
    // Arreglar uno, volver a desplegar y descubrir el siguiente es la forma
    // más lenta posible de configurar un entorno.
    const env = loadEnvironment({
      ...PRODUCTION,
      WEB_ORIGIN: "http://localhost:3000",
      DATABASE_URL: VALID.DATABASE_URL,
    });

    const message = String(
      (() => {
        try {
          assertProductionConfig(env);
        } catch (error) {
          return (error as Error).message;
        }
      })(),
    );

    expect(message).toMatch(/WEB_ORIGIN/);
    expect(message).toMatch(/DATABASE_URL/);
  });
});
