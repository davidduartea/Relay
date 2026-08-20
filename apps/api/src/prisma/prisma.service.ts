import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * El cliente de Prisma, envuelto como provider de Nest.
 *
 * Extiende `PrismaClient`, así que se usa igual que el cliente normal
 * (`prisma.room.findMany()`), pero además participa del ciclo de vida de la
 * aplicación. Nest expone ganchos que llama en momentos concretos del arranque
 * y del apagado; implementarlos es la forma correcta de manejar recursos que
 * hay que abrir y cerrar.
 *
 * Sin `onModuleDestroy` el proceso puede terminar dejando conexiones colgadas
 * en Postgres, que es como se agota el pool en un servicio que se despliega
 * muchas veces al día.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    // Conectar aquí y no de forma perezosa hace que un problema de
    // credenciales o de red salga al arrancar, no en la primera petición de
    // un usuario. Es preferible que el despliegue falle a que falle el cliente.
    await this.$connect();
    this.logger.log("Conectado a la base de datos");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
