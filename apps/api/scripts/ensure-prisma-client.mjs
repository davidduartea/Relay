import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Genera el cliente de Prisma sólo cuando hace falta.
 *
 * Hacen falta dos comprobaciones, por dos motivos distintos:
 *
 * 1. El cliente se escribe dentro del store de pnpm, así que cualquier
 *    `pnpm install` o re-link lo borra y `tsc` empieza a decir que
 *    `@prisma/client` no exporta `PrismaClient`.
 *
 * 2. Si `schema.prisma` cambió, el cliente que hay es correcto pero está
 *    obsoleto: compila, y falla al usar el campo nuevo.
 *
 * Lo que NO se puede hacer es generar sin condiciones: en Windows el motor de
 * consultas es un `.dll.node` que no se puede reemplazar mientras un proceso
 * lo tiene cargado. Con el servidor de dev levantado — algo normal mientras se
 * corren los tests — un generate incondicional falla con EPERM.
 */
const require = createRequire(import.meta.url);
const apiRoot = path.join(import.meta.dirname, "..");
const schemaPath = path.join(apiRoot, "prisma", "schema.prisma");
const markerPath = path.join(apiRoot, "node_modules", ".cache", "prisma-schema-hash");

function clientIsUsable() {
  try {
    return typeof require("@prisma/client").PrismaClient === "function";
  } catch {
    return false;
  }
}

function schemaHash() {
  return createHash("sha256").update(readFileSync(schemaPath)).digest("hex");
}

function lastGeneratedHash() {
  return existsSync(markerPath) ? readFileSync(markerPath, "utf8").trim() : "";
}

const hash = schemaHash();
const reason = !clientIsUsable()
  ? "el cliente no está generado"
  : lastGeneratedHash() !== hash
    ? "schema.prisma cambió desde la última generación"
    : null;

if (!reason) {
  process.exit(0);
}

console.warn(`Generando el cliente de Prisma: ${reason}.`);

try {
  execFileSync("prisma", ["generate"], { stdio: "inherit", shell: true });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("EPERM")) {
    // El mensaje de Prisma dice "operation not permitted" y no ayuda a
    // deducir que la causa es un servidor vivo con el motor cargado.
    console.error(
      "\nNo se pudo reemplazar el motor de Prisma porque un proceso lo tiene cargado.\n" +
        "Suele ser un `nest start --watch` huérfano. Libéralo con:\n\n" +
        "  pnpm free-port\n",
    );
  }

  process.exit(1);
}

mkdirSync(path.dirname(markerPath), { recursive: true });
writeFileSync(markerPath, hash);
