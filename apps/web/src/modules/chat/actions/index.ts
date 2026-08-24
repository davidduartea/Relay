import type { Room } from "@relay/shared";

import { INTERNAL_API_URL } from "@/lib/api-url";

/**
 * Las salas, traídas desde el servidor.
 *
 * Antes vivía en un `useEffect` dentro de `ChatScreen`: el navegador pintaba la
 * columna vacía, pedía las salas y volvía a pintar. Ahora llegan ya en el HTML.
 *
 * Se puede hacer **porque `GET /rooms` es público** — lleva `@Public()` en
 * `rooms.controller.ts`, ya que el listado de salas no es secreto. El resto de
 * la pantalla no puede seguir el mismo camino: la sesión de Relay vive en
 * `localStorage` y un componente de servidor no la ve, así que los mensajes y
 * la presencia siguen viniendo por el socket, desde el cliente.
 *
 * `cache: "no-store"` porque la lista cambia cuando alguien crea una sala, y
 * una sala nueva que no aparece hasta el siguiente despliegue no sirve de nada.
 */
export async function getRooms(): Promise<Room[]> {
  const response = await fetch(`${INTERNAL_API_URL}/rooms`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`El API respondió ${response.status} al pedir las salas`);
  }

  return (await response.json()) as Room[];
}
