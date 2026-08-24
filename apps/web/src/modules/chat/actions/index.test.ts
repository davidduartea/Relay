import { afterEach, describe, expect, it, vi } from "vitest";

import { getRooms } from ".";

afterEach(() => {
  vi.unstubAllGlobals();
});

function respondWith(body: unknown, init: { ok: boolean; status: number }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init.ok,
    status: init.status,
    json: async () => body,
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("getRooms", () => {
  it("devuelve las salas del API", async () => {
    respondWith([{ id: "r1", name: "General", slug: "general" }], { ok: true, status: 200 });

    await expect(getRooms()).resolves.toEqual([{ id: "r1", name: "General", slug: "general" }]);
  });

  it("pide /rooms sin caché", async () => {
    // La lista cambia cuando alguien crea una sala. Una sala nueva que no
    // aparece hasta el siguiente despliegue no sirve de nada.
    const fetchMock = respondWith([], { ok: true, status: 200 });

    await getRooms();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/rooms$/),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("falla nombrando el código cuando el API responde mal", async () => {
    // Se lanza a propósito en vez de devolver una lista vacía: una columna de
    // salas vacía parece «todavía no hay salas», que es justo lo contrario de
    // lo que ha pasado. Lanzando, lo recoge `error.tsx` y ofrece reintentar.
    respondWith(null, { ok: false, status: 503 });

    await expect(getRooms()).rejects.toThrow(/503/);
  });
});
