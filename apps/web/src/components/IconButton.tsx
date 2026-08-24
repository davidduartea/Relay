import type { ReactNode } from "react";

/**
 * Un botón cuyo contenido visible es un glifo.
 *
 * El nombre accesible llega por `label` y no por el glifo: «✕» no dice nada
 * leído en voz alta, y hace falta distinguir «cerrar las salas» de «cerrar la
 * lista» cuando sólo se escucha la página.
 *
 * 44px de lado, que es el objetivo táctil mínimo.
 */
export function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-ink-muted flex size-11 items-center justify-center text-sm"
    >
      <span aria-hidden="true">{children}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
