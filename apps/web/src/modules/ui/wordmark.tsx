/**
 * El logotipo.
 *
 * En versalitas con interletrado abierto, porque a peso 300 las letras
 * necesitan aire para no leerse apelmazadas. El nombre va en el texto, no en
 * una imagen: se busca, se selecciona y lo lee un lector de pantalla.
 */
export function Wordmark({
  size = "md",
  as: Tag = "span",
  className = "",
}: {
  size?: "sm" | "md";
  className?: string;
  /**
   * En el chat el logotipo **es** el título de la página, así que ahí va como
   * `h1`. En la portada y en acceso el `h1` es otro — «Relay», «Entrar» — y
   * este se queda en `span`: dos `h1` en la misma página desordenan el índice
   * de encabezados por el que navega un lector de pantalla.
   */
  as?: "span" | "h1";
}) {
  return (
    <Tag
      className={`font-[family-name:var(--font-display)] font-light tracking-[0.16em] ${
        size === "sm" ? "text-[17px]" : "text-[21px]"
      } ${className}`}
    >
      RELAY
    </Tag>
  );
}

/** El trazo índigo que separa el título de lo que viene debajo. */
export function Rule({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`bg-blue block h-0.5 w-6 ${className}`} />;
}
