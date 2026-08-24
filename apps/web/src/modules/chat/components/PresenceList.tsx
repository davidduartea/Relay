import type { PresenceUser } from "@relay/shared";
import { useId } from "react";

import { Seal } from "@/components/Seal";

interface PresenceListProps {
  members: PresenceUser[];
  currentUserId: string;
  typingIds?: string[];
  /**
   * Sin cabecera visible.
   *
   * En la hoja móvil el recuento ya lo dice la barra de la propia hoja, y
   * repetirlo dentro dejaba «EN LA SALA · 1» encima de «1 persona en la sala».
   * El encabezado sigue existiendo, sólo que oculto a la vista: es lo que da
   * nombre a la región, y sin él la lista queda sin identificar para quien
   * navega por landmarks.
   */
  bare?: boolean;
}

export function PresenceList({
  members,
  currentUserId,
  typingIds = [],
  bare = false,
}: PresenceListProps) {
  /**
   * El identificador se genera por instancia.
   *
   * Con un `id` fijo había dos elementos iguales en el DOM: la columna lateral
   * se oculta con `hidden lg:block`, que es `display:none` — sigue montada — y
   * la hoja móvil añade una segunda. `aria-labelledby` resuelve siempre al
   * primero del documento, así que la lista que se estaba usando quedaba
   * nombrada por un encabezado invisible.
   *
   * `useId` da un valor estable y único que coincide entre servidor y cliente.
   */
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex min-h-0 flex-col">
      <header className={bare ? "" : "flex flex-col gap-1 px-5 pt-5 pb-2.5"}>
        <h2
          id={headingId}
          className={
            bare
              ? "sr-only"
              : "text-ink-muted text-xs font-semibold tracking-[0.12em] uppercase"
          }
        >
          Presencia
        </h2>
        {!bare && (
          <p className="text-[13px]">
            {members.length} {members.length === 1 ? "persona" : "personas"} en la sala
          </p>
        )}
      </header>

      {/* aria-live para que se anuncie quién entra y quién sale: sin esto,
          quien no ve la pantalla nunca sabe con quién está hablando. */}
      <ul aria-live="polite" className="flex min-h-0 flex-col overflow-y-auto">
        {members.map((member) => {
          const typing = typingIds.includes(member.id);

          return (
            <li key={member.id} className="flex min-h-11 items-center gap-2.5 px-5 sm:min-h-10">
              <Seal name={member.displayName} size="compact" />
              <span className="truncate text-[13px]">{member.displayName}</span>
              {member.id === currentUserId && (
                <span className="text-ink-muted text-xs font-medium">(tú)</span>
              )}

              {typing ? (
                <span className="text-ink-muted ml-auto text-xs">escribiendo…</span>
              ) : (
                <>
                  {/* El punto es decorativo: «en la sala» ya lo dice el hecho
                      de estar en esta lista, así que no puede ser la única
                      señal de nada. */}
                  <span aria-hidden="true" className="bg-blue ml-auto size-1.75 rounded-full" />
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
