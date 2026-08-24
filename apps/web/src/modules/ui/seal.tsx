/**
 * El sello.
 *
 * Un cuadrado con dos letras que identifica lo mismo en toda la aplicación: una
 * sala, un remitente, la marca. Es el único objeto gráfico del sistema — no hay
 * iconos ni ilustraciones — así que aparece en cinco tamaños y en dos rellenos,
 * pero siempre es el mismo objeto.
 *
 * Relleno índigo = «esto es lo activo, o eres tú». Filete = todo lo demás.
 */

/** Los tamaños del sistema, del sello de portada al de una fila de presencia. */
const SIZES = {
  brand: "size-13 text-[22px]", // 52px — sólo portada
  screen: "size-8.5 text-[15px]", // 34px — cabecera de sala en móvil
  header: "size-7 text-[13px]", // 28px — cabecera de sala
  row: "size-6.5 text-xs", // 26px — lista de salas y remitentes
  compact: "size-6 text-xs", // 24px — filas de presencia
} as const;

interface SealProps {
  /** De aquí salen las dos letras. */
  name: string;
  size?: keyof typeof SIZES;
  /** Índigo relleno en vez de filete. */
  filled?: boolean;
  /** Filete discontinuo: se usa para lo que aún no está confirmado. */
  dashed?: boolean;
}

export function Seal({ name, size = "row", filled = false, dashed = false }: SealProps) {
  const skin = filled
    ? "bg-blue text-white"
    : `text-ink-muted border ${dashed ? "border-dashed border-border" : "border-border"}`;

  return (
    // aria-hidden porque las iniciales no son información: al lado siempre está
    // el nombre completo en texto. Para quien escucha, leer «GE general» sería
    // ruido.
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center font-[family-name:var(--font-display)] tracking-[0.04em] ${SIZES[size]} ${skin}`}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Dos letras a partir de un nombre.
 *
 * Con varias palabras toma la inicial de las dos primeras — «Ana Ruiz» → AR.
 * Con una sola, sus dos primeras letras — «general» → GE. Así una sala de una
 * palabra y una persona con nombre y apellido producen sellos del mismo peso.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "··";
  }

  const letters =
    words.length === 1
      ? (words[0] ?? "").slice(0, 2)
      : words.slice(0, 2).map((w) => w[0] ?? "");

  return [...letters].join("").toUpperCase();
}
