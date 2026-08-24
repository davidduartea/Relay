import type { PresenceUser } from "@relay/shared";

/**
 * Quién está escribiendo.
 *
 * `aria-live="polite"` con altura reservada: el bloque ocupa sus 28px aunque
 * esté vacío, para que la lista de mensajes no dé un salto cada vez que alguien
 * empieza o deja de escribir.
 */
export function TypingIndicator({ users }: { users: PresenceUser[] }) {
  return (
    <p aria-live="polite" className="text-ink-muted flex h-7 flex-none items-center px-4 text-xs sm:px-8">
      {describe(users)}
    </p>
  );
}

function describe(users: PresenceUser[]): string {
  const [first, second] = users;

  if (!first) {
    return "";
  }

  if (users.length === 1) {
    return `${first.displayName} está escribiendo…`;
  }

  if (users.length === 2 && second) {
    return `${first.displayName} y ${second.displayName} están escribiendo…`;
  }

  return `${first.displayName} y ${users.length - 1} más están escribiendo…`;
}
