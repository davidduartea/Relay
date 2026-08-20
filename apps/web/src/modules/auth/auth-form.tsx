"use client";

import { loginSchema, registerSchema } from "@relay/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError, api } from "@/lib/api-client";
import { useSession } from "./session-provider";

type Mode = "login" | "register";

const COPY = {
  login: {
    title: "Entrar",
    submit: "Entrar",
    alternative: "¿No tienes cuenta? Regístrate",
    href: "/register",
  },
  register: {
    title: "Crear cuenta",
    submit: "Crear cuenta",
    alternative: "¿Ya tienes cuenta? Entra",
    href: "/login",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { signIn } = useSession();

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const copy = COPY[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const data = Object.fromEntries(new FormData(event.currentTarget));

    // Se valida con el MISMO esquema que aplica el servidor. Un error de
    // formato se ve sin ida y vuelta, y las reglas no pueden desincronizarse
    // porque sólo existen en un sitio.
    const schema = mode === "login" ? loginSchema : registerSchema;
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );

      return;
    }

    setBusy(true);

    try {
      const session =
        mode === "login"
          ? await api.login(parsed.data as never)
          : await api.register(parsed.data as never);

      signIn(session);
      router.push("/chat");
    } catch (error) {
      if (error instanceof ApiError && error.fields.length > 0) {
        setFieldErrors(Object.fromEntries(error.fields.map((f) => [f.field, f.message])));
      } else {
        setFormError(error instanceof ApiError ? error.message : "No se pudo conectar.");
      }

      setBusy(false);
    }
  }

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-black tracking-tight">{copy.title}</h1>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}

        <Field
          name="email"
          label="Correo"
          type="email"
          autoComplete="email"
          error={fieldErrors["email"]}
        />

        {mode === "register" && (
          <Field
            name="displayName"
            label="Nombre"
            autoComplete="nickname"
            error={fieldErrors["displayName"]}
          />
        )}

        <Field
          name="password"
          label="Contraseña"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          error={fieldErrors["password"]}
        />

        <button
          type="submit"
          disabled={busy}
          className="bg-accent focus-visible:outline-accent h-11 rounded-md text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {busy ? "Un momento…" : copy.submit}
        </button>
      </form>

      <Link href={copy.href} className="text-accent text-center text-sm underline">
        {copy.alternative}
      </Link>
    </main>
  );
}

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  error?: string | undefined;
}

function Field({ name, label, type = "text", autoComplete, error }: FieldProps) {
  const errorId = `${name}-error`;

  return (
    <div className="flex flex-col gap-1">
      {/* Un <label> de verdad con htmlFor, no un placeholder haciendo de
          etiqueta: el placeholder desaparece al escribir y no lo lee el
          lector de pantalla como nombre del campo. */}
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        // aria-invalid y aria-describedby atan el mensaje de error al campo,
        // de modo que al enfocarlo se anuncia junto con la etiqueta.
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="border-ink/15 bg-surface focus:border-accent focus:ring-accent h-11 rounded-md border px-3 text-sm focus:ring-1 focus:outline-none aria-[invalid]:border-red-500"
      />

      {error && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
