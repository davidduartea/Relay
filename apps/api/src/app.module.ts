import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { HealthController } from "./health/health.controller";
import { RoomsModule } from "./rooms/rooms.module";

/**
 * El módulo raíz. `NestFactory.create(AppModule)` entra por aquí y recorre el
 * grafo entero: cada módulo de `imports`, sus providers, y así hasta abajo.
 *
 * Lo que no sea alcanzable desde aquí, no existe en la aplicación.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true }), RoomsModule],
  controllers: [HealthController],
})
export class AppModule {}
