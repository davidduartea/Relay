import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { assertSecretsDiffer, loadEnvironment } from "./config/environment";

async function bootstrap(): Promise<void> {
  // Se valida antes de construir la app para que un secreto mal puesto muera
  // aquí, con un mensaje claro, y no en la primera petición que firme un token.
  const env = assertSecretsDiffer(loadEnvironment());

  const app = await NestFactory.create(AppModule);

  /**
   * Cabeceras de seguridad.
   *
   * Este servicio sólo devuelve JSON, así que la CSP por defecto de helmet —
   * pensada para HTML — no aporta nada y sí puede confundir a quien lea las
   * respuestas. Se desactiva y se deja la CSP donde importa, que es la web.
   *
   * `crossOriginResourcePolicy` también se relaja: el front vive en otro
   * origen y el valor por defecto (`same-origin`) bloquearía sus peticiones.
   * El control de quién puede llamar ya lo hace CORS, más abajo.
   */
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },

      // HSTS: un año sin volver a hablar por HTTP con este dominio. Sólo en
      // producción — en local no hay TLS que reforzar. El navegador ignoraría
      // la cabecera igualmente al llegar por http (RFC 6797 §8.1), pero no
      // enviarla deja más claro lo que se pretende.
      hsts: env.NODE_ENV === "production" ? { maxAge: 31_536_000, includeSubDomains: true } : false,

      // El API no se empotra en ningún sitio. helmet pone SAMEORIGIN por
      // defecto; DENY es lo correcto aquí y coincide con lo que manda la web.
      frameguard: { action: "deny" },
    }),
  );

  // No se registra un pipe de validación global: la validación se aplica por
  // handler con `ZodValidationPipe`, que usa los esquemas de @relay/shared.
  // Un pipe global tendría que adivinar qué esquema corresponde a cada ruta.

  // Lista blanca de un solo origen, no `*`: con credenciales de por medio, un
  // comodín permitiría a cualquier web hacer peticiones en nombre del usuario.
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });

  await app.listen(env.PORT);

  Logger.log(`API escuchando en http://localhost:${env.PORT}`, "Bootstrap");
}

void bootstrap();
