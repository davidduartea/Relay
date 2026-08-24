/**
 * Dos letras a partir de un nombre.
 *
 * Con varias palabras toma la inicial de las dos primeras — «Ana Ruiz» → AR.
 * Con una sola, sus dos primeras letras — «general» → GE. Así una sala de una
 * palabra y una persona con nombre y apellido producen sellos del mismo peso
 * visual.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "··";
  }

  const letters =
    words.length === 1
      ? (words[0] ?? "").slice(0, 2)
      : words.slice(0, 2).map((word) => word[0] ?? "");

  return [...letters].join("").toUpperCase();
}
