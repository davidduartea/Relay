"use client";

import { MESSAGE_MAX_LENGTH } from "@relay/shared";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

interface MessageComposerProps {
  disabled: boolean;
  onSend: (body: string) => Promise<boolean>;
  onTyping: (isTyping: boolean) => void;
}

/** Cuánto se espera sin escribir antes de avisar de que se dejó de escribir. */
const TYPING_IDLE_MS = 1500;

/** A partir de aquí aparece el contador. Antes sólo sería ruido. */
const COUNTER_FROM = MESSAGE_MAX_LENGTH - 200;

/** Crece hasta cinco líneas y a partir de ahí hace scroll. */
const MAX_LINES = 5;

export function MessageComposer({ disabled, onSend, onTyping }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  const trimmed = body.trim();
  const tooLong = body.length > MESSAGE_MAX_LENGTH;
  const canSend = trimmed.length > 0 && !tooLong && !disabled && !sending;

  /**
   * El campo crece con el texto.
   *
   * Hay que devolverlo a `auto` antes de medir: `scrollHeight` nunca baja de la
   * altura fijada, así que sin ese paso el campo crece y ya no vuelve a
   * encoger al borrar.
   *
   * `useLayoutEffect` y no `useEffect` porque el ajuste ocurre antes de pintar:
   * con el segundo, se vería un fotograma con la altura vieja.
   */
  useLayoutEffect(() => {
    const field = inputRef.current;

    if (!field) {
      return;
    }

    const lineHeight = parseFloat(getComputedStyle(field).lineHeight) || 22;
    const padding = field.offsetHeight - field.clientHeight + 22;

    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, lineHeight * MAX_LINES + padding)}px`;
  }, [body]);

  useEffect(() => {
    return () => {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
      }
    };
  }, []);

  function announceTyping() {
    if (!isTyping.current) {
      isTyping.current = true;
      onTyping(true);
    }

    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
    }

    idleTimer.current = setTimeout(() => {
      isTyping.current = false;
      onTyping(false);
    }, TYPING_IDLE_MS);
  }

  function stopTyping() {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
    }

    if (isTyping.current) {
      isTyping.current = false;
      onTyping(false);
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();

    if (!canSend) {
      return;
    }

    setSending(true);
    stopTyping();

    const sent = await onSend(trimmed);

    setSending(false);

    if (sent) {
      setBody("");
    }

    // El foco vuelve al campo pase lo que pase. Quien navega con teclado se
    // quedaría varado si el foco se pierde tras enviar, y tendría que tabular
    // de vuelta para cada mensaje.
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envía y Shift+Enter hace salto de línea, que es lo que la gente
    // espera de un chat. Un textarea da el salto de línea gratis; hay que
    // interceptar el envío.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border-rule flex flex-none flex-col gap-2 border-t px-3 py-2.5 sm:px-8 sm:py-4"
    >
      <label htmlFor="message" className="sr-only">
        Escribe un mensaje
      </label>

      <div className="flex items-end gap-2.5">
        <textarea
          id="message"
          ref={inputRef}
          rows={1}
          value={body}
          disabled={disabled}
          maxLength={MESSAGE_MAX_LENGTH * 2}
          onChange={(event) => {
            setBody(event.target.value);
            announceTyping();
          }}
          onBlur={stopTyping}
          onKeyDown={onKeyDown}
          placeholder={
            disabled ? "Conectando… podrás escribir enseguida" : "Escribe un mensaje…"
          }
          aria-describedby={tooLong ? "message-error" : undefined}
          aria-invalid={tooLong || undefined}
          className={`rounded-control min-h-11 flex-1 resize-none px-3 py-2.5 text-sm leading-[22px] outline-none disabled:opacity-60 sm:min-h-15 ${
            tooLong ? "border-error border-2" : "border-border border"
          }`}
        />

        <button
          type="submit"
          disabled={!canSend}
          aria-busy={sending || undefined}
          className={`rounded-control flex size-11 flex-none items-center justify-center text-sm font-medium sm:h-11 sm:w-auto sm:px-4.5 ${
            sending
              ? "border-border text-ink-muted border border-dashed"
              : "bg-blue text-white disabled:opacity-40"
          }`}
        >
          {/* El glifo es la versión móvil del botón; en escritorio cabe la
              palabra. Sólo uno de los dos se muestra, así que el nombre
              accesible se fija aparte para que no dependa del ancho. */}
          <span aria-hidden="true" className="sm:hidden">
            {sending ? "◌" : "↑"}
          </span>
          <span aria-hidden="true" className="hidden sm:inline">
            {sending ? "◌ Enviando" : "Enviar"}
          </span>
          <span className="sr-only">{sending ? "Enviando" : "Enviar"}</span>
        </button>
      </div>

      {(tooLong || body.length > COUNTER_FROM) && (
        <div className="flex items-baseline justify-between gap-3">
          {tooLong ? (
            // role="alert" para que se anuncie en cuanto aparece: un error que
            // sólo se ve no existe para quien usa lector de pantalla.
            <p id="message-error" role="alert" className="text-error text-xs font-medium">
              <span aria-hidden="true">⚠</span> El mensaje no puede pasar de{" "}
              {MESSAGE_MAX_LENGTH} caracteres.
            </p>
          ) : (
            <span />
          )}
          <span
            data-tabular
            className={`text-xs font-medium ${tooLong ? "text-error" : "text-ink-muted"}`}
          >
            {body.length}/{MESSAGE_MAX_LENGTH}
          </span>
        </div>
      )}
    </form>
  );
}
