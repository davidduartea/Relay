import type { ReactNode } from "react";

interface FieldBoxProps {
  error?: string | undefined;
  className?: string;
  /** El control y lo que va pegado a él, como el contador. */
  children: ReactNode;
  /**
   * Lo que va al final, después del glifo de error.
   *
   * Existe para que el botón Ver/Ocultar quede a la derecha del ⚠ y no entre
   * el campo y el aviso, que es donde menos se espera encontrarlo.
   */
  trailing?: ReactNode;
}

/**
 * El recuadro con filete de un campo.
 *
 * Es un componente y no una cadena de clases porque dentro del filete viven
 * varias cosas además del control: el contador del nombre, el botón
 * Ver/Ocultar y el glifo de error. Todas comparten el mismo marco.
 *
 * Con error el filete engorda a 2px. El grosor es una señal más, junto al
 * glifo y al texto de debajo: ninguna depende sólo del color.
 */
export function FieldBox({ error, className = "", children, trailing }: FieldBoxProps) {
  return (
    <div
      className={`rounded-control flex items-center gap-2 ${
        error ? "border-error border-2" : "border-border border"
      } ${className}`}
    >
      {children}

      {error && (
        <span aria-hidden="true" className="text-error">
          ⚠
        </span>
      )}

      {trailing}
    </div>
  );
}
