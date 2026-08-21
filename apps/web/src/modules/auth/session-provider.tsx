"use client";

import type { AuthSession, AuthUser } from "@relay/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { api } from "@/lib/api-client";
import { clearSession, readSession, writeSession } from "@/lib/session-store";
import { createTokenRefresher } from "@/lib/token-refresher";

interface SessionValue {
  user: AuthUser | null;
  accessToken: string | null;
  /** Falso hasta que se ha leído localStorage, para no parpadear al login. */
  ready: boolean;
  signIn: (session: AuthSession) => void;
  signOut: () => Promise<void>;
  /**
   * Renueva la sesión y devuelve el nuevo access token, o `null` si el refresh
   * ya no vale — en cuyo caso la sesión local queda limpia y toca volver a
   * entrar. Las llamadas concurrentes comparten una sola petición.
   */
  refresh: () => Promise<string | null>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  // La lectura va en un efecto y no en el estado inicial porque localStorage
  // no existe en el servidor: leerlo durante el render daría un HTML distinto
  // al del cliente y React avisaría de la discrepancia de hidratación.
  useEffect(() => {
    setSession(readSession());
    setReady(true);
  }, []);

  // El deduplicador vive en una ref para que sobreviva a los re-render: si se
  // recreara en cada uno, cada render tendría su propia promesa "en vuelo" y
  // la deduplicación no serviría de nada.
  const refreshSession = useRef(createTokenRefresher(api.refresh)).current;

  const signIn = useCallback((next: AuthSession) => {
    writeSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    // El estado local se limpia pase lo que pase: si la llamada falla, el
    // usuario igualmente quiso salir, y dejarlo dentro sería peor que no
    // haber invalidado el refresh en el servidor.
    try {
      if (session) {
        await api.logout(session.tokens.accessToken);
      }
    } finally {
      clearSession();
      setSession(null);
    }
  }, [session]);

  const refresh = useCallback(async (): Promise<string | null> => {
    // Se lee de localStorage y no del estado porque puede haber otra pestaña
    // que ya renovó: el estado de este componente estaría desactualizado y
    // mandaríamos un refresh token que el servidor acaba de rotar.
    const stored = readSession();

    if (!stored) {
      return null;
    }

    const renewed = await refreshSession(stored.tokens.refreshToken);

    if (!renewed) {
      clearSession();
      setSession(null);

      return null;
    }

    writeSession(renewed);
    setSession(renewed);

    return renewed.tokens.accessToken;
  }, [refreshSession]);

  const value = useMemo<SessionValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.tokens.accessToken ?? null,
      ready,
      signIn,
      signOut,
      refresh,
    }),
    [session, ready, signIn, signOut, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }

  return value;
}
