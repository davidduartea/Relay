import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Datos mínimos para que la aplicación sirva de algo recién instalada.
 *
 * Usa `upsert` en vez de `create` para que correrlo dos veces no reviente:
 * un seed que sólo funciona contra una base vacía es un seed que nadie vuelve
 * a ejecutar.
 */
async function main(): Promise<void> {
  const rooms = [
    { slug: "general", name: "General" },
    { slug: "frontend", name: "Frontend" },
  ];

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { slug: room.slug },
      update: {},
      create: room,
    });
  }

  console.warn(`Seed listo: ${rooms.length} salas`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
