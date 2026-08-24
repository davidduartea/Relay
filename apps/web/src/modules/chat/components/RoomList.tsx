import type { Room } from "@relay/shared";

import { Seal } from "@/components/Seal";

interface RoomListProps {
  rooms: Room[];
  activeId: string | null;
  onChoose: (id: string) => void;
}

/**
 * La lista de salas.
 *
 * El mismo componente en la columna de escritorio y en el cajón móvil. Si
 * fueran dos, se separarían al primer cambio.
 *
 * La sala activa lleva cuatro señales — sello relleno, filete de 3px, peso 600
 * y la palabra «AQUÍ» — porque ninguna puede depender sólo del color.
 */
export function RoomList({ rooms, activeId, onChoose }: RoomListProps) {
  return (
    <ul className="flex flex-col">
      {rooms.map((room) => {
        const active = room.id === activeId;

        return (
          <li key={room.id}>
            <button
              type="button"
              onClick={() => onChoose(room.id)}
              // aria-current marca la sala activa para el lector de pantalla;
              // en pantalla lo dicen las otras tres señales.
              aria-current={active ? "true" : undefined}
              className={`flex min-h-12 w-full items-center gap-2.5 px-4 text-left focus-visible:-outline-offset-2 md:min-h-11 ${
                active
                  ? "bg-surface border-blue border-l-[3px] pl-[13px]"
                  : "hover:bg-ink/4 pl-4.75"
              }`}
            >
              <Seal name={room.name} filled={active} />

              <span
                className={`truncate text-[13px] ${active ? "font-semibold" : "text-ink-muted"}`}
              >
                {room.name}
              </span>

              {active && (
                <span
                  aria-hidden="true"
                  className="text-blue ml-auto text-xs font-semibold tracking-[0.1em] uppercase"
                >
                  aquí
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
