import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // No se registra un pipe de validación global: la validación se aplica por
  // handler con `ZodValidationPipe`, que usa los esquemas de @relay/shared.
  // Un pipe global tendría que adivinar qué esquema corresponde a cada ruta.

  const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  app.enableCors({ origin, credentials: true });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  Logger.log(`API escuchando en http://localhost:${port}`, "Bootstrap");
}

void bootstrap();
