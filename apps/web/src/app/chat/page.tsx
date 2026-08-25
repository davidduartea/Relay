import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { API_URL } from "@/lib/api-url";
import { getCurrentUser } from "@/modules/auth/actions";
import { SessionProvider } from "@/modules/auth/SessionProvider";
import { getRooms } from "@/modules/chat/actions";
import { ChatScreen } from "@/modules/chat/main/ChatScreen";

export const metadata: Metadata = { title: "Chat · Relay" };

/**
 * La ruta hace de contenedor: trae los datos y se los pasa al cliente.
 *
 * Ahora también resuelve la sesión. Antes el cliente leía `localStorage` en un
 * efecto, así que la pantalla se pintaba y sólo después decidía si rebotaba al
 * login. Aquí la sesión se conoce antes de mandar nada.
 *
 * El `redirect` es una red de seguridad: el caso normal lo cubre `proxy.ts`,
 * que corre antes y ya devuelve al login sin sesión. Esto atrapa la ventana en
 * que la sesión se invalida entre el proxy y el render.
 *
 * Las salas y el usuario se piden en paralelo: son independientes, y en serie
 * sólo sumarían latencia.
 */
export default async function ChatPage() {
  const [user, rooms] = await Promise.all([getCurrentUser(), getRooms()]);

  if (!user) {
    redirect("/login");
  }

  return (
    <SessionProvider user={user}>
      {/* La dirección del socket se entrega aquí y no en el bundle.
          Es lo único del backend que el navegador necesita saber — tiene que
          abrir la conexión él —, y así sólo lo recibe quien ya tiene sesión,
          en vez de cualquiera que descargue el JavaScript. */}
      <ChatScreen rooms={rooms} socketUrl={API_URL} />
    </SessionProvider>
  );
}
