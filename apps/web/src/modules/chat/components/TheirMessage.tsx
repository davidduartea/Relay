import { formatTime } from "@/lib/format-time";
import { Seal } from "@/components/Seal";
import type { ChatMessage } from "@/modules/chat/hooks/useChat";

/**
 * Mensaje ajeno: sello, nombre y el texto desnudo.
 *
 * Sin burbuja a propósito. La burbuja sólo la lleva lo propio, así que el lado
 * y el relleno bastan para saber de quién es cada mensaje sin leer el nombre.
 */
export function TheirMessage({ message, grouped }: { message: ChatMessage; grouped: boolean }) {
  return (
    <div className="flex max-w-[84%] gap-3 sm:max-w-[74%]">
      {grouped ? (
        // Hueco del ancho de un sello para que el texto siga alineado con el
        // del mensaje anterior.
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
