import { existsSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "prisma/config";

/**
 * Configuración de Prisma fuera de package.json.
 *
 * La clave `prisma` dentro de package.json quedó deprecada y desaparece en
 * Prisma 7; este archivo es su reemplazo.
 *
 * OJO: en cuanto existe este archivo, Prisma deja de cargar `.env` por su
 * cuenta — lo avisa con "Prisma config detected, skipping environment variable
 * loading". Hay que cargarlo a mano o `DATABASE_URL` llega vacía y el esquema
 * ni siquiera valida.
 *
 * `process.loadEnvFile` es nativo desde Node 20.12, así que no hace falta
 * añadir dotenv sólo para esto.
 *
 * El seed es .mts y no .ts porque apps/api es CommonJS: sin la extensión
 * explícita, Node reparsea el archivo como ESM y avisa en cada ejecución.
 */
const envPath = path.join(process.cwd(), ".env");

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "node --experimental-strip-types prisma/seed.mts",
  },
});
