import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

/**
 * Content Security Policy.
 *
 * Es la mitigación principal contra XSS, y aquí importa el doble: la sesión
 * vive en `localStorage`, así que un script inyectado podría leerla. La CSP es
 * lo que impide que ese script llegue a ejecutarse.
 *
 * Dos concesiones que no son descuido:
 *
 * - `'unsafe-inline'` en `style-src`: Tailwind y React inyectan estilos en
 *   línea. La alternativa son nonces por respuesta, que obligan a renderizar
 *   cada página en el servidor y tirarían el prerenderizado estático.
 * - `'unsafe-eval'` sólo en desarrollo: lo necesita el refresco en caliente.
 *   En producción no se envía.
 *
 * `connect-src` incluye el esquema `ws:`/`wss:` porque el chat abre un
 * WebSocket contra el API; sin él, la conexión se bloquea en silencio.
 */
function contentSecurityPolicy(): string {
  const socketOrigin = API_URL.replace(/^http/, "ws");

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${API_URL} ${socketOrigin}`,
    // Nada de este sitio debe poder empotrarse ni empotrar a otros: es la
    // defensa contra clickjacking, y la versión moderna de X-Frame-Options.
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    // Restringe a dónde puede enviar un <form>, por si alguien inyecta uno.
    "form-action 'self'",
  ].join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desactiva APIs del navegador que esta aplicación no usa. Si un script
  // inyectado intentara encender la cámara, el navegador lo niega.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

/**
 * HSTS sólo en el build de producción.
 *
 * Le dice al navegador que durante un año no vuelva a hablar con este dominio
 * por HTTP, ni aunque el usuario escriba `http://`. Es lo que cierra la ventana
 * del primer salto, donde cabe un ataque de intermediario.
 *
 * No estropea el desarrollo aunque `next start` la envíe en local: el propio
 * estándar (RFC 6797 §8.1) obliga al navegador a **ignorar** esta cabecera
 * cuando llega por una conexión insegura, y en local se sirve por http.
 */
if (isProduction) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  });
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El paquete compartido se publica como TS compilado dentro del workspace;
  // transpilarlo aquí evita tener que construirlo antes de cada `next dev`.
  transpilePackages: ["@relay/shared"],

  // No anunciar el framework ni su versión: le ahorra al atacante saber contra
  // qué CVEs probar.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
