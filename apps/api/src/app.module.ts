import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuthModule } from "./auth/auth.module";
import { ChatModule } from "./chat/chat.module";
import { loadEnvironment } from "./config/environment";
import { buildThrottlingOptions } from "./config/throttling";
import { HealthController } from "./health/health.controller";
import { RoomsModule } from "./rooms/rooms.module";

/**
 * El módulo raíz. `NestFactory.create(AppModule)` entra por aquí y recorre el
 * grafo entero: cada módulo de `imports`, sus providers, y así hasta abajo.
 *
 * Lo que no sea alcanzable desde aquí, no existe en la aplicación.
 *
 * `validate` corre el esquema de Zod sobre process.env al arrancar: si falta
 * un secreto, el proceso muere ahí con el nombre de la variable en vez de
 * firmar tokens con `undefined`.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: loadEnvironment }),
    ThrottlerModule.forRoot(buildThrottlingOptions()),
    AuthModule,
    ChatModule,
    RoomsModule,
  ],
  controllers: [HealthController],
  providers: [
    /**
     * El límite de peticiones se aplica a toda la aplicación.
     *
     * Va antes que el guard de JWT en la lista, y el orden importa: los guards
     * corren en el orden en que se registran, así que el freno actúa **antes**
     * de verificar el token. De lo contrario, un atacante haría trabajar a la
     * CPU en criptografía en cada uno de sus intentos, que es justo lo que se
     * intenta evitar.
     */
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
