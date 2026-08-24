import type { ConnectionState } from "@/modules/chat/hooks/useChat";

interface StatusCopy {
  label: string;
  /** Segunda señal, para que el estado no dependa sólo del color. */
  glyph: string;
  tone: "muted" | "ok" | "error";
}

/**
 * Los cuatro estados de la conexión.
 *
 * Vive aparte del componente porque es copy: cambiar uno de estos textos —
 * lo primero que ve alguien cuando el chat deja de funcionar — no debería
 * obligar a leer una pantalla entera.
 *
 * `satisfies Record<ConnectionState, …>` ata el mapa al tipo: si `useChat`
 * añade un estado, esto deja de compilar en vez de renderizar `undefined`.
 */
export const CONNECTION_STATUS = {
  connecting: { label: "Conectando…", glyph: "◌", tone: "muted" },
  connected: { label: "En línea", glyph: "●", tone: "ok" },
  offline: { label: "Sin conexión. Reintentando…", glyph: "⚠", tone: "error" },
  unauthorized: { label: "Tu sesión caducó", glyph: "⚠", tone: "error" },
} satisfies Record<ConnectionState, StatusCopy>;
