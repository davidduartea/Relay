import { PrismaClient } from "@prisma/client";

/**
 * Vacía la tabla de mensajes antes de una tanda de end-to-end.
 *
 * El historial que sirve el gateway está limitado a los 50 mensajes más
 * recientes. La suite corre en paralelo y todos los tests escriben en la misma
 * sala, así que una base que se reutiliza acumula mensajes de ejecuciones
 * anteriores: pasados los 50, el mensaje que un test acaba de enviar queda
 * fuera de la ventana y «quien llega después recibe lo que ya se dijo» falla
 * sin que nada esté roto.
 *
 * En CI no se notaba porque cada ejecución levanta un Postgres nuevo. En local
 * la base persiste, y el fallo aparece a la tercera o cuarta vuelta — que es
 * la peor forma de fallo: intermitente y sin relación aparente con el cambio
 * que uno está probando.
 *
 * Sólo borra mensajes. Las salas y las cuentas se quedan.
 */
const prisma = new PrismaClient();

try {
  const { count } = await prisma.message.deleteMany();

  console.warn(`Mensajes borrados: ${count}`);
} finally {
  await prisma.$disconnect();
}
