"use client";

import type { AuthSession, AuthUser } from "@relay/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { api } from "@/lib/api-client";
import { clearSession, readSession, writeSession } from "@/lib/session-store";

interface SessionValue {
  user: AuthUser | null;
  accessToken: string | null;
  /** Falso hasta que se ha leído localStorage, para no parpadear al login. */
  ready: boolean;
  signIn: (session: AuthSession) => void;
  signOut: () => Promise<void>;
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

  const value = useMemo<SessionValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.tokens.accessToken ?? null,
      ready,
      signIn,
      signOut,
    }),
    [session, ready, signIn, signOut],
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
