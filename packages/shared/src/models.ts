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
