import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api } from "./api-client";

const CREDENTIALS = { email: "ana@relay.dev", password: "contrasena-larga-123" };

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe("api-client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve el cuerpo cuando la respuesta es correcta", async () => {
    const session = { user: { id: "u1" }, tokens: { accessToken: "a" } };
    fetchMock.mockResolvedValue(mockResponse(200, session));

    await expect(api.login(CREDENTIALS)).resolves.toEqual(session);
  });

  it("manda el cuerpo como JSON", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, {}));

    await api.login(CREDENTIALS);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(CREDENTIALS);
  });

  it("conserva los errores por campo que manda el servidor", async () => {
    // El formulario los usa para señalar el input concreto; aplanarlos a un
    // mensaje suelto obligaría al usuario a adivinar qué campo está mal.
    fetchMock.mockResolvedValue(
      mockResponse(400, {
        message: "La petición no pasó la validación",
        errors: [{ field: "password", message: "Mínimo 12 caracteres" }],
      }),
    );

    const error = await api.login(CREDENTIALS).catch((e: unknown) => e as ApiError);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).fields).toEqual([
      { field: "password", message: "Mínimo 12 caracteres" },
    ]);
  });

  it("da un mensaje utilizable cuando el error no trae cuerpo", async () => {
    // Un 502 de un proxy no devuelve JSON. Sin este camino, el usuario vería
    // un error de parseo en vez de algo que pueda entender.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error("no es json")),
    } as unknown as Response);

    const error = await api.login(CREDENTIALS).catch((e: unknown) => e as ApiError);

    expect((error as ApiError).message).toMatch(/inténtalo de nuevo/i);
    expect((error as ApiError).fields).toEqual([]);
  });

  it("no intenta parsear un 204 sin contenido", async () => {
    // logout responde 204. Llamar a .json() sobre un cuerpo vacío lanza.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error("sin cuerpo")),
    } as unknown as Response);

    await expect(api.logout("un-token")).resolves.toBeUndefined();
  });

  it("adjunta el token en la cabecera al cerrar sesión", async () => {
    fetchMock.mockResolvedValue(mockResponse(204, null));

    await api.logout("un-token");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer un-token");
  });
});
