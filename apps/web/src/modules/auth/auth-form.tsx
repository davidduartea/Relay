"use client";

import { DISPLAY_NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH, loginSchema, registerSchema } from "@relay/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { ApiError, api } from "@/lib/api-client";
import { Rule, Wordmark } from "@/modules/ui/wordmark";
import { useSession } from "./session-provider";

type Mode = "login" | "register";

const COPY = {
  login: {
    title: "Entrar",
    submit: "Entrar",
    question: "¿No tienes cuenta?",
    action: "Regístrate",
    href: "/register",
  },
  register: {
    title: "Crear cuenta",
    submit: "Crear cuenta",
    question: "¿Ya tienes cuenta?",
    action: "Entra",
    href: "/login",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { signIn } = useSession();

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [displayName, setDisplayName] = useState("");

  const alertRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const copy = COPY[mode];

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
  function focusFirstError(errors: Record<string, string>) {
    const first = Object.keys(errors)[0];

    if (first) {
      formRef.current?.querySelector<HTMLInputElement>(`#${first}`)?.focus();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setOffline(false);

    const data = Object.fromEntries(new FormData(event.currentTarget));

    // Se valida con el MISMO esquema que aplica el servidor. Un error de
    // formato se ve sin ida y vuelta, y las reglas no pueden desincronizarse
    // porque sólo existen en un sitio.
    const schema = mode === "login" ? loginSchema : registerSchema;
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
      const errors = Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      );

      setFieldErrors(errors);
      focusFirstError(errors);

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
      if (error instanceof ApiError && error.retryAfter) {
        setWaitSeconds(error.retryAfter);
        setFormError("Demasiados intentos");
      } else if (error instanceof ApiError && error.fields.length > 0) {
        const errors = Object.fromEntries(error.fields.map((f) => [f.field, f.message]));

        setFieldErrors(errors);
        focusFirstError(errors);
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setOffline(true);
        setFormError("No se pudo conectar.");
      }

      setBusy(false);
    }
  }

  const waiting = waitSeconds > 0;

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
          <span className="text-ink-muted">
            <Wordmark size="sm" />
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-[30px] leading-none font-light">
            {copy.title}
          </h1>
          <Rule />
        </header>

        {formError && (
          <Alert
            ref={alertRef}
            tone={offline ? "neutral" : "error"}
            detail={
              waiting
                ? "Espera un minuto y vuelve a probar."
                : offline
                  ? "Comprueba tu conexión."
                  : undefined
            }
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
              value={displayName}
              onChange={setDisplayName}
              counter={`${displayName.length}/${DISPLAY_NAME_MAX_LENGTH}`}
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
              <span data-tabular>Entrar en {formatWait(waitSeconds)}</span>
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

/**
 * El aviso general del formulario.
 *
 * Va sobre blanco y no sobre un fondo rojo claro: así el texto se queda en
 * 6.8:1 sin inventar un tono nuevo. El filete izquierdo de 3px es la segunda
 * señal, y el glifo la tercera — ninguna depende sólo del color.
 *
 * `tabIndex={-1}` lo hace enfocable por código sin meterlo en el orden de
 * tabulación: hace falta para poder mover el foco aquí al aparecer.
 */
function Alert({
  children,
  detail,
  tone,
  ref,
}: {
  children: ReactNode;
  detail?: string | undefined;
  tone: "error" | "neutral";
  ref?: React.Ref<HTMLDivElement>;
}) {
  const skin =
    tone === "error" ? "border-error border-l-error text-error" : "border-border text-ink-muted";

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className={`flex items-start gap-2.5 border border-l-[3px] px-3 py-2.5 text-[13px] ${skin}`}
    >
      <span aria-hidden="true">{tone === "error" ? "⚠" : "◌"}</span>
      <span className="flex flex-1 flex-col gap-1">
        <span className="font-medium">{children}</span>
        {detail && <span className="text-ink-muted">{detail}</span>}
      </span>
    </div>
  );
}

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  error?: string | undefined;
  hint?: string | undefined;
  counter?: string | undefined;
  maxLength?: number;
  value?: string;
  onChange?: (value: string) => void;
}

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  error,
  hint,
  counter,
  maxLength,
  value,
  onChange,
}: FieldProps) {
  return (
    <FieldShell name={name} label={label} error={error} hint={hint}>
      {(ids) => (
        <div className={`${boxSkin(error)} flex items-center gap-2 px-3`}>
          <input
            id={name}
            name={name}
            type={type}
            autoComplete={autoComplete}
            maxLength={maxLength}
            {...(onChange ? { value, onChange: (e) => onChange(e.target.value) } : {})}
            aria-invalid={error ? true : undefined}
            aria-describedby={ids}
            className="min-h-11 flex-1 bg-transparent text-sm outline-none sm:min-h-11"
          />
          {counter && (
            <span data-tabular className="text-ink-muted text-xs font-medium">
              {counter}
            </span>
          )}
          {error && (
            <span aria-hidden="true" className="text-error">
              ⚠
            </span>
          )}
        </div>
      )}
    </FieldShell>
  );
}

/**
 * El campo de contraseña, con Ver/Ocultar.
 *
 * Es lo que permite no pedir «repetir contraseña»: con 12 caracteres
 * obligatorios y sin recuperación, un dedo mal puesto dejaría a alguien fuera
 * sin salida. Va como botón de texto y no como icono — un ojo tachado no dice
 * si el estado actual es visible u oculto — y lleva `aria-pressed`, que es lo
 * que anuncia ese estado a quien no lo ve.
 */
function PasswordField({
  autoComplete,
  hint,
  error,
}: {
  autoComplete: string;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <FieldShell name="password" label="Contraseña" error={error} hint={hint}>
      {(ids) => (
        <div className={`${boxSkin(error)} flex items-center gap-2 py-0 pr-1 pl-3`}>
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            aria-invalid={error ? true : undefined}
            aria-describedby={ids}
            className="min-h-11 flex-1 bg-transparent text-sm outline-none"
          />
          {error && (
            <span aria-hidden="true" className="text-error">
              ⚠
            </span>
          )}
          <button
            type="button"
            onClick={() => setVisible((shown) => !shown)}
            aria-pressed={visible}
            className="text-blue flex min-h-9 min-w-11 items-center justify-center text-xs font-medium underline"
          >
            {visible ? "Ocultar" : "Ver"}
          </button>
        </div>
      )}
    </FieldShell>
  );
}

/** Filete de 1px en reposo, 2px rojo con error: el grosor también es señal. */
function boxSkin(error?: string): string {
  return `rounded-control ${error ? "border-error border-2" : "border-border border"}`;
}

/**
 * Etiqueta, campo, pista y error.
 *
 * La pista y el error conviven en `aria-describedby`, en ese orden: el lector
 * lee etiqueta → pista → error, que es como se entiende qué se pedía y qué
 * falló.
 */
function FieldShell({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const hintId = `${name}-hint`;
  const errorId = `${name}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Un <label> de verdad con htmlFor, no un marcador de posición haciendo
          de etiqueta: el marcador desaparece al escribir y el lector de
          pantalla no lo lee como nombre del campo. */}
      <label
        htmlFor={name}
        className="text-ink-muted text-xs font-semibold tracking-[0.1em] uppercase"
      >
        {label}
      </label>

      {children(describedBy)}

      {hint && (
        <p id={hintId} className="text-ink-muted text-xs leading-relaxed">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-error text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

/** `0:47`, con las cifras siempre a dos dígitos. */
function formatWait(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
