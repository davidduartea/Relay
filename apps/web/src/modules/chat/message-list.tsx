"use client";

import { useEffect, useRef } from "react";

import { Seal } from "@/modules/ui/seal";
import { isPending } from "./use-chat";
import type { ChatMessage } from "./use-chat";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
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
          const newDay = !previous || !sameDay(previous.createdAt, message.createdAt);

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

function DaySeparator({ iso }: { iso: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="bg-rule h-px flex-1" />
      <span className="text-ink-muted text-xs font-semibold tracking-[0.14em] uppercase">
        {formatDay(iso)}
      </span>
      <span aria-hidden="true" className="bg-rule h-px flex-1" />
    </div>
  );
}

/**
 * Mensaje ajeno: sello, nombre y el texto desnudo.
 *
 * Sin burbuja a propósito. La burbuja sólo la lleva lo propio, así que el lado
 * y el relleno bastan para saber de quién es cada mensaje sin mirar el nombre.
 */
function TheirMessage({ message, grouped }: { message: ChatMessage; grouped: boolean }) {
  return (
    <div className="flex max-w-[84%] gap-3 sm:max-w-[74%]">
      {grouped ? (
        <span aria-hidden="true" className="size-6.5 flex-none" />
      ) : (
        <Seal name={message.authorName} />
      )}

      <div className="flex min-w-0 flex-col gap-1">
        {!grouped && (
          <p className="flex items-baseline gap-2">
            <span className="text-xs font-semibold">{message.authorName}</span>
            <time dateTime={message.createdAt} className="text-ink-muted text-xs font-medium">
              {formatTime(message.createdAt)}
            </time>
          </p>
        )}
        {/* En los mensajes agrupados el nombre no se repite en pantalla, pero
            sí en el texto accesible: quien escucha no tiene la pista visual de
            que siguen siendo de la misma persona. */}
        {grouped && <span className="sr-only">{message.authorName}, </span>}
        <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
          {message.body}
        </p>
      </div>
    </div>
  );
}

/**
 * Mensaje propio: bloque índigo a la derecha, sin nombre.
 *
 * Mientras el servidor no confirma, el bloque va en filete discontinuo en vez
 * de relleno. Es la misma forma que el botón ocupado del formulario: «esto está
 * en marcha, todavía no ha pasado».
 */
function OwnMessage({ message }: { message: ChatMessage }) {
  const pending = isPending(message);

  return (
    <div className="ml-auto flex max-w-[84%] flex-col items-end gap-1 sm:max-w-[66%]">
      <p
        className={`rounded-control px-3 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
          pending ? "border-border text-ink-muted border border-dashed" : "bg-blue text-white"
        }`}
      >
        <span className="sr-only">Tú, </span>
        {message.body}
        {!pending && (
          <time
            dateTime={message.createdAt}
            className="text-on-blue-muted ml-2.5 text-xs font-medium"
          >
            {formatTime(message.createdAt)}
          </time>
        )}
      </p>

      {pending && (
        <span className="text-ink-muted text-xs font-medium">
          <span aria-hidden="true">◌</span> Enviando…
        </span>
      )}
    </div>
  );
}

/**
 * La hora, en 24 horas.
 *
 * Con el locale del navegador salía «02:16 a.m.» en una interfaz que está
 * entera en español: el formato de 12 horas casi no se usa aquí, y el sufijo
 * ocupa el doble en una columna donde el diseño reserva sitio para cuatro
 * cifras.
 */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * «Hoy», «Ayer» o «martes 18».
 *
 * Una fecha completa en el separador del día de hoy es información que ya se
 * tiene; la palabra es más rápida de leer que descifrar el número.
 */
function formatDay(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);

  yesterday.setDate(today.getDate() - 1);

  if (sameDay(iso, today.toISOString())) {
    return "Hoy";
  }

  if (sameDay(iso, yesterday.toISOString())) {
    return "Ayer";
  }

  return date.toLocaleDateString("es", { weekday: "long", day: "numeric" });
}

function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
