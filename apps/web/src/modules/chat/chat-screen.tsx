"use client";

import type { Room } from "@relay/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api-client";
import { useSession } from "@/modules/auth/session-provider";
import { MessageComposer } from "./message-composer";
import { MessageList } from "./message-list";
import { PresenceList } from "./presence-list";
import { TypingIndicator } from "./typing-indicator";
import { useChat } from "./use-chat";

const STATUS_COPY = {
  connecting: "Conectando…",
  connected: "En línea",
  offline: "Sin conexión. Reintentando…",
  unauthorized: "Tu sesión caducó.",
} as const;

export function ChatScreen() {
  const router = useRouter();
  const { user, accessToken, ready, signOut, refresh } = useSession();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);

  // Qué access token ya provocó un intento de renovación.
  const refreshedFor = useRef<string | null>(null);

  const chat = useChat({ accessToken, roomId, currentUser: user });

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
      <main id="main" className="grid min-h-dvh place-items-center">
        <p className="text-ink-muted text-sm">Cargando…</p>
      </main>
    );
  }

  const room = rooms.find((candidate) => candidate.id === roomId);

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-ink/10 flex items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-black tracking-tight">Relay</h1>
          <p className="text-ink-muted text-sm">
            {/* El estado de conexión se anuncia solo: si el socket se cae,
                quien no ve la pantalla debe enterarse de que sus mensajes
                dejaron de salir. */}
            <span aria-live="polite">{STATUS_COPY[chat.status]}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm">{user.displayName}</span>
          <button
            type="button"
            onClick={() => void signOut().then(() => router.replace("/login"))}
            className="border-ink/15 focus-visible:outline-accent rounded-md border px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Salas" className="border-ink/10 w-48 shrink-0 border-r p-3">
          <ul className="flex flex-col gap-1">
            {rooms.map((candidate) => {
              const active = candidate.id === roomId;

              return (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => setRoomId(candidate.id)}
                    // aria-current marca la sala activa para el lector de
                    // pantalla; el color de fondo sólo sirve a quien ve.
                    aria-current={active ? "true" : undefined}
                    className={`focus-visible:outline-accent w-full truncate rounded-md px-3 py-2 text-left text-sm focus-visible:outline-2 ${
                      active ? "bg-accent font-semibold text-white" : "hover:bg-ink/5"
                    }`}
                  >
                    {candidate.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <main id="main" className="flex min-w-0 flex-1 flex-col">
          <h2 className="border-ink/10 border-b px-4 py-2 text-sm font-semibold">
            {room?.name ?? "Elige una sala"}
          </h2>

          {chat.error && (
            <p
              role="alert"
              className="flex items-center justify-between gap-3 bg-red-50 px-4 py-2 text-sm text-red-700"
            >
              {chat.error}
              <button type="button" onClick={chat.dismissError} className="underline">
                Cerrar
              </button>
            </p>
          )}

          <MessageList messages={chat.messages} currentUserId={user.id} />
          <TypingIndicator users={chat.typingUsers} />
          <MessageComposer
            disabled={chat.status !== "connected" || !roomId}
            onSend={chat.send}
            onTyping={chat.setTyping}
          />
        </main>

        <aside className="border-ink/10 hidden w-56 shrink-0 border-l md:block">
          <PresenceList members={chat.members} currentUserId={user.id} />
        </aside>
      </div>
    </div>
  );
}
