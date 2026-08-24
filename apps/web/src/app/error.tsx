"use client";

import { useEffect } from "react";

import { Rule } from "@/components/Rule";
import { Wordmark } from "@/components/Wordmark";

/**
 * Lo que se ve cuando algo revienta al renderizar.
 *
 * Tiene que ser componente de cliente aunque el fallo venga del servidor: Next
 * necesita el `onClick` de reintentar y el efecto que registra el error.
 *
 * `reset()` vuelve a montar el segmento sin recargar la página, así que un
 * fallo pasajero — el API tardando de más al traer las salas — se arregla sin
 * perder la sesión que vive en `localStorage`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El mensaje real no se enseña: en producción Next lo sustituye por un
    // `digest` justamente para no filtrar detalles del servidor a quien mira.
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center gap-3.5 px-6 text-center"
    >
      <Wordmark />
      <Rule />
      <h1 className="text-[17px]">No se pudo cargar esta página.</h1>
      <p className="text-ink-muted max-w-[380px] text-[13px] text-pretty">
        Puede ser algo pasajero. Si vuelve a fallar, comprueba que el servidor está en marcha.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-blue rounded-control mt-1 flex h-11 items-center px-5 text-sm font-medium text-white"
      >
        Reintentar
      </button>
    </main>
  );
}
