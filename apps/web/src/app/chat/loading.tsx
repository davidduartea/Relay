import { Rule } from "@/components/Rule";
import { Wordmark } from "@/components/Wordmark";

/**
 * Lo que se ve mientras el servidor trae las salas.
 *
 * Next envuelve el segmento en un `<Suspense>` con esto de fallback, así que no
 * hace falta declararlo a mano. Antes esta pantalla no existía: las salas se
 * pedían desde el navegador y la columna aparecía vacía y luego se rellenaba.
 *
 * Mismo dibujo que la espera de sesión de `ChatScreen`, a propósito: son dos
 * momentos seguidos de la misma carga y verlos distintos parecería un salto.
 */
export default function ChatLoading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3.5">
      <Wordmark />
      <Rule />
      <p className="text-ink-muted text-[13px]">Cargando tu sesión…</p>
    </div>
  );
}
