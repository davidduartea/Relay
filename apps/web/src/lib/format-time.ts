/**
 * Fechas y horas de la conversación, siempre en español.
 *
 * El locale va fijado y no se toma del navegador: la interfaz está entera en
 * español, y con el locale del sistema salía «02:16 a.m.» en una columna donde
 * el diseño reserva sitio para cuatro cifras.
 */

const LOCALE = "es";

/** `09:12`, en 24 horas. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * «Hoy», «Ayer» o «martes 18».
 *
 * Una fecha completa para el día de hoy es información que quien lee ya tiene;
 * la palabra se reconoce de un vistazo y el número hay que descifrarlo.
 */
export function formatDay(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);

  if (isSameDay(date, now)) {
    return "Hoy";
  }

  const yesterday = new Date(now);

  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, yesterday)) {
    return "Ayer";
  }

  return date.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric" });
}

/** Si dos instantes caen en el mismo día natural. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `0:47`, con los segundos siempre a dos cifras. */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
