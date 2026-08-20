import type { AuthSession, AuthUser, TokenPair } from "@relay/shared";

const STORAGE_KEY = "relay.session";

export interface StoredSession {
  user: AuthUser;
  tokens: TokenPair;
}

/**
 * Dónde vive la sesión.
 *
 * En `localStorage`, con la desventaja conocida: cualquier XSS puede leerla.
 * La alternativa segura son cookies httpOnly, que el JavaScript no ve — pero
 * el handshake de Socket.IO manda el token por `auth`, y eso exige que el
 * cliente pueda leerlo. Elegir cookies significaría autenticar el socket por
 * cookie y montar CSRF para el resto, que es la decisión correcta el día que
 * esto salga a producción y no vale la pena antes.
 *
 * Mientras tanto, lo que sí se hace: el access token dura 15 minutos, el
 * refresh se rota en cada uso y el logout lo invalida en el servidor.
 */
export function readSession(): StoredSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;

    // Se comprueba la forma en vez de confiar: localStorage sobrevive a los
    // despliegues, así que puede contener el formato de una versión anterior.
    return parsed.user?.id && parsed.tokens?.accessToken ? (parsed as StoredSession) : null;
  } catch {
    return null;
  }
}

export function writeSession(session: AuthSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
