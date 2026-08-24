import { formatTime } from "@/lib/format-time";
import { isPending } from "./use-chat";
import type { ChatMessage } from "./use-chat";

/**
 * Mensaje propio: bloque índigo a la derecha, sin nombre.
 *
 * Mientras el servidor no confirma, el bloque va en filete discontinuo en vez
 * de relleno. Es la misma forma que el botón ocupado del formulario: «esto está
 * en marcha, todavía no ha pasado».
 */
export function OwnMessage({ message }: { message: ChatMessage }) {
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
