import type { ReactNode } from "react";

interface FieldShellProps {
  name: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  /** Recibe el valor de `aria-describedby` que debe llevar el control. */
  children: (describedBy: string | undefined) => ReactNode;
}

/**
 * Etiqueta, control, pista y error.
 *
 * La pista y el error conviven en `aria-describedby`, en ese orden: el lector
 * lee etiqueta → pista → error, que es como se entiende qué se pedía y qué
 * falló. El control lo pone quien use esta envoltura, porque un `input` y un
 * campo de contraseña con su botón no comparten estructura interna.
 */
export function FieldShell({ name, label, hint, error, children }: FieldShellProps) {
  const hintId = `${name}-hint`;
  const errorId = `${name}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Un <label> de verdad con htmlFor, no un marcador de posición haciendo
          de etiqueta: el marcador desaparece al escribir y el lector de
          pantalla no lo lee como nombre del campo. */}
      <label
        htmlFor={name}
        className="text-ink-muted text-xs font-semibold tracking-[0.1em] uppercase"
      >
        {label}
      </label>

      {children(describedBy)}

      {hint && (
        <p id={hintId} className="text-ink-muted text-xs leading-relaxed">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-error text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
