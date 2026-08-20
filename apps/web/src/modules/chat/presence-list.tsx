import type { PresenceUser } from "@relay/shared";

interface PresenceListProps {
  members: PresenceUser[];
  currentUserId: string;
}

export function PresenceList({ members, currentUserId }: PresenceListProps) {
  return (
    <section aria-labelledby="presence-heading" className="flex flex-col gap-2 p-4">
      <h2 id="presence-heading" className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
        En la sala ({members.length})
      </h2>

      {/* aria-live para que se anuncie quién entra y quién sale: sin esto,
          quien no ve la pantalla nunca sabe con quién está hablando. */}
      <ul aria-live="polite" className="flex flex-col gap-1">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
            <span className="truncate">
              {member.displayName}
              {member.id === currentUserId && <span className="text-ink-muted"> (tú)</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
