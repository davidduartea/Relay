import Link from "next/link";

export default function HomePage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-6">
      <header className="flex flex-col gap-3">
        <p className="text-accent text-xs font-bold tracking-[0.15em] uppercase">
          Chat en tiempo real
        </p>
        <h1 className="text-5xl font-black tracking-tight text-balance">Relay</h1>
        <p className="text-ink-muted text-lg">
          NestJS y Socket.IO en el backend, Next.js en el frontend, y un paquete compartido que
          define el contrato de eventos para los dos lados.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/login"
          className="bg-accent focus-visible:outline-accent rounded-md px-5 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Entrar
        </Link>
        <Link
          href="/register"
          className="border-ink/15 focus-visible:outline-accent rounded-md border px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Crear cuenta
        </Link>
      </div>
    </main>
  );
}
