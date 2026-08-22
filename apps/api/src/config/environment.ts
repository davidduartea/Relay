import { z } from "zod";

/**
 * Toda lectura de `process.env` vive aquí.
 *
 * El esquema se valida al arrancar, así que un secreto ausente o un puerto que
 * no es número tumban el proceso al instante y con un mensaje que dice cuál
 * falta. La alternativa es descubrirlo a las tres semanas, cuando alguien
 * intenta refrescar su sesión y el token se firmó con `undefined`.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  /**
   * Origen permitido por CORS, para HTTP y para el socket.
   *
   * Tiene valor por defecto para que el desarrollo funcione sin configurar
   * nada, pero `assertProductionConfig` lo rechaza en producción: desplegar
   * con este valor dejaría la API aceptando peticiones de `localhost` — es
   * decir, del navegador de cualquiera — y rechazando las del dominio real.
   */
  WEB_ORIGIN: z.url().default("http://localhost:3000"),

  /** Lo devuelve /healthz. Útil para saber qué versión respondió. */
  APP_VERSION: z.string().default("dev"),

  DATABASE_URL: z.string().min(1, "Falta DATABASE_URL"),

  // 32 caracteres es el mínimo razonable para una firma HS256: por debajo, la
  // clave tiene menos entropía que el propio algoritmo y la firma deja de
  // aportar lo que promete.
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET necesita 32+ caracteres"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET necesita 32+ caracteres"),

  // Formato de la librería `ms`: un número y una unidad. Se valida aquí para
  // que "15 minutos" o un typo como "15mm" no lleguen a la firma, donde
  // producirían un token con una expiración que nadie quiso.
  /**
   * Intentos por minuto contra los endpoints de credenciales.
   *
   * Configurable porque los E2E registran decenas de usuarios en segundos
   * desde la misma IP y con el límite real no podrían correr. El valor por
   * defecto es el de producción: quien no lo toque, queda protegido.
   */
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(5),
  DEFAULT_RATE_LIMIT: z.coerce.number().int().positive().default(120),

  JWT_ACCESS_TTL: z
    .string()
    .regex(/^\d+[smhd]$/, "Formato de duración inválido; se espera algo como 15m o 7d")
    .default("15m"),
  JWT_REFRESH_TTL: z
    .string()
    .regex(/^\d+[smhd]$/, "Formato de duración inválido; se espera algo como 15m o 7d")
    .default("7d"),
});

export type Environment = z.infer<typeof schema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const result = schema.safeParse(source);

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Configuración de entorno inválida:\n${detail}`);
  }

  return result.data;
}

/**
 * Sólo el origen permitido, sin exigir el resto del entorno.
 *
 * Existe por el decorador de `ChatGateway`, que necesita el origen al **cargar
 * la clase**. Usar `loadEnvironment()` allí obligaría a tener base de datos y
 * secretos configurados para poder siquiera importar el archivo — y eso rompe
 * cualquier test que lo importe sin levantar un entorno completo.
 *
 * Valida con el mismo campo del esquema, así que el default y el rechazo de
 * una URL mal formada son idénticos. Lo que no se valida aquí — que en
 * producción no apunte a localhost — lo sigue cubriendo
 * `assertProductionConfig` al arrancar.
 */
export function loadWebOrigin(source: NodeJS.ProcessEnv = process.env): string {
  const result = schema.shape.WEB_ORIGIN.safeParse(source["WEB_ORIGIN"]);

  if (!result.success) {
    throw new Error(`WEB_ORIGIN inválido: ${result.error.issues[0]?.message ?? "valor no válido"}`);
  }

  return result.data;
}

/**
 * Los dos secretos tienen que ser distintos.
 *
 * Si coinciden, un access token vale como refresh token: cualquiera que
 * intercepte uno — que viaja en cada petición — puede renovar la sesión
 * indefinidamente, y la vida corta del access token deja de servir de nada.
 */
export function assertSecretsDiffer(env: Environment): Environment {
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error(
      "JWT_ACCESS_SECRET y JWT_REFRESH_SECRET no pueden ser iguales: " +
        "un access token serviría como refresh token.",
    );
  }

  // Devuelve el entorno ya validado para que el arranque lo use directamente,
  // en vez de volver a leer `process.env` con valores por defecto duplicados.
  return env;
}

/**
 * Valores que son cómodos en desarrollo y peligrosos en producción.
 *
 * El patrón que esto ataca es el más traicionero de un despliegue: una
 * variable que falta y un valor por defecto que la tapa. La aplicación
 * arranca, los logs no dicen nada, y el fallo aparece en el navegador de
 * quien la usa — sin ninguna pista de por qué.
 *
 * Aquí se prefiere no arrancar. Un contenedor que no levanta se diagnostica
 * en segundos; uno que levanta mal, en horas.
 */
export function assertProductionConfig(env: Environment): Environment {
  if (env.NODE_ENV !== "production") {
    return env;
  }

  const problems: string[] = [];

  if (env.WEB_ORIGIN.includes("localhost") || env.WEB_ORIGIN.includes("127.0.0.1")) {
    problems.push(
      `WEB_ORIGIN apunta a "${env.WEB_ORIGIN}". En producción CORS aceptaría ` +
        "peticiones del navegador de cualquiera y rechazaría las del dominio real.",
    );
  }

  if (env.DATABASE_URL.includes("localhost") || env.DATABASE_URL.includes("127.0.0.1")) {
    problems.push(
      "DATABASE_URL apunta a localhost. Dentro de un contenedor eso es el propio " +
        "contenedor, donde no hay base de datos.",
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Configuración inválida para producción:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
  }

  return env;
}
