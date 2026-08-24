"use client";

import { useState } from "react";

import { FieldBox } from "./field-box";
import { FieldShell } from "./field-shell";

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string | undefined;
  error?: string | undefined;
  /** Con esto aparece el contador `8/40` dentro del filete. */
  maxLength?: number;
}

/**
 * Un campo de texto.
 *
 * El input es **no controlado**: el formulario lee los valores con `FormData`
 * al enviar, así que guardar cada tecla en estado sería trabajo tirado. Lo
 * único que sí necesita estado es la longitud para el contador — un número, no
 * la cadena entera.
 */
export function Field({
  name,
  label,
  type = "text",
  autoComplete,
  hint,
  error,
  maxLength,
}: FieldProps) {
  const [length, setLength] = useState(0);

  return (
    <FieldShell name={name} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <FieldBox error={error} className="px-3">
          <input
            id={name}
            name={name}
            type={type}
            autoComplete={autoComplete}
            maxLength={maxLength}
            {...(maxLength ? { onChange: (e) => setLength(e.target.value.length) } : {})}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="min-h-11 flex-1 bg-transparent text-sm outline-none"
          />

          {maxLength && (
            // Informativo y gris: no cambia de color al acercarse al tope
            // porque no hay nada que corregir — el campo simplemente no acepta
            // el carácter siguiente.
            <span data-tabular className="text-ink-muted text-xs font-medium">
              {length}/{maxLength}
            </span>
          )}
        </FieldBox>
      )}
    </FieldShell>
  );
}
