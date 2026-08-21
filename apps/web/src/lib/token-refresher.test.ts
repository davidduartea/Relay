import type { AuthSession } from "@relay/shared";
import { describe, expect, it, vi } from "vitest";

import { createTokenRefresher } from "./token-refresher";

const session = (accessToken: string): AuthSession => ({
  user: { id: "u1", email: "ana@relay.dev", displayName: "Ana" },
  tokens: { accessToken, refreshToken: `r-${accessToken}` },
});

/** Una promesa que el test resuelve cuando quiere. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("createTokenRefresher", () => {
  it("devuelve la sesión renovada", async () => {
    const refresh = vi.fn().mockResolvedValue(session("nuevo"));
    const refreshSession = createTokenRefresher(refresh);

    await expect(refreshSession("r-viejo")).resolves.toEqual(session("nuevo"));
    expect(refresh).toHaveBeenCalledWith("r-viejo");
  });

  it("una sola petición aunque le llamen tres veces a la vez", async () => {
    // Es el caso real: al caducar el token fallan a la vez la llamada HTTP, el
    // socket que se reconecta y la pestaña que vuelve del segundo plano.
    const pending = deferred<AuthSession>();
    const refresh = vi.fn().mockReturnValue(pending.promise);
    const refreshSession = createTokenRefresher(refresh);

    const todas = Promise.all([
      refreshSession("r-viejo"),
      refreshSession("r-viejo"),
      refreshSession("r-viejo"),
    ]);

    pending.resolve(session("nuevo"));

    const resultados = await todas;

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(resultados).toEqual([session("nuevo"), session("nuevo"), session("nuevo")]);
  });

  it("permite renovar de nuevo una vez terminada la anterior", async () => {
    // Si la promesa no se limpiara al acabar, la primera renovación sería la
    // única de toda la vida de la aplicación.
    const refresh = vi
      .fn()
      .mockResolvedValueOnce(session("uno"))
      .mockResolvedValueOnce(session("dos"));
    const refreshSession = createTokenRefresher(refresh);

    await refreshSession("r-viejo");
    await expect(refreshSession("r-uno")).resolves.toEqual(session("dos"));

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("devuelve null cuando el servidor rechaza el refresh", async () => {
    // El refresh caducó o el usuario cerró sesión en otro sitio. Quien llame
    // distingue null de una sesión y manda al login.
    const refresh = vi.fn().mockRejectedValue(new Error("401"));
    const refreshSession = createTokenRefresher(refresh);

    await expect(refreshSession("r-invalido")).resolves.toBeNull();
  });

  it("no deja la promesa fallida cacheada", async () => {
    // Un fallo transitorio de red no puede dejar la sesión condenada: el
    // siguiente intento tiene que volver a preguntar.
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValueOnce(session("nuevo"));
    const refreshSession = createTokenRefresher(refresh);

    await expect(refreshSession("r-viejo")).resolves.toBeNull();
    await expect(refreshSession("r-viejo")).resolves.toEqual(session("nuevo"));
  });

  it("comparte el fallo entre los que esperaban a la vez", async () => {
    const pending = deferred<AuthSession>();
    const refresh = vi.fn().mockReturnValue(pending.promise);
    const refreshSession = createTokenRefresher(refresh);

    const todas = Promise.all([refreshSession("r-viejo"), refreshSession("r-viejo")]);
    pending.reject(new Error("401"));

    await expect(todas).resolves.toEqual([null, null]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
