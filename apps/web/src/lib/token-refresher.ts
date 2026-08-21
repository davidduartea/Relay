import type { AuthSession } from "@relay/shared";

export type RefreshFn = (refreshToken: string) => Promise<AuthSession>;

/**
 * Renueva la sesión, deduplicando las peticiones concurrentes.
 *
 * La deduplicación no es un lujo: cuando el access token caduca, todo lo que
 * dependía de él falla a la vez — la llamada HTTP en curso, el socket que se
 * reconecta, la pestaña que vuelve del segundo plano. Sin coordinación, cada
 * uno lanzaría su propio refresh.
 *
 * Y eso no sería sólo ineficiente, sería incorrecto: el servidor **rota** el
 * refresh token en cada uso. El primero en llegar invalida al resto, así que
 * las demás peticiones recibirían 401 y cerrarían una sesión que estaba
 * perfectamente viva.
 *
 * Con una sola promesa en vuelo, todos esperan el mismo resultado.
 */
export function createTokenRefresher(refresh: RefreshFn) {
  let inFlight: Promise<AuthSession | null> | null = null;

  return function refreshSession(refreshToken: string): Promise<AuthSession | null> {
    inFlight ??= refresh(refreshToken)
      .catch(() => null)
      .finally(() => {
        // Se limpia al terminar para que el siguiente vencimiento pueda
        // renovar otra vez. Si no, la primera renovación sería la única.
        inFlight = null;
      });

    return inFlight;
  };
}
