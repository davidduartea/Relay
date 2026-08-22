import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `API_URL` se resuelve al importar el módulo, así que cada caso necesita una
 * importación fresca con el entorno ya preparado. `resetModules` vacía la
 * caché de módulos para que el `import()` vuelva a ejecutar el archivo.
 */
async function loadApiUrl() {
  vi.resetModules();

  return (await import("./api-url")).API_URL;
}

describe("API_URL", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env["NEXT_PUBLIC_API_URL"];
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("usa el valor configurado", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.relay.example.com");

    await expect(loadApiUrl()).resolves.toBe("https://api.relay.example.com");
  });

  it("quita la barra final", async () => {
    // El resto del código concatena rutas que ya empiezan por "/", así que una
    // barra de más produce "//auth/login".
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.relay.example.com/");

    await expect(loadApiUrl()).resolves.toBe("https://api.relay.example.com");
  });

  it("cae a localhost en desarrollo, para que pnpm dev funcione sin configurar nada", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(loadApiUrl()).resolves.toBe("http://localhost:4000");
  });

  it("rompe el build en producción si falta la variable", async () => {
    // El fallo que esto evita: la aplicación compila sin un aviso, apunta a
    // localhost, y en el navegador de quien la usa no conecta con nada — sin
    // log que lo explique y sin arreglo salvo reconstruir.
    vi.stubEnv("NODE_ENV", "production");

    await expect(loadApiUrl()).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it("el error explica que la variable se incrusta al compilar", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(loadApiUrl()).rejects.toThrow(/compilar/);
  });
});
