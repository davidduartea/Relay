import Link from "next/link";

import { Seal } from "@/modules/ui/seal";
import { Rule, Wordmark } from "@/modules/ui/wordmark";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Cabecera con el logotipo solo: es la única página pública y no hay
          adónde ir salvo a los dos botones de abajo. */}
      <header className="border-rule flex h-15 flex-none items-center border-b px-6">
        <Wordmark />
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex max-w-[520px] flex-col items-center gap-6 text-center sm:gap-6.5">
          <Seal name="Relay" size="brand" filled />

          <div className="flex flex-col items-center gap-3.5">
            <h1 className="font-[family-name:var(--font-display)] text-[34px] leading-none font-light tracking-[0.04em] sm:text-[44px]">
              Relay
            </h1>
            <Rule />
            <p className="text-ink-muted max-w-[400px] text-[15px] leading-relaxed text-pretty sm:text-[17px]">
              Salas de chat para tu equipo. Escribes y los demás lo leen al instante.
            </p>
          </div>

          {/* Mismo peso, distinta jerarquía. En móvil se apilan a ancho
              completo; en escritorio van en fila. */}
          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:gap-3">
            <Link
              href="/login"
              className="bg-blue rounded-control flex h-12 items-center justify-center px-6.5 text-sm font-medium text-white"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="border-border rounded-control flex h-12 items-center justify-center border px-6.5 text-sm font-medium"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
