import { CONNECTION_STATUS } from "./connection-status";
import type { ConnectionState } from "./use-chat";

/**
 * El estado de la conexión.
 *
 * Cambian a la vez el texto, el glifo y el color del filete. Con sólo el color,
 * quien no lo distingue no sabría si sus mensajes están saliendo — y eso es lo
 * único que este componente tiene que comunicar.
 *
 * `aria-live="polite"` porque el estado cambia solo, sin que nadie lo pida.
 *
 * En móvil es la segunda línea bajo el nombre de la sala, sin filete ni glifo:
 * ahí el espacio manda y el texto ya lo dice todo. En escritorio se convierte
 * en la pastilla con filete de la cabecera.
 */
export function ConnectionBadge({ status }: { status: ConnectionState }) {
  const { label, glyph, tone } = CONNECTION_STATUS[status];
  const isError = tone === "error";

  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-2 text-xs md:border md:px-2.5 md:py-1.5 md:font-medium ${
        isError ? "text-error md:border-error" : "text-ink-muted md:border-border md:text-ink"
      }`}
    >
      <span
        aria-hidden="true"
        className={`hidden md:inline ${tone === "ok" ? "text-blue" : ""}`}
      >
        {glyph}
      </span>
      {label}
    </span>
  );
}
