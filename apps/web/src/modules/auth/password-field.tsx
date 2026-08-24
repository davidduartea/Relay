"use client";

import { useState } from "react";

import { FieldBox } from "./field-box";
import { FieldShell } from "./field-shell";

/**
 * El campo de contraseña, con Ver/Ocultar.
 *
 * Es lo que permite no pedir «repetir contraseña»: con 12 caracteres
 * obligatorios y sin recuperación, un dedo mal puesto dejaría a alguien fuera
 * sin salida.
 *
 * Va como botón de texto y no como icono — un ojo tachado no dice si el estado
 * actual es visible u oculto — y lleva `aria-pressed`, que es lo que anuncia
 * ese estado a quien no lo ve.
 */
export function PasswordField({
  autoComplete,
  hint,
  error,
}: {
  autoComplete: string;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <FieldShell name="password" label="Contraseña" hint={hint} error={error}>
      {(describedBy) => (
        <FieldBox
          error={error}
          className="pr-1 pl-3"
          trailing={
            <button
              type="button"
              onClick={() => setVisible((shown) => !shown)}
              aria-pressed={visible}
              className="text-blue flex min-h-9 min-w-11 items-center justify-center text-xs font-medium underline"
            >
              {visible ? "Ocultar" : "Ver"}
            </button>
          }
        >
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="min-h-11 flex-1 bg-transparent text-sm outline-none"
          />
        </FieldBox>
      )}
    </FieldShell>
  );
}
