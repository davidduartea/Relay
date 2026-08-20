/** Modelos de dominio compartidos entre API y web. */

export interface Message {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  body: string;
  /** ISO 8601. Se serializa como string porque JSON no tiene fechas. */
  createdAt: string;
  /** Eco del id del cliente, para reconciliar el update optimista. */
  clientId: string;
}

export interface PresenceUser {
  id: string;
  displayName: string;
}

export interface TypingState {
  roomId: string;
  userId: string;
  displayName: string;
  isTyping: boolean;
}

export interface Room {
  id: string;
  slug: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface TokenPair {
  /** Vida corta. Viaja en cada petición y no se puede revocar. */
  accessToken: string;
  /** Vida larga. Sólo se usa contra /auth/refresh y sí se puede revocar. */
  refreshToken: string;
}

export interface AuthSession {
  user: AuthUser;
  tokens: TokenPair;
}

/**
 * Cuerpo del JWT.
 *
 * `sub` es el id del usuario — el nombre viene del estándar JWT, no es un
 * capricho. Lo que se mete aquí viaja en cada petición y el cliente lo puede
 * leer (un JWT va firmado, no cifrado), así que nada sensible.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
}

/**
 * Cuerpo del refresh token.
 *
 * `jti` es un identificador único por token, y no es decorativo: sin él, dos
 * refresh emitidos dentro del mismo segundo salen idénticos — mismo `sub`,
 * mismo `iat` (que va en segundos), misma firma, mismo string. La rotación
 * entonces no rota nada y un refresh robado sigue valiendo después de que el
 * usuario legítimo renueve.
 */
export interface RefreshPayload extends JwtPayload {
  jti: string;
}
