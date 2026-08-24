"use client";

import { useEffect, useRef } from "react";

import { isSameDay } from "@/lib/format-time";
import { Seal } from "@/components/Seal";
import { DaySeparator } from "@/modules/chat/components/DaySeparator";
import { OwnMessage } from "@/modules/chat/components/OwnMessage";
import { TheirMessage } from "@/modules/chat/components/TheirMessage";
import type { ChatMessage } from "@/modules/chat/hooks/useChat";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  /** Para el sello del estado vacío. */
  roomName: string;
}

export function MessageList({ messages, currentUserId, roomName }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // `block: "nearest"` en vez de un scroll suave a lo bruto: si quien lee
    // subió a mirar mensajes viejos, arrastrarlo al fondo cada vez que alguien
    // escribe hace la conversación imposible de seguir.
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        {/* El sello vacío de la sala hace de única imagen. Sin ilustración. */}
        <Seal name={roomName} size="screen" />
        <p className="text-sm">
          Todavía no hay mensajes.
          <br />
          <span className="text-ink-muted">Escribe el primero.</span>
        </p>
      </div>
    );
  }

  return (
    // El log envuelve la lista en vez de ser la lista.
    //
    // role="log" con aria-live="polite" hace que un lector de pantalla anuncie
    // los mensajes nuevos sin interrumpir lo que esté leyendo — sin esto, en un
    // chat el contenido cambia solo y quien no ve la pantalla no se entera.
    // Pero poner role="log" sobre el <ol> sustituye su rol de lista y deja a
    // los <li> sin padre válido. Con el div fuera, se conservan los dos.
    //
    // aria-relevant="additions" evita que relea la lista entera al re-render.
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Mensajes"
      // tabIndex={0} porque la región tiene scroll: sin foco no se puede
      // desplazar con las flechas, y quien no usa ratón no llega a los
      // mensajes antiguos. Lo detectó axe con la regla
      // scrollable-region-focusable.
      tabIndex={0}
      className="flex-1 overflow-y-auto focus-visible:-outline-offset-2"
    >
      <ol className="flex flex-col gap-3.5 px-4 py-4.5 sm:px-8">
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const mine = message.authorId === currentUserId;
          const newDay =
            !previous || !isSameDay(new Date(previous.createdAt), new Date(message.createdAt));

          // Se agrupa con el anterior sólo si es del mismo remitente y del
          // mismo día: repetir sello y nombre en cinco mensajes seguidos de la
          // misma persona llena la pantalla de ruido.
          const grouped = !newDay && previous?.authorId === message.authorId;

          return (
            <li key={message.clientId} className="contents">
              {newDay && <DaySeparator iso={message.createdAt} />}
              {mine ? (
                <OwnMessage message={message} />
              ) : (
                <TheirMessage message={message} grouped={grouped} />
              )}
            </li>
          );
        })}

        <div ref={endRef} aria-hidden="true" />
      </ol>
    </div>
  );
}
