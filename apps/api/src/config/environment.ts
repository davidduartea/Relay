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
  WEB_ORIGIN: z.url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1, "Falta DATABASE_URL"),

  // 32 caracteres es el mínimo razonable para una firma HS256: por debajo, la
  // clave tiene menos entropía que el propio algoritmo y la firma deja de
  // aportar lo que promete.
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET necesita 32+ caracteres"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET necesita 32+ caracteres"),

  // Formato de la librería `ms`: un número y una unidad. Se valida aquí para
  // que "15 minutos" o un typo como "15mm" no lleguen a la firma, donde
  // producirían un token con una expiración que nadie quiso.
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
 * Los dos secretos tienen que ser distintos.
 *
 * Si coinciden, un access token vale como refresh token: cualquiera que
 * intercepte uno — que viaja en cada petición — puede renovar la sesión
 * indefinidamente, y la vida corta del access token deja de servir de nada.
 */
export function assertSecretsDiffer(env: Environment): void {
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error(
      "JWT_ACCESS_SECRET y JWT_REFRESH_SECRET no pueden ser iguales: " +
        "un access token serviría como refresh token.",
    );
  }
}
