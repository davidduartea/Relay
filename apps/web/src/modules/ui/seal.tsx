import { initials } from "@/lib/initials";

/**
 * Los tamaños del sistema, del sello de portada al de una fila de presencia.
 *
 * Se exporta para que quien componga alrededor pueda reservar el mismo hueco
 * — la lista de mensajes deja un espacio del ancho de un sello donde no lo
 * pinta, para que los mensajes agrupados queden alineados.
 */
export const SEAL_SIZES = {
  brand: "size-13 text-[22px]", // 52px — sólo portada
  screen: "size-8.5 text-[15px]", // 34px — cabecera de sala en móvil
  header: "size-7 text-[13px]", // 28px — cabecera de sala
  row: "size-6.5 text-xs", // 26px — lista de salas y remitentes
  compact: "size-6 text-xs", // 24px — filas de presencia
} as const;

export type SealSize = keyof typeof SEAL_SIZES;

interface SealProps {
  /** De aquí salen las dos letras. */
  name: string;
  size?: SealSize;
  /** Índigo relleno en vez de filete. */
  filled?: boolean;
  /** Filete discontinuo: se usa para lo que aún no está confirmado. */
  dashed?: boolean;
}

/**
 * El sello.
 *
 * Un cuadrado con dos iniciales que identifica lo mismo en toda la aplicación:
 * una sala, un remitente, la marca. Es el único objeto gráfico del sistema — no
 * hay iconos ni ilustraciones — así que aparece en cinco tamaños y en dos
 * rellenos, pero siempre es el mismo objeto.
 *
 * Relleno índigo = «esto es lo activo, o eres tú». Filete = todo lo demás.
 */
export function Seal({ name, size = "row", filled = false, dashed = false }: SealProps) {
  const skin = filled
    ? "bg-blue text-white"
    : `text-ink-muted border border-border ${dashed ? "border-dashed" : ""}`;

  return (
    // aria-hidden porque las iniciales no son información: al lado siempre está
    // el nombre completo en texto. Para quien escucha, leer «GE general» sería
    // ruido.
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center font-[family-name:var(--font-display)] tracking-[0.04em] ${SEAL_SIZES[size]} ${skin}`}
    >
      {initials(name)}
    </span>
  );
}
