import Link from "next/link";

import { Rule } from "@/components/Rule";
import { Wordmark } from "@/components/Wordmark";

/** La ruta no existe. Componente de servidor: no hay nada interactivo. */
export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center gap-3.5 px-6 text-center"
    >
      <Wordmark />
      <Rule />
      <h1 className="text-[17px]">Aquí no hay nada.</h1>
      <p className="text-ink-muted text-[13px]">
        Esta dirección no corresponde a ninguna página.
      </p>
      <Link
        href="/"
        className="border-border rounded-control mt-1 flex h-11 items-center border px-5 text-sm font-medium"
      >
        Volver al principio
      </Link>
    </main>
  );
}
