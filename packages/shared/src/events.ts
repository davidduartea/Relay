import type { Message, PresenceUser, TypingState } from "./models";

/**
 * Contrato de eventos del socket.
 *
 * Este archivo es la única fuente de verdad para lo que viaja por el cable.
 * El gateway de Nest y el cliente de Next importan los mismos tipos, así que
 * un cambio de forma en un evento rompe la compilación de ambos lados a la vez
 * — que es exactamente lo que queremos: el error aparece en `pnpm typecheck`,
 * no en producción a las 2am.
 */

/** Eventos que el servidor emite hacia los clientes. */
export interface ServerToClientEvents {
  "message:new": (message: Message) => void;
  "message:history": (payload: { roomId: string; messages: Message[] }) => void;
  "presence:sync": (payload: { roomId: string; users: PresenceUser[] }) => void;
  "presence:join": (payload: { roomId: string; user: PresenceUser }) => void;
  "presence:leave": (payload: { roomId: string; userId: string }) => void;
  "typing:update": (payload: TypingState) => void;
}

/**
 * Eventos que el cliente emite hacia el servidor.
 *
 * Todos usan el patrón de acknowledgement de Socket.IO: el último argumento es
 * un callback que el servidor invoca con `Ack<T>`. Así el cliente sabe si su
 * mensaje se persistió de verdad, en vez de asumirlo — que es la diferencia
 * entre un update optimista que se puede revertir y uno que miente.
 */
export interface ClientToServerEvents {
  "room:join": (payload: { roomId: string }, ack: AckFn<{ roomId: string }>) => void;
  "room:leave": (payload: { roomId: string }, ack: AckFn<{ roomId: string }>) => void;
  "message:send": (payload: SendMessagePayload, ack: AckFn<Message>) => void;
  "typing:set": (payload: { roomId: string; isTyping: boolean }) => void;
}

export interface SendMessagePayload {
  roomId: string;
  body: string;
  /**
   * Id generado en el cliente antes de mandar. Permite dos cosas: reconciliar
   * el mensaje optimista con el confirmado cuando vuelve por `message:new`,
   * y que el servidor descarte duplicados si el cliente reintenta tras una
   * reconexión. Sin esto, un reintento crea mensajes repetidos.
   */
  clientId: string;
}

/** Resultado discriminado de un acknowledgement. */
export type Ack<T> = { ok: true; data: T } | { ok: false; error: AckError };

export type AckFn<T> = (result: Ack<T>) => void;

export interface AckError {
  code: AckErrorCode;
  message: string;
}

export type AckErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "ROOM_NOT_FOUND"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL";

/** Datos que el gateway adjunta al socket tras autenticar. */
export interface SocketData {
  userId: string;
  displayName: string;
}

/** Helpers para construir acks sin repetir la forma en cada handler. */
export const ackOk = <T>(data: T): Ack<T> => ({ ok: true, data });

export const ackError = (code: AckErrorCode, message: string): Ack<never> => ({
  ok: false,
  error: { code, message },
});
