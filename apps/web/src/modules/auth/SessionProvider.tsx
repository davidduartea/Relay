"use client";

import type { AuthUser } from "@relay/shared";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { requestSocketTicket, signOut as signOutAction } from "./actions";

interface SessionValue {
  user: AuthUser;
  /**
   * Pide un ticket para abrir el socket.
   *
   * Devuelve `null` cuando la sesión ya no vale, que es la señal para dejar de
   * reintentar y mandar al login.
   */
  getSocketTicket: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * La sesión en el cliente, que ya casi no existe.
 *
 * Antes guardaba el access y el refresh en `localStorage` y los renovaba desde
 * aquí. Ahora los tokens viven en cookies `httpOnly` y este contexto sólo
 * conoce **quién** eres — nunca **cómo** demostrarlo.
 *
 * El usuario llega desde el servidor, no de una lectura de `localStorage` en
 * un efecto, así que desaparece el estado `ready` y el parpadeo que obligaba a
 * pintar «Cargando…» en el primer render de cada pantalla.
 */
export function SessionProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const router = useRouter();

  const signOut = useCallback(async () => {
    await signOutAction();

    // `refresh()` además de navegar: sin él, el árbol de servidor cacheado
    // seguiría teniendo al usuario dentro y volver atrás lo mostraría.
    router.replace("/login");
    router.refresh();
  }, [router]);

  const value = useMemo<SessionValue>(
    () => ({ user, getSocketTicket: requestSocketTicket, signOut }),
    [user, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error("useSession fuera de <SessionProvider>");
  }

  return value;
}
