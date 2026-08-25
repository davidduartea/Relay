import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Las cookies de Next se sustituyen por un tarro en memoria.
 *
 * `next/headers` sólo funciona dentro de una petición real, y lo que aquí
 * interesa comprobar no es su implementación sino **qué** se guarda y con qué
 * banderas: una cookie de sesión sin `httpOnly` anularía el cambio entero.
 */
const jar = {
  store: new Map<string, { value: string; options: Record<string, unknown> }>(),
  set: vi.fn((name: string, value: string, options: Record<string, unknown>) => {
    jar.store.set(name, { value, options });
  }),
  get: vi.fn((name: string) => {
    const entry = jar.store.get(name);

    return entry ? { name, value: entry.value } : undefined;
  }),
  delete: vi.fn((name: string) => jar.store.delete(name)),
};

vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(jar) }));

const { signIn, signOut, requestSocketTicket, getCurrentUser } = await import(".");

const SESSION = {
  user: { id: "user-ana", email: "ana@relay.dev", displayName: "Ana" },
  tokens: { accessToken: "access-nuevo", refreshToken: "refresh-nuevo" },
};

const CREDENTIALS = { email: "ana@relay.dev", password: "contrasena-larga" };

function respondWith(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers(),
    json: async () => body,
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

beforeEach(() => {
  jar.store.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signIn", () => {
  it("guarda los dos tokens en cookies httpOnly", async () => {
    // Es el cambio entero: sin `httpOnly`, cualquier script inyectado las lee
    // y estaríamos como con localStorage.
    respondWith(SESSION);

    await signIn(CREDENTIALS);

    for (const name of ["relay_access", "relay_refresh"]) {
      expect(jar.store.get(name)?.options).toMatchObject({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
  });

  it("no devuelve ningún token al cliente", async () => {
    // Lo que vuelve del server action cruza al navegador. Si llevara los
    // tokens, la cookie httpOnly no serviría de nada.
    respondWith(SESSION);

    const result = await signIn(CREDENTIALS);

    expect(result).toEqual(SESSION.user);
    expect(JSON.stringify(result)).not.toContain("access-nuevo");
    expect(JSON.stringify(result)).not.toContain("refresh-nuevo");
  });

  it("rechaza credenciales mal formadas sin llamar al API", async () => {
    const fetchMock = respondWith(SESSION);

    const result = await signIn({ email: "no-es-correo", password: "" });

    expect(result).toMatchObject({
      fieldErrors: expect.objectContaining({ email: expect.any(String) }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("traduce los errores por campo del servidor", async () => {
    respondWith(
      { errors: [{ field: "email", message: "Ese correo ya está registrado" }] },
      {
        ok: false,
        status: 409,
      },
    );

    await expect(signIn(CREDENTIALS)).resolves.toMatchObject({
      fieldErrors: { email: "Ese correo ya está registrado" },
    });
  });

  it("distingue el API caído de unas credenciales malas", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(signIn(CREDENTIALS)).resolves.toEqual({ error: "No se pudo conectar." });
  });

  it("pasa los segundos de espera del límite de intentos", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "42" }),
      json: async () => ({}),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(signIn(CREDENTIALS)).resolves.toMatchObject({ retryAfter: 42 });
  });
});

describe("signOut", () => {
  it("borra las cookies aunque el API falle", async () => {
    // Quien pulsa «Salir» tiene que salir pase lo que pase. Conservar la
    // sesión local porque el servidor no contestó sería lo contrario.
    jar.store.set("relay_access", { value: "access", options: {} });
    jar.store.set("relay_refresh", { value: "refresh", options: {} });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("caído")));

    await signOut();

    expect(jar.store.has("relay_access")).toBe(false);
    expect(jar.store.has("relay_refresh")).toBe(false);
  });

  it("avisa al API para invalidar el refresh token", async () => {
    // Sin esto, borrar la cookie sólo olvida la sesión en este navegador y el
    // refresh seguiría valiendo una semana.
    jar.store.set("relay_access", { value: "access", options: {} });
    const fetchMock = respondWith(null, { status: 204 });

    await signOut();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/logout$/),
      expect.objectContaining({ headers: { Authorization: "Bearer access" } }),
    );
  });
});

describe("requestSocketTicket", () => {
  it("devuelve el ticket que emite el API", async () => {
    jar.store.set("relay_access", { value: "access", options: {} });
    respondWith({ ticket: "un-ticket", expiresInSeconds: 60 });

    await expect(requestSocketTicket()).resolves.toBe("un-ticket");
  });

  it("devuelve null sin sesión, sin llamar al API", async () => {
    const fetchMock = respondWith({});

    await expect(requestSocketTicket()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getCurrentUser", () => {
  it("pregunta al API en vez de decodificar el token", async () => {
    // El servidor de Next no tiene el secreto: decodificar sería leer sin
    // verificar, y una sesión revocada seguiría pareciendo válida.
    jar.store.set("relay_access", { value: "access", options: {} });
    const fetchMock = respondWith(SESSION.user);

    await expect(getCurrentUser()).resolves.toEqual(SESSION.user);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/me$/),
      expect.objectContaining({ headers: { Authorization: "Bearer access" } }),
    );
  });

  it("devuelve null si el API rechaza el token", async () => {
    jar.store.set("relay_access", { value: "caducado", options: {} });
    respondWith({}, { ok: false, status: 401 });

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
