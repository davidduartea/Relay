import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `API_URL` se resuelve al importar el módulo, así que cada caso necesita una
 * importación fresca con el entorno ya preparado. `resetModules` vacía la
 * caché de módulos para que el `import()` vuelva a ejecutar el archivo.
 */
async function load(): Promise<{ API_URL: string; INTERNAL_API_URL: string }> {
  vi.resetModules();

  return import("./api-url");
}

describe("API_URL", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env["API_URL"];
    delete process.env["API_INTERNAL_URL"];
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("usa el valor configurado", async () => {
    vi.stubEnv("API_URL", "https://api.relay.example.com");

    await expect(load().then((m) => m.API_URL)).resolves.toBe("https://api.relay.example.com");
  });

  it("quita la barra final", async () => {
    // El resto del código concatena rutas que ya empiezan por "/", así que una
    // barra de más produce "//auth/login".
    vi.stubEnv("API_URL", "https://api.relay.example.com/");

    await expect(load().then((m) => m.API_URL)).resolves.toBe("https://api.relay.example.com");
  });

  it("cae a localhost en desarrollo, para que pnpm dev funcione sin configurar nada", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(load().then((m) => m.API_URL)).resolves.toBe("http://localhost:4000");
  });

  it("rompe el build en producción si falta la variable", async () => {
    // El fallo que esto evita: la aplicación compila sin un aviso, apunta a
    // localhost, y en el navegador de quien la usa no conecta con nada — sin
    // log que lo explique.
    vi.stubEnv("NODE_ENV", "production");

    await expect(load()).rejects.toThrow(/API_URL/);
  });

  it("no lleva el prefijo NEXT_PUBLIC, para no acabar en el bundle", async () => {
    // Es la garantía de este archivo: con el prefijo, Next incrusta el valor en
    // el JavaScript y cualquiera descubre el origen del backend sin tener
    // sesión. Sin él, sólo lo conoce el servidor.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://filtrada.example.com");
    vi.stubEnv("NODE_ENV", "development");

    await expect(load().then((m) => m.API_URL)).resolves.toBe("http://localhost:4000");
  });
});

describe("INTERNAL_API_URL", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env["API_URL"];
    delete process.env["API_INTERNAL_URL"];
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("cae a la pública cuando no está definida", async () => {
    vi.stubEnv("API_URL", "https://api.relay.example.com");

    await expect(load().then((m) => m.INTERNAL_API_URL)).resolves.toBe(
      "https://api.relay.example.com",
    );
  });

  it("gana sobre la pública para las llamadas del servidor", async () => {
    // Dentro de docker-compose el navegador usa el dominio público y el
    // servidor de Next tiene el API a un salto interno.
    vi.stubEnv("API_URL", "https://api.relay.example.com");
    vi.stubEnv("API_INTERNAL_URL", "http://api:4000");

    await expect(load().then((m) => m.INTERNAL_API_URL)).resolves.toBe("http://api:4000");
  });
});
