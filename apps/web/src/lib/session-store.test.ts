import type { AuthSession } from "@relay/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearSession, readSession, writeSession } from "./session-store";

const STORAGE_KEY = "relay.session";

const SESSION: AuthSession = {
  user: { id: "u1", email: "ana@relay.dev", displayName: "Ana" },
  tokens: { accessToken: "access", refreshToken: "refresh" },
};

describe("session-store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("guarda y recupera la sesión", () => {
    writeSession(SESSION);

    expect(readSession()).toEqual(SESSION);
  });

  it("devuelve null cuando no hay nada guardado", () => {
    expect(readSession()).toBeNull();
  });

  it("borra la sesión", () => {
    writeSession(SESSION);
    clearSession();

    expect(readSession()).toBeNull();
  });

  it("descarta un JSON corrupto en vez de reventar", () => {
    // localStorage lo puede tocar cualquiera desde la consola del navegador.
    window.localStorage.setItem(STORAGE_KEY, "{ esto no es json");

    expect(readSession()).toBeNull();
  });

  it("descarta una sesión con el formato de una versión anterior", () => {
    // localStorage sobrevive a los despliegues: puede contener la forma que
    // guardaba la versión de hace tres meses. Confiar en ella hace que la app
    // reviente al leer un campo que ya no existe.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: { id: "u1" } }));

    expect(readSession()).toBeNull();
  });

  it("descarta una sesión sin usuario", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tokens: { accessToken: "solo-token" } }),
    );

    expect(readSession()).toBeNull();
  });
});
