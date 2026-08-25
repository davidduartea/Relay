"use client";

import type {
  Ack,
  ClientToServerEvents,
  Message,
  PresenceUser,
  ServerToClientEvents,
} from "@relay/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

/**
 * El socket del cliente, tipado con el mismo contrato que el gateway.
 *
 * Los genéricos van al revés que en el servidor: aquí se escuchan los eventos
 * del servidor y se emiten los del cliente.
 */
type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionState = "connecting" | "connected" | "unauthorized" | "offline";

/** Un mensaje que aún no ha confirmado el servidor. */
export interface PendingMessage extends Message {
  pending: true;
}

export type ChatMessage = Message | PendingMessage;

export const isPending = (message: ChatMessage): message is PendingMessage =>
  "pending" in message;

interface UseChatOptions {
  /**
   * Consigue un ticket para el handshake.
   *
   * No se recibe el ticket ya hecho porque dura 60 segundos y vale una vez: en
   * cada reconexión hace falta uno nuevo, así que lo que se necesita es la
   * forma de pedirlo, no el valor.
   */
  getTicket: () => Promise<string | null>;
  /**
   * Dónde está el socket.
   *
   * Llega como prop desde el render del servidor y no de una variable
   * incrustada al compilar: así el origen del backend sólo lo recibe quien ya
   * tiene sesión, en vez de cualquiera que descargue el JavaScript.
   */
  socketUrl: string;
  roomId: string | null;
  currentUser: { id: string; displayName: string };
}

export function useChat({ getTicket, socketUrl, roomId, currentUser }: UseChatOptions) {
  const [status, setStatus] = useState<ConnectionState>("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<PresenceUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<PresenceUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  // El socket vive en estado y no en una ref a propósito.
  //
  // Con una ref, el efecto que registra los listeners no tiene de qué
  // depender: corre una sola vez, y en ese primer render el socket todavía no
  // existe porque el ticket se pide de forma asíncrona. Los listeners no
  // llegaban a engancharse nunca y el chat aparecía vacío al recargar la
  // página — que es como se abre casi siempre.
  const [socket, setSocket] = useState<ChatSocket | null>(null);
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // ── Conexión ──────────────────────────────────────────────────────────────
  useEffect(() => {
    /**
     * Si el último intento se quedó sin ticket que pedir.
     *
     * Distingue «la sesión caducó» de «se cayó la red», que llegan las dos
     * como `connect_error`. Con lo primero hay que parar y mandar al login;
     * con lo segundo, reintentar es justo lo correcto.
     */
    let sessionLost = false;

    /**
     * `auth` como función y no como objeto.
     *
     * Socket.IO la vuelve a llamar en **cada** intento de conexión. Con un
     * objeto fijo, la reconexión reenviaría el mismo ticket — que ya está
     * gastado, porque vale una sola vez — y no volvería a conectar nunca.
     * 📖 https://socket.io/docs/v4/client-options/#auth
     */
    const socket: ChatSocket = io(`${socketUrl}/chat`, {
      transports: ["websocket"],
      autoConnect: false,
      auth: (done) => {
        void getTicket().then((ticket) => {
          sessionLost = !ticket;
          done({ ticket: ticket ?? "" });
        });
      },
    });

    setSocket(socket);
    setStatus("connecting");

    socket.on("connect", () => {
      sessionLost = false;
      setStatus("connected");
    });
    socket.on("disconnect", () => setStatus("offline"));
    socket.on("connect_error", () => setStatus(sessionLost ? "unauthorized" : "offline"));

    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setSocket(null);
    };
  }, [getTicket, socketUrl]);

  // ── Entrar a la sala ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !roomId || status !== "connected") {
      return;
    }

    setMessages([]);
    setMembers([]);
    setTypingUsers([]);

    void socket
      .emitWithAck("room:join", { roomId })
      .then((ack: Ack<{ roomId: string }>) => {
        if (!ack.ok) {
          setError(ack.error.message);
        }
      })
      .catch(() => setError("No se pudo entrar a la sala."));

    return () => {
      void socket.emitWithAck("room:leave", { roomId }).catch(() => undefined);
    };
  }, [socket, roomId, status]);

  // ── Eventos entrantes ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) {
      return;
    }

    const onHistory = (payload: { roomId: string; messages: Message[] }) =>
      setMessages(payload.messages);

    const onMessage = (message: Message) =>
      setMessages((current) => {
        // El servidor devuelve el mensaje a todos, incluido el autor. Si ya
        // hay una copia optimista con el mismo clientId, se sustituye en su
        // sitio en vez de añadir una segunda.
        const index = current.findIndex((existing) => existing.clientId === message.clientId);

        if (index === -1) {
          return [...current, message];
        }

        const next = [...current];
        next[index] = message;

        return next;
      });

    const onPresenceSync = (payload: { users: PresenceUser[] }) => setMembers(payload.users);

    const onPresenceJoin = (payload: { user: PresenceUser }) =>
      setMembers((current) =>
        current.some((member) => member.id === payload.user.id)
          ? current
          : [...current, payload.user],
      );

    const onPresenceLeave = (payload: { userId: string }) => {
      setMembers((current) => current.filter((member) => member.id !== payload.userId));
      setTypingUsers((current) => current.filter((user) => user.id !== payload.userId));
    };

    const onTyping = (payload: { userId: string; displayName: string; isTyping: boolean }) => {
      const timers = typingTimers.current;
      clearTimeout(timers.get(payload.userId));

      if (!payload.isTyping) {
        timers.delete(payload.userId);
        setTypingUsers((current) => current.filter((user) => user.id !== payload.userId));

        return;
      }

      setTypingUsers((current) =>
        current.some((user) => user.id === payload.userId)
          ? current
          : [...current, { id: payload.userId, displayName: payload.displayName }],
      );

      // Caducidad propia: si el otro cierra la pestaña a media frase, su
      // "escribiendo…" se quedaría colgado para siempre esperando un evento
      // de fin que ya no va a llegar.
      timers.set(
        payload.userId,
        setTimeout(() => {
          timers.delete(payload.userId);
          setTypingUsers((current) => current.filter((user) => user.id !== payload.userId));
        }, 4000),
      );
    };

    socket.on("message:history", onHistory);
    socket.on("message:new", onMessage);
    socket.on("presence:sync", onPresenceSync);
    socket.on("presence:join", onPresenceJoin);
    socket.on("presence:leave", onPresenceLeave);
    socket.on("typing:update", onTyping);

    return () => {
      socket.off("message:history", onHistory);
      socket.off("message:new", onMessage);
      socket.off("presence:sync", onPresenceSync);
      socket.off("presence:join", onPresenceJoin);
      socket.off("presence:leave", onPresenceLeave);
      socket.off("typing:update", onTyping);
    };
  }, [socket]);

  // Los temporizadores de escritura se limpian al desmontar, o quedarían
  // pendientes intentando actualizar un componente que ya no existe.
  useEffect(() => {
    const timers = typingTimers.current;

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  // ── Acciones ──────────────────────────────────────────────────────────────
  const send = useCallback(
    async (body: string): Promise<boolean> => {
      if (!socket || !roomId || !currentUser) {
        return false;
      }

      const clientId = crypto.randomUUID();

      // Se pinta antes de que el servidor conteste: escribir y esperar 200ms a
      // ver tu propio mensaje hace que el chat se sienta roto.
      const optimistic: PendingMessage = {
        id: clientId,
        roomId,
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        body,
        clientId,
        createdAt: new Date().toISOString(),
        pending: true,
      };

      setMessages((current) => [...current, optimistic]);

      try {
        const ack: Ack<Message> = await socket.emitWithAck("message:send", {
          roomId,
          body,
          clientId,
        });

        if (!ack.ok) {
          // Se retira la copia optimista: dejarla puesta le diría al usuario
          // que su mensaje llegó cuando no lo hizo.
          setMessages((current) => current.filter((message) => message.clientId !== clientId));
          setError(ack.error.message);

          return false;
        }

        return true;
      } catch {
        setMessages((current) => current.filter((message) => message.clientId !== clientId));
        setError("No se pudo enviar el mensaje.");

        return false;
      }
    },
    [socket, roomId, currentUser],
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (roomId) {
        socket?.emit("typing:set", { roomId, isTyping });
      }
    },
    [socket, roomId],
  );

  const dismissError = useCallback(() => setError(null), []);

  const others = useMemo(
    () => members.filter((member) => member.id !== currentUser?.id),
    [members, currentUser],
  );

  return {
    status,
    messages,
    members,
    others,
    typingUsers,
    error,
    send,
    setTyping,
    dismissError,
  };
}
