import { Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

/**
 * Acceso a la base de datos.
 *
 * Podría llevar `@Global()` — es lo que hace la mayoría de proyectos con el
 * módulo de base de datos, y ahorra tener que importarlo en cada feature. Aquí
 * no se usa a propósito: un módulo global es una dependencia invisible, y al
 * leer `RoomsModule` no habría forma de saber que toca la base sin abrir el
 * servicio. Importarlo explícitamente cuesta una línea y hace que el grafo
 * diga la verdad.
 *
 * Si algún día son quince módulos importándolo, `@Global()` deja de ser un
 * atajo y pasa a ser la decisión correcta.
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
