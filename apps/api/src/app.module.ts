import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { ChatModule } from "./chat/chat.module";
import { loadEnvironment } from "./config/environment";
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
    AuthModule,
    ChatModule,
    RoomsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
