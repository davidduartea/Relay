"use client";

import type { Room } from "@relay/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api-client";
import { useSession } from "@/modules/auth/session-provider";
import { Seal } from "@/modules/ui/seal";
import { Rule, Wordmark } from "@/modules/ui/wordmark";
import { MessageComposer } from "./message-composer";
import { MessageList } from "./message-list";
import { PresenceList } from "./presence-list";
import { TypingIndicator } from "./typing-indicator";
import { useChat } from "./use-chat";
import type { ConnectionState } from "./use-chat";

export function ChatScreen() {
  const router = useRouter();
  const { user, accessToken, ready, signOut, refresh } = useSession();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"rooms" | "presence" | null>(null);

  // Qué access token ya provocó un intento de renovación.
  const refreshedFor = useRef<string | null>(null);

  const chat = useChat({ accessToken, roomId, currentUser: user });

  // Identidad estable: el efecto de `Overlay` depende de ella, y una flecha en
  // línea la cambiaría en cada render de esta pantalla — que renderiza con cada
  // mensaje que llega, cada aviso de escritura y cada entrada a la sala.
  const closePanel = useCallback(() => setPanel(null), []);

  // Sin sesión no hay nada que mostrar. Se espera a `ready` para no rebotar al
  // login durante el primer render, cuando localStorage aún no se ha leído.
  useEffect(() => {
    if (ready && !user) {
      router.replace("/login");
    }
  }, [ready, user, router]);

  useEffect(() => {
    void api
      .rooms()
      .then((list) => {
        setRooms(list);
        setRoomId((current) => current ?? list[0]?.id ?? null);
      })
      .catch(() => undefined);
  }, []);

  /**
   * Token caducado: se intenta renovar antes de rendirse.
   *
   * El access token dura 15 minutos y el refresh una semana, así que lo normal
   * es que la sesión siga viva. Si la renovación funciona, el `accessToken` del
   * contexto cambia y el efecto de conexión de `useChat` vuelve a correr con el
   * nuevo — el socket se reconecta solo y el usuario no se entera.
   *
   * Sólo cuando el refresh también ha caducado se manda al login.
   */
  useEffect(() => {
    if (chat.status !== "unauthorized") {
      return;
    }

    // Un intento por token, y no más. Sin esta guarda, un token nuevo que el
    // servidor también rechace volvería a disparar el efecto y el par
    // renovar-reconectar se convertiría en un bucle caliente contra el API.
    if (refreshedFor.current === accessToken) {
      router.replace("/login");

      return;
    }

    refreshedFor.current = accessToken;

    void refresh().then((renewed) => {
      if (!renewed) {
        router.replace("/login");
      }
    });
  }, [chat.status, accessToken, refresh, router]);

  if (!ready || !user) {
    return (
      <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-3.5">
        <Wordmark />
        <Rule />
        <p className="text-ink-muted text-[13px]">Cargando tu sesión…</p>
      </main>
    );
  }

  const room = rooms.find((candidate) => candidate.id === roomId);
  const roomName = room?.name ?? "Sala";
  const typingIds = chat.typingUsers.map((who) => who.id);

  function chooseRoom(id: string) {
    setRoomId(id);
    setPanel(null);
  }

  return (
    <div className="flex h-dvh flex-col">
      {/* ── Cabecera ───────────────────────────────────────────────────────
          Una sola, no una por tamaño de pantalla. Duplicarla metería dos
          landmarks `banner` y, peor, dos regiones `aria-live` con el estado de
          la conexión: un lector de pantalla anunciaría cada caída dos veces.
          Lo que cambia entre tamaños es la presentación, no los elementos. */}
      <header className="border-rule flex h-14 flex-none items-center gap-2.5 border-b px-3 md:h-15 md:gap-5.5 md:px-6">
        {/* El sello de la sala activa hace de botón del cajón: ocupa el sitio
            del típico ☰ y además dice dónde estás. */}
        <button
          type="button"
          onClick={() => setPanel("rooms")}
          aria-expanded={panel === "rooms"}
          className="flex size-11 flex-none items-center justify-center md:hidden"
        >
          <Seal name={roomName} size="screen" filled />
          <span className="sr-only">Salas. Estás en {roomName}</span>
        </button>

        {/* El título de la página. En móvil manda el nombre de la sala, así
            que se oculta a la vista — pero sigue en el árbol de encabezados:
            una página sin `h1` deja a quien navega por encabezados sin punto
            de partida. */}
        <Wordmark as="h1" className="sr-only md:not-sr-only" />

        {/* `md:contents` disuelve este contenedor en escritorio: el nombre de
            la sala desaparece — ya está en la cabecera de la conversación — y
            el estado pasa a ser hijo directo de la cabecera. */}
        <div className="flex min-w-0 flex-col md:contents">
          <span className="truncate font-[family-name:var(--font-display)] text-[17px] leading-tight font-light md:hidden">
            {roomName}
          </span>
          <ConnectionBadge status={chat.status} />
        </div>

        <div className="ml-auto flex items-center gap-3.5">
          <span className="text-ink-muted hidden text-[13px] md:inline">
            {user.displayName}
          </span>

          <button
            type="button"
            onClick={() => setPanel("presence")}
            aria-expanded={panel === "presence"}
            className="border-border flex h-11 min-w-11 items-center justify-center gap-1.5 border px-2.5 md:hidden"
          >
            <span aria-hidden="true" className="bg-blue size-1.75 rounded-full" />
            <span data-tabular className="text-xs font-semibold">
              {chat.members.length}
            </span>
            <span className="sr-only">Ver quién está en la sala</span>
          </button>

          <span className="hidden md:inline">
            <SignOutButton onSignOut={signOut} />
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Salas"
          className="border-rule hidden w-55 flex-none flex-col border-r md:flex"
        >
          <h2 className="text-ink-muted px-4 pt-5 pb-2.5 text-xs font-semibold tracking-[0.12em] uppercase">
            Salas
          </h2>
          <RoomList rooms={rooms} activeId={roomId} onChoose={chooseRoom} />
        </nav>

        <main id="main" className="bg-surface flex min-w-0 flex-1 flex-col">
          <div className="border-rule hidden min-h-14 flex-none items-center gap-3 border-b px-8 md:flex">
            <Seal name={roomName} size="header" filled />
            <h2 className="font-[family-name:var(--font-display)] text-xl font-light">
              {roomName}
            </h2>
            <span className="text-ink-muted ml-auto text-xs font-semibold tracking-[0.12em] uppercase">
              {chat.members.length} en la sala
            </span>
          </div>

          {chat.error && (
            <div
              role="alert"
              className="border-error text-error flex flex-none items-start gap-2.5 border-b border-l-[3px] px-4 py-2.5 text-[13px] sm:px-8"
            >
              <span aria-hidden="true">⚠</span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">{chat.error}</span>
                <span className="text-ink-muted">Sigue en la caja, puedes reintentarlo.</span>
              </span>
              <button
                type="button"
                onClick={chat.dismissError}
                className="text-ink-muted flex size-6 flex-none items-center justify-center"
              >
                <span aria-hidden="true">✕</span>
                <span className="sr-only">Cerrar el aviso</span>
              </button>
            </div>
          )}

          <MessageList messages={chat.messages} currentUserId={user.id} roomName={roomName} />
          <TypingIndicator users={chat.typingUsers} />
          <MessageComposer
            disabled={chat.status !== "connected" || !roomId}
            onSend={chat.send}
            onTyping={chat.setTyping}
          />
        </main>

        <aside className="border-rule hidden w-59 flex-none border-l lg:block">
          <PresenceList members={chat.members} currentUserId={user.id} typingIds={typingIds} />
        </aside>
      </div>

      {/* ── Cajón de salas (móvil) ─────────────────────────────────────── */}
      <Overlay open={panel === "rooms"} onClose={closePanel} label="Salas">
        <div className="border-border bg-paper flex h-full w-63 flex-col border-r">
          <div className="border-rule flex h-14 flex-none items-center justify-between border-b pr-2 pl-4">
            <Wordmark size="sm" />
            <CloseButton onClose={closePanel} label="Cerrar las salas" />
          </div>
          <h2 className="text-ink-muted px-4 pt-3.5 pb-2 text-xs font-semibold tracking-[0.12em] uppercase">
            Salas
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <RoomList rooms={rooms} activeId={roomId} onChoose={chooseRoom} />
          </div>
          <div className="border-rule flex flex-none flex-col gap-2 border-t p-4">
            <span className="text-[13px]">{user.displayName}</span>
            <SignOutButton onSignOut={signOut} block />
          </div>
        </div>
      </Overlay>

      {/* ── Hoja de presencia (móvil) ──────────────────────────────────── */}
      <Overlay
        open={panel === "presence"}
        onClose={closePanel}
        label="En la sala"
        placement="bottom"
      >
        <div className="border-border bg-surface flex max-h-[70dvh] flex-col border-t pt-3.5 pb-4">
          <span aria-hidden="true" className="bg-rule mx-auto h-1 w-9 rounded-full" />
          <div className="flex flex-none items-center justify-between pr-2 pl-4">
            <span className="text-ink-muted text-xs font-semibold tracking-[0.12em] uppercase">
              En la sala · {chat.members.length}
            </span>
            <CloseButton onClose={closePanel} label="Cerrar la lista" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PresenceList
              members={chat.members}
              currentUserId={user.id}
              typingIds={typingIds}
              bare
            />
          </div>
        </div>
      </Overlay>
    </div>
  );
}

/**
 * La lista de salas.
 *
 * Es el mismo componente en el cajón y en la columna: si fueran dos, se
 * separarían al primer cambio.
 */
function RoomList({
  rooms,
  activeId,
  onChoose,
}: {
  rooms: Room[];
  activeId: string | null;
  onChoose: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col">
      {rooms.map((room) => {
        const active = room.id === activeId;

        return (
          <li key={room.id}>
            <button
              type="button"
              onClick={() => onChoose(room.id)}
              // aria-current marca la sala activa para el lector de pantalla;
              // en pantalla lo dicen otras cuatro señales.
              aria-current={active ? "true" : undefined}
              className={`flex min-h-12 w-full items-center gap-2.5 px-4 text-left focus-visible:-outline-offset-2 md:min-h-11 ${
                active
                  ? "bg-surface border-blue border-l-[3px] pl-[13px]"
                  : "hover:bg-ink/4 pl-4.75"
              }`}
            >
              <Seal name={room.name} filled={active} />
              <span
                className={`truncate text-[13px] ${active ? "font-semibold" : "text-ink-muted"}`}
              >
                {room.name}
              </span>
              {active && (
                <span
                  aria-hidden="true"
                  className="text-blue ml-auto text-xs font-semibold tracking-[0.1em] uppercase"
                >
                  aquí
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const STATUS = {
  connecting: { label: "Conectando…", glyph: "◌", tone: "muted" },
  connected: { label: "En línea", glyph: "●", tone: "ok" },
  offline: { label: "Sin conexión. Reintentando…", glyph: "⚠", tone: "error" },
  unauthorized: { label: "Tu sesión caducó", glyph: "⚠", tone: "error" },
} as const;

/**
 * El estado de la conexión.
 *
 * Cambian a la vez el texto, el glifo y el color del filete. Con sólo el color,
 * quien no lo distingue no sabría si sus mensajes están saliendo — y eso es lo
 * único que este componente tiene que comunicar.
 *
 * `aria-live="polite"` porque el estado cambia solo, sin que nadie lo pida.
 */
function ConnectionBadge({ status }: { status: ConnectionState }) {
  const { label, glyph, tone } = STATUS[status];

  return (
    // En móvil es la segunda línea bajo el nombre de la sala, sin filete ni
    // glifo: ahí el espacio manda y el texto ya lo dice todo. En escritorio se
    // convierte en la pastilla con filete de la cabecera.
    <span
      aria-live="polite"
      className={`text-ink-muted inline-flex items-center gap-2 text-xs md:font-medium ${
        tone === "error" ? "md:border-error md:text-error text-error" : "md:border-border"
      } md:border md:px-2.5 md:py-1.5 ${tone === "error" ? "" : "md:text-ink"}`}
    >
      <span
        aria-hidden="true"
        className={`hidden md:inline ${tone === "ok" ? "text-blue" : ""}`}
      >
        {glyph}
      </span>
      {label}
    </span>
  );
}

function SignOutButton({
  onSignOut,
  block = false,
}: {
  onSignOut: () => Promise<void>;
  block?: boolean;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => void onSignOut().then(() => router.replace("/login"))}
      className={`border-border flex h-11 items-center border px-3.5 text-[13px] font-medium ${
        block ? "justify-center" : ""
      }`}
    >
      Salir
    </button>
  );
}

function CloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="text-ink-muted flex size-11 items-center justify-center text-sm"
    >
      <span aria-hidden="true">✕</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

/**
 * El envoltorio de los dos paneles móviles.
 *
 * Es un `<dialog>` de verdad abierto con `showModal()`, no un `div` con
 * `position:fixed`. El navegador aporta cuatro cosas que antes estaban a mano
 * y mal:
 *
 * - **Trampa de foco real.** La versión anterior declaraba `aria-modal="true"`
 *   sin implementarla: con Tab se recorría la lista de salas y la caja de
 *   escritura que estaban tapadas por el velo. Prometer modal y no serlo es
 *   peor que no prometerlo.
 * - **Escape**, que dispara el evento `close`.
 * - **Devolver el foco** a quien abrió el panel, sin guardarlo en una ref.
 * - **`::backdrop`**, que sustituye al `<button>` a pantalla completa que hacía
 *   de velo — y que era una parada de tabulación colocada *antes* del
 *   contenido del diálogo.
 *
 * El velo es tinta al 14%, no negro: un negro puro sobre una paleta índigo se
 * lee como un agujero.
 *
 * 📖 https://developer.mozilla.org/docs/Web/API/HTMLDialogElement/showModal
 */
function Overlay({
  open,
  onClose,
  label,
  placement = "left",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  placement?: "left" | "bottom";
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  /**
   * El efecto depende sólo de `open`.
   *
   * Antes dependía también de `onClose`, que llega como flecha en línea y
   * cambia de identidad en cada render de `ChatScreen` — y esta pantalla
   * renderiza con cada mensaje, cada aviso de escritura y cada entrada o
   * salida de la sala. Cada uno ejecutaba la limpieza, que devolvía el foco al
   * botón de apertura: el foco saltaba fuera del panel abierto varias veces
   * por segundo.
   */
  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  /**
   * Al pulsar el velo, el objetivo del evento es el propio `<dialog>`: el
   * contenido vive en su hijo. Es la forma de distinguir «fuera» de «dentro»
   * sin añadir un elemento que capture el clic.
   */
  function onBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      onClose();
    }
  }

  return (
    // jsx-a11y pide un manejador de teclado junto a `onClick`, pero aquí lo
    // pone el navegador: en un diálogo modal Escape dispara `close`, que es
    // justamente el equivalente por teclado de pulsar el velo. Añadir un
    // `onKeyDown` propio duplicaría ese comportamiento.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-label={label}
      // `close` cubre las dos salidas del navegador — Escape y `dialog.close()`
      // — así que el estado de React se entera pase lo que pase.
      onClose={onClose}
      onClick={onBackdropClick}
      // El diálogo es sólo el marco: transparente y del tamaño de la ventana.
      // El velo lo pinta `::backdrop`, que el navegador coloca por debajo en la
      // capa superior. Las clases `max-*-none` y `m-0` deshacen los estilos por
      // defecto del navegador, que centra el diálogo y lo limita a
      // `calc(100% - 6px - 2em)`.
      className="backdrop:bg-ink/14 m-0 h-dvh max-h-none w-dvw max-w-none border-0 bg-transparent p-0"
    >
      <div className={`flex h-full ${placement === "bottom" ? "items-end" : ""}`}>
        {children}
      </div>
    </dialog>
  );
}
