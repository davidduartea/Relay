/**
 * Dónde está el API. Sólo lo sabe el servidor.
 *
 * Antes era `NEXT_PUBLIC_API_URL`, y el prefijo hacía que Next la incrustara en
 * el bundle: cualquiera que descargara el JavaScript encontraba el origen del
 * backend sin haber iniciado sesión. Ahora ninguna petición HTTP sale del
 * navegador — van todas por server actions — así que la variable no tiene por
 * qué ser pública.
 *
 * La única excepción es el WebSocket, que el navegador **tiene** que abrir
 * contra el API. Esa dirección se le entrega desde el servidor, en el render de
 * `/chat`, así que sólo la recibe quien ya tiene sesión. Ver `getSocketUrl`.
 *
 * **Hace falta en dos momentos, con el mismo valor.**
 *
 * En ejecución, para las llamadas del servidor y para la dirección del socket.
 * Y al compilar, porque `next.config.ts` construye con ella la CSP: el
 * `connect-src` tiene que listar el origen del socket.
 *
 * Si los dos valores no coinciden, la aplicación arranca, el chat aparece
 * entero y la conexión se queda en «Sin conexión. Reintentando…» — el
 * navegador la bloquea por CSP y no lo dice en ningún sitio visible. Pasó
 * construyendo con una URL y arrancando con otra.
 */
function resolveApiUrl(): string {
  const configured = process.env["API_URL"];

  if (configured) {
    // Sin barra final: el resto del código concatena rutas que ya empiezan
    // por "/", y una barra de más produce "//auth/login".
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Falta API_URL.\n" +
        "Es la dirección del API vista desde el servidor de Next. En un " +
        "despliegue con la web y el API en plataformas distintas, es la URL " +
        "pública del API; compartiendo red privada, la interna.",
    );
  }

  return "http://localhost:4000";
}

/**
 * El API tal y como lo alcanza el servidor de Next.
 *
 * Es también la que se entrega al navegador para el socket, salvo que
 * `API_INTERNAL_URL` diga otra cosa.
 */
export const API_URL = resolveApiUrl();

/**
 * La misma API, por la red interna.
 *
 * El navegador y el contenedor de Next **no siempre llegan al API por la misma
 * dirección**. En un despliegue con Docker el navegador usa el dominio público
 * y el servidor lo tiene a un salto interno — `http://api:4000` en el compose
 * de este repositorio. Salir a internet y volver, cuando funciona, es más
 * lento; y en redes cerradas no funciona.
 *
 * Cuando no está definida cae a `API_URL`, que es lo correcto en desarrollo y
 * en un despliegue donde ambos comparten salida.
 */
export const INTERNAL_API_URL = (process.env["API_INTERNAL_URL"] ?? API_URL).replace(
  /\/+$/,
  "",
);
