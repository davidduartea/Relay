"use client";

import type { Room } from "@relay/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSession } from "@/modules/auth/SessionProvider";
import { Alert } from "@/components/Alert";
import { IconButton } from "@/components/IconButton";
import { Overlay } from "@/components/Overlay";
import { Rule } from "@/components/Rule";
import { Seal } from "@/components/Seal";
import { Wordmark } from "@/components/Wordmark";
import { ConnectionBadge } from "@/modules/chat/components/ConnectionBadge";
import { MessageComposer } from "@/modules/chat/components/MessageComposer";
import { MessageList } from "@/modules/chat/components/MessageList";
import { PresenceList } from "@/modules/chat/components/PresenceList";
import { RoomList } from "@/modules/chat/components/RoomList";
import { SignOutButton } from "@/modules/chat/components/SignOutButton";
import { TypingIndicator } from "@/modules/chat/components/TypingIndicator";
import { useChat } from "@/modules/chat/hooks/useChat";

/** Qué panel modal está abierto. Sólo existen en móvil. */
type Panel = "rooms" | "presence" | null;

export function ChatScreen({ rooms }: { rooms: Room[] }) {
  const router = useRouter();
  const { user, accessToken, ready, signOut, refresh } = useSession();

  // Las salas llegan del servidor ya resueltas, así que la sala inicial se
  // elige en el primer render y no después de una ida y vuelta.
  const [roomId, setRoomId] = useState<string | null>(rooms[0]?.id ?? null);
  const [panel, setPanel] = useState<Panel>(null);

  // Qué access token ya provocó un intento de renovación.
  const refreshedFor = useRef<string | null>(null);

  const chat = useChat({ accessToken, roomId, currentUser: user });

  // Identidad estable: el efecto de `Overlay` depende de ella, y una flecha en
  // línea la cambiaría en cada render de esta pantalla — que renderiza con cada
  // mensaje que llega, cada aviso de escritura y cada entrada a la sala.
  const closePanel = useCallback(() => setPanel(null), []);

  const chooseRoom = useCallback((id: string) => {
    setRoomId(id);
    setPanel(null);
  }, []);

  const leave = useCallback(() => {
    void signOut().then(() => router.replace("/login"));
  }, [signOut, router]);

  // Sin sesión no hay nada que mostrar. Se espera a `ready` para no rebotar al
  // login durante el primer render, cuando localStorage aún no se ha leído.
  useEffect(() => {
    if (ready && !user) {
      router.replace("/login");
    }
  }, [ready, user, router]);

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
            <SignOutButton onClick={leave} />
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
            <Alert
              detail="Sigue en la caja, puedes reintentarlo."
              onDismiss={chat.dismissError}
              className="border-t-0 border-r-0 border-b px-4 sm:px-8"
            >
              {chat.error}
            </Alert>
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
            <IconButton onClick={closePanel} label="Cerrar las salas">
              ✕
            </IconButton>
          </div>

          <h2 className="text-ink-muted px-4 pt-3.5 pb-2 text-xs font-semibold tracking-[0.12em] uppercase">
            Salas
          </h2>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <RoomList rooms={rooms} activeId={roomId} onChoose={chooseRoom} />
          </div>

          <div className="border-rule flex flex-none flex-col gap-2 border-t p-4">
            <span className="text-[13px]">{user.displayName}</span>
            <SignOutButton onClick={leave} block />
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
        <div className="border-border bg-surface flex max-h-[70dvh] w-full flex-col border-t pt-3.5 pb-4">
          <span aria-hidden="true" className="bg-rule mx-auto h-1 w-9 rounded-full" />

          <div className="flex flex-none items-center justify-between pr-2 pl-4">
            <span className="text-ink-muted text-xs font-semibold tracking-[0.12em] uppercase">
              En la sala · {chat.members.length}
            </span>
            <IconButton onClick={closePanel} label="Cerrar la lista">
              ✕
            </IconButton>
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
