import type { ReactNode, Ref } from "react";

export interface AlertProps {
  children: ReactNode;
  /** Segunda línea, en gris, con qué hacer al respecto. */
  detail?: string | undefined;
  /**
   * `error` para lo que hay que corregir; `neutral` para lo que sólo hay que
   * repetir — una conexión caída no es culpa de nadie y pintarla de rojo
   * sugiere que hay algo mal escrito.
   */
  tone?: "error" | "neutral";
  /** Sin esto no aparece la ✕: un aviso que no se puede descartar no la lleva. */
  onDismiss?: (() => void) | undefined;
  /** Para llevarle el foco cuando aparece. */
  ref?: Ref<HTMLDivElement>;
  className?: string;
}

/**
 * El aviso del sistema.
 *
 * Va sobre el fondo de la página y no sobre un rojo claro: así el texto se
 * queda en 6.8:1 sin inventar un tono nuevo de la paleta. Tres señales, ninguna
 * dependiente sólo del color — el glifo, el filete izquierdo de 3px y el propio
 * texto.
 *
 * `tabIndex={-1}` lo hace enfocable por código sin meterlo en el orden de
 * tabulación: `role="alert"` consigue que se anuncie, pero quien navega con
 * teclado seguiría con el foco donde estaba y tendría que buscarlo a ciegas.
 */
export function Alert({
  children,
  detail,
  tone = "error",
  onDismiss,
  ref,
  className = "",
}: AlertProps) {
  const skin = tone === "error" ? "border-error text-error" : "border-border text-ink-muted";

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className={`flex items-start gap-2.5 border border-l-[3px] px-3 py-2.5 text-[13px] ${skin} ${className}`}
    >
      <span aria-hidden="true">{tone === "error" ? "⚠" : "◌"}</span>

      <span className="flex flex-1 flex-col gap-1">
        <span className="font-medium">{children}</span>
        {detail && <span className="text-ink-muted">{detail}</span>}
      </span>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-ink-muted flex size-6 flex-none items-center justify-center"
        >
          <span aria-hidden="true">✕</span>
          <span className="sr-only">Cerrar el aviso</span>
        </button>
      )}
    </div>
  );
}
