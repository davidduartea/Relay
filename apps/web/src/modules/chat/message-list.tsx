"use client";

import { useEffect, useRef } from "react";

import { isPending } from "./use-chat";
import type { ChatMessage } from "./use-chat";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
}

export function MessageList({ messages, currentUserId }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // `block: "nearest"` en vez de un scroll suave a lo bruto: si quien lee
    // subió a mirar mensajes viejos, arrastrarlo al fondo cada vez que alguien
    // escribe hace la conversación imposible de seguir.
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <p className="text-ink-muted flex flex-1 items-center justify-center text-sm">
        Todavía no hay mensajes. Escribe el primero.
      </p>
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
      className="flex-1 overflow-y-auto"
    >
      <ol className="flex flex-col gap-3 p-4">
        {messages.map((message) => {
          const mine = message.authorId === currentUserId;

          return (
            <li
              key={message.clientId}
              className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
            >
              <div
                className={[
                  "max-w-[min(32rem,80%)] rounded-lg px-3 py-2 text-sm",
                  mine ? "bg-accent text-white" : "bg-surface text-ink border-ink/10 border",
                  isPending(message) ? "opacity-60" : "",
                ].join(" ")}
              >
                {!mine && (
                  <p className="text-accent mb-0.5 text-xs font-semibold">{message.authorName}</p>
                )}
                <p className="break-words whitespace-pre-wrap">{message.body}</p>
              </div>

              <p className="text-ink-muted px-1 text-xs">
                {/* El nombre del autor va en el texto accesible aunque
                    visualmente sólo se muestre en los mensajes ajenos: quien
                    escucha no tiene la pista del color ni la alineación. */}
                <span className="sr-only">{mine ? "Tú" : message.authorName}, </span>
                <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                {isPending(message) && <span className="ml-1">· enviando…</span>}
              </p>
            </li>
          );
        })}

        <div ref={endRef} aria-hidden="true" />
      </ol>
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
