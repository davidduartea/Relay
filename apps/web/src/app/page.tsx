import { MESSAGE_MAX_LENGTH } from "@relay/shared";

const phases = [
  { id: "0", name: "Base del monorepo", state: "listo" },
  { id: "1", name: "Chat en tiempo real", state: "siguiente" },
  { id: "2", name: "Testing y E2E", state: "pendiente" },
  { id: "3", name: "Accesibilidad en CI", state: "pendiente" },
] as const;

export default function HomePage() {
  return (
    <main id="main" className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-accent text-xs font-bold tracking-[0.15em] uppercase">
          Fase 0 · base
        </p>
        <h1 className="text-4xl font-black tracking-tight text-balance">Relay</h1>
        <p className="text-ink-muted text-lg">
          Chat en tiempo real. NestJS y Socket.IO en el backend, Next.js en el frontend, y un
          paquete compartido que define el contrato de eventos para los dos.
        </p>
      </header>

      <section aria-labelledby="phases-heading" className="flex flex-col gap-3">
        <h2 id="phases-heading" className="text-sm font-bold tracking-wide uppercase">
          Avance
        </h2>
        <ol className="flex flex-col gap-2">
          {phases.map((phase) => (
            <li
              key={phase.id}
              className="border-accent bg-surface flex items-baseline gap-3 rounded border-l-2 px-4 py-3"
            >
              <span className="text-accent text-sm font-bold tabular-nums">{phase.id}</span>
              <span className="flex-1 font-medium">{phase.name}</span>
              <span className="text-ink-muted text-xs tracking-wide uppercase">
                {phase.state}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="contract-heading" className="flex flex-col gap-2">
        <h2 id="contract-heading" className="text-sm font-bold tracking-wide uppercase">
          El contrato compartido ya funciona
        </h2>
        <p className="text-ink-muted">
          Este número viene de <code className="text-accent">@relay/shared</code>, el mismo módulo
          que valida los mensajes en el servidor: el límite es{" "}
          <strong className="text-ink tabular-nums">{MESSAGE_MAX_LENGTH}</strong> caracteres. Si
          cambia ahí, cambia en los dos lados a la vez.
        </p>
      </section>
    </main>
  );
}
