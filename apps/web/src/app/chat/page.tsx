import type { Metadata } from "next";

import { getRooms } from "@/modules/chat/actions";
import { ChatScreen } from "@/modules/chat/main/ChatScreen";

export const metadata: Metadata = { title: "Chat · Relay" };

/**
 * La ruta hace de contenedor: trae los datos y se los pasa al cliente.
 *
 * Un contenedor suele separarse en su propio archivo y envolverse en
 * `<Suspense>` desde un componente de composición, para que la parte estática
 * de la pantalla pinte al instante mientras sólo los datos hacen streaming.
 * Aquí no hay parte estática que adelantar: la cabecera del chat lleva el
 * estado de la conexión, que sale del socket y por tanto del cliente. Partirlo
 * en tres archivos dejaría dos de ellos sin trabajo.
 *
 * La frontera de suspensión está donde sí sirve — `loading.tsx`, que Next
 * convierte en el `<Suspense>` de este segmento de ruta.
 *
 * Tampoco puede subir más trabajo al servidor: la sesión vive en
 * `localStorage` (ver `lib/session-store.ts`), que un componente de servidor no
 * ve, así que mensajes y presencia sólo pueden venir por el socket. Las salas
 * sí, porque `GET /rooms` es público.
 */
export default async function ChatPage() {
  const rooms = await getRooms();

  return <ChatScreen rooms={rooms} />;
}
