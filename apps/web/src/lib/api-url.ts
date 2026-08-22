/**
 * De dónde sale la URL del API, y por qué esto no es un `??` de una línea.
 *
 * `NEXT_PUBLIC_API_URL` se incrusta en el bundle al compilar, no se lee al
 * arrancar. Si falta durante el build de producción, un valor por defecto
 * hacia `localhost` produce una aplicación que **compila sin un solo aviso** y
 * luego, en el navegador de quien la usa, no conecta con nada: sin error de
 * red comprensible, sin log que lo explique, y sin forma de arreglarlo salvo
 * reconstruir.
 *
 * Es el fallo clásico del primer despliegue. Aquí se prefiere romper el build,
 * que es cuando alguien está mirando.
 *
 * En desarrollo sí hay valor por defecto: `pnpm dev` tiene que funcionar
 * recién clonado el repositorio, sin configurar nada.
 */
function resolveApiUrl(): string {
  const configured = process.env["NEXT_PUBLIC_API_URL"];

  if (configured) {
    // Sin barra final: el resto del código concatena rutas que ya empiezan
    // por "/", y una barra de más produce "//auth/login".
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Falta NEXT_PUBLIC_API_URL.\n" +
        "Se incrusta al compilar, así que tiene que estar definida en el entorno " +
        "de build — en Vercel, en Settings → Environment Variables — y no basta " +
        "con ponerla en el runtime.",
    );
  }

  return "http://localhost:4000";
}

export const API_URL = resolveApiUrl();
