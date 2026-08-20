import "reflect-metadata";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // whitelist descarta propiedades no declaradas en el DTO y forbidNonWhitelisted
  // convierte su presencia en un 400. Sin esto, un cliente puede colar campos
  // que luego alguien pasa a un `update` sin filtrar.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  app.enableCors({ origin, credentials: true });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  Logger.log(`API escuchando en http://localhost:${port}`, "Bootstrap");
}

void bootstrap();
