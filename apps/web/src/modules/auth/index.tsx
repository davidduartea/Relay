"use client";

import {
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  loginSchema,
  registerSchema,
} from "@relay/shared";
import type { AuthSession } from "@relay/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, api } from "@/services/api-service";
import { formatCountdown } from "@/lib/format-time";
import { Alert } from "@/components/Alert";
import { Rule } from "@/components/Rule";
import { Wordmark } from "@/components/Wordmark";
import { AUTH_COPY } from "@/modules/auth/constants";
import { Field } from "@/modules/auth/components/Field";
import { PasswordField } from "@/modules/auth/components/PasswordField";
import { useSession } from "@/modules/auth/SessionProvider";
import type { AuthMode } from "@/modules/auth/constants";

type FieldErrors = Record<string, string>;

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { signIn } = useSession();

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);

  const alertRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const copy = AUTH_COPY[mode];
  const waiting = waitSeconds > 0;

  /**
   * La cuenta atrás del límite de intentos.
   *
   * Es el único estado donde la respuesta correcta es esperar, así que el botón
   * lo dice y se rehabilita solo. Sin cuenta atrás, la única salida sería
   * probar y volver a fallar.
   */
  useEffect(() => {
    if (waitSeconds <= 0) {
      return;
    }

    const timer = setTimeout(() => setWaitSeconds((left) => left - 1), 1000);

    return () => clearTimeout(timer);
  }, [waitSeconds]);

  /**
   * El foco va al aviso general en cuanto aparece.
   *
   * `role="alert"` hace que se anuncie, pero quien navega con teclado seguiría
   * con el foco en el botón, debajo del mensaje: tendría que retroceder a
   * ciegas para leerlo.
   */
  useEffect(() => {
    if (formError) {
      alertRef.current?.focus();
    }
  }, [formError]);

  /** El primer campo que falla recibe el foco. */
  function showFieldErrors(errors: FieldErrors) {
    setFieldErrors(errors);

    const [first] = Object.keys(errors);

    if (first) {
      // Se busca por `name` y no por `id`: `name` es la clave que produjo el
      // error, la misma con la que `FormData` leyó el valor. Buscar por id
      // asume que ambos coinciden.
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }
  }

  function showApiError(error: unknown) {
    if (error instanceof ApiError && error.retryAfter) {
      setWaitSeconds(error.retryAfter);
      setFormError("Demasiados intentos");
    } else if (error instanceof ApiError && error.fields.length > 0) {
      showFieldErrors(
        Object.fromEntries(error.fields.map(({ field, message }) => [field, message])),
      );
    } else if (error instanceof ApiError) {
      setFormError(error.message);
    } else {
      setOffline(true);
      setFormError("No se pudo conectar.");
    }
  }

  /**
   * Cada modo valida y envía con su propio esquema.
   *
   * Antes era una rama ternaria seguida de `api.login(parsed.data as never)`:
   * un solo `safeParse` no puede producir a la vez `LoginInput` y
   * `RegisterInput`, y el cast tapaba justamente eso. Separadas, TypeScript
   * comprueba el contrato con el servidor de verdad.
   */
  async function authenticate(data: Record<string, unknown>): Promise<AuthSession | null> {
    if (mode === "login") {
      const parsed = loginSchema.safeParse(data);

      if (!parsed.success) {
        showFieldErrors(issuesToErrors(parsed.error.issues));

        return null;
      }

      return api.login(parsed.data);
    }

    const parsed = registerSchema.safeParse(data);

    if (!parsed.success) {
      showFieldErrors(issuesToErrors(parsed.error.issues));

      return null;
    }

    return api.register(parsed.data);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setOffline(false);

    const data = Object.fromEntries(new FormData(event.currentTarget));

    setBusy(true);

    try {
      const session = await authenticate(data);

      if (!session) {
        setBusy(false);

        return;
      }

      signIn(session);
      router.push("/chat");
    } catch (error) {
      showApiError(error);
      setBusy(false);
    }
  }

  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col justify-center px-6 py-10 sm:items-center sm:px-0"
    >
      {/* La tarjeta con filete existe sólo en escritorio: en móvil el
          formulario es la pantalla, y un borde a 16px de cada lado no separa
          nada de nada. */}
      <div className="sm:border-rule sm:bg-surface flex w-full flex-col gap-5.5 sm:w-[440px] sm:border sm:p-8">
        <header className="flex flex-col gap-2.5">
          <Wordmark size="sm" className="text-ink-muted" />
          <h1 className="font-[family-name:var(--font-display)] text-[30px] leading-none font-light">
            {copy.title}
          </h1>
          <Rule />
        </header>

        {formError && (
          <Alert
            ref={alertRef}
            tone={offline ? "neutral" : "error"}
            detail={detailFor(waiting, offline)}
          >
            {formError}
          </Alert>
        )}

        <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5">
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
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              hint="Es el nombre que verán los demás en el chat."
              error={fieldErrors["displayName"]}
            />
          )}

          <PasswordField
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            hint={mode === "register" ? `Mínimo ${PASSWORD_MIN_LENGTH} caracteres.` : undefined}
            error={fieldErrors["password"]}
          />

          {/* El botón está activo desde el principio. Deshabilitarlo hasta que
              el formulario sea válido esconde justamente lo que falta: al
              pulsarlo aparecen los errores y se sabe qué corregir. */}
          <button
            type="submit"
            disabled={busy || waiting}
            aria-busy={busy || undefined}
            className={`rounded-control flex h-12 items-center justify-center gap-2 text-sm font-medium ${
              busy || waiting
                ? "border-border text-ink-muted border border-dashed"
                : "bg-blue text-white"
            }`}
          >
            {waiting ? (
              <span data-tabular>Entrar en {formatCountdown(waitSeconds)}</span>
            ) : busy ? (
              <>
                <span aria-hidden="true">◌</span> Un momento…
              </>
            ) : (
              copy.submit
            )}
          </button>
        </form>

        <p className="border-rule text-ink-muted flex flex-col gap-1 border-t pt-4 text-[13px] sm:flex-row sm:items-center sm:gap-1.5">
          {copy.question}{" "}
          {/* En móvil el enlace baja a su propia línea para que el objetivo
              táctil de 44px no arrastre a la pregunta. */}
          <Link
            href={copy.href}
            className="text-blue flex min-h-11 items-center font-medium underline sm:min-h-0"
          >
            {copy.action}
          </Link>
        </p>
      </div>
    </main>
  );
}

function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  return Object.fromEntries(issues.map((issue) => [String(issue.path[0]), issue.message]));
}

/** La segunda línea del aviso: qué hacer, cuando hay algo que hacer. */
function detailFor(waiting: boolean, offline: boolean): string | undefined {
  if (waiting) {
    return "Espera un minuto y vuelve a probar.";
  }

  return offline ? "Comprueba tu conexión." : undefined;
}
