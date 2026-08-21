"use client";

import { MESSAGE_MAX_LENGTH } from "@relay/shared";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

interface MessageComposerProps {
  disabled: boolean;
  onSend: (body: string) => Promise<boolean>;
  onTyping: (isTyping: boolean) => void;
}

/** Cuánto se espera sin escribir antes de avisar de que se dejó de escribir. */
const TYPING_IDLE_MS = 1500;

export function MessageComposer({ disabled, onSend, onTyping }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  const trimmed = body.trim();
  const tooLong = body.length > MESSAGE_MAX_LENGTH;
  const canSend = trimmed.length > 0 && !tooLong && !disabled && !sending;

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
    <form onSubmit={submit} className="border-ink/10 flex flex-col gap-2 border-t p-4">
      <label htmlFor="message" className="sr-only">
        Escribe un mensaje
      </label>

      <div className="flex items-end gap-2">
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
          placeholder={disabled ? "Conectando…" : "Escribe un mensaje"}
          aria-describedby={tooLong ? "message-error" : undefined}
          aria-invalid={tooLong || undefined}
          className="border-ink/15 bg-surface text-ink focus:border-accent focus:ring-accent max-h-40 min-h-11 flex-1 resize-y rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={!canSend}
          className="bg-accent focus-visible:outline-accent h-11 rounded-md px-4 text-sm font-semibold text-white transition-opacity disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {sending ? "Enviando…" : "Enviar"}
        </button>
      </div>

      {tooLong && (
        // role="alert" para que se anuncie en cuanto aparece: un error que
        // sólo se ve no existe para quien usa lector de pantalla.
        <p id="message-error" role="alert" className="text-sm text-red-700">
          El mensaje supera los {MESSAGE_MAX_LENGTH} caracteres por{" "}
          {body.length - MESSAGE_MAX_LENGTH}.
        </p>
      )}
    </form>
  );
}
