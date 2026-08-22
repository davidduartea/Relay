# Seguridad

Qué protege esta aplicación, dónde está implementado y por qué se decidió así.

Cada apartado enlaza al archivo y la línea concretos, y a la documentación oficial de la herramienta.

---

## Estado del checklist

Auditoría contra un checklist de prelanzamiento habitual.

| Punto | Estado | Dónde |
| --- | --- | --- |
| Ocultar API keys y secretos | ✅ | [`config/environment.ts`](../apps/api/src/config/environment.ts) |
| Sin secretos en el historial de git | ✅ | Verificado: ningún `.env` real se subió nunca |
| Base de datos no expuesta | ✅ | [`docker-compose.yml`](../docker-compose.yml) — sólo `localhost` |
| Autenticación en servidor | ✅ | [`auth/jwt-auth.guard.ts`](../apps/api/src/auth/jwt-auth.guard.ts) |
| Control de acceso por registro | ✅ | [`chat/chat.gateway.ts`](../apps/api/src/chat/chat.gateway.ts) |
| Bloquear manipulación de campos | ✅ | El autor sale del token, nunca del payload |
| Hashear contraseñas | ✅ | [`auth/auth.service.ts`](../apps/api/src/auth/auth.service.ts) — argon2id |
| Limitar intentos de login | ✅ | [`config/throttling.ts`](../apps/api/src/config/throttling.ts) |
| Parametrizar consultas SQL | ✅ | Sin `$queryRaw`; todo por el query builder de Prisma |
| Validar todas las entradas | ✅ | Zod compartido entre backend y frontend |
| Escapar contenido de usuario | ✅ | Sin `dangerouslySetInnerHTML`; React escapa por defecto |
| Recortar respuestas de API | ✅ | Listas blancas de columnas (`SHAPE`, `USER_SHAPE`) |
| Cabeceras de seguridad | ✅ | [`main.ts`](../apps/api/src/main.ts) · [`next.config.ts`](../apps/web/next.config.ts) |
| Forzar HTTPS | ✅ | HSTS en ambos, sólo en producción |
| Escanear dependencias | ✅ | Job `audit` en [`ci.yml`](../.github/workflows/ci.yml) |
| Subida de archivos segura | — | No existe la funcionalidad |
| Cifrado de datos sensibles | — | No se almacena nada que lo requiera |
| Row Level Security | — | El cliente nunca toca la base; la autorización vive en Nest |
| Protección antibots | ❌ | Pendiente — el registro es abierto |
| Cookies de sesión httpOnly | ⚠️ | Decisión consciente, ver [Sesión](#sesión-y-tokens) |

---

## Cabeceras de seguridad

### API — helmet

📖 [helmetjs.github.io](https://helmetjs.github.io/) · [Nest · Middleware](https://docs.nestjs.com/middleware#applying-middleware)

`helmet` es middleware de **Express**, no de Nest. Nest usa Express por debajo, así que se registra con `app.use()` en [`main.ts:28`](../apps/api/src/main.ts) y corre antes que cualquier controlador.

De las 15 cabeceras que pone por defecto se cambiaron tres:

| Opción | Línea | Decisión |
| --- | --- | --- |
| `contentSecurityPolicy: false` | `main.ts:30` | La CSP protege HTML. Este servicio sólo devuelve JSON — nadie ejecuta scripts desde `/rooms`. Vive en la web, donde sí sirve |
| `crossOriginResourcePolicy: "cross-origin"` | `main.ts:31` | El valor por defecto (`same-origin`) bloquearía al front, que está en otro puerto |
| `frameguard: "deny"` | `main.ts:41` | helmet pone `SAMEORIGIN`; un API no se empotra en ningún sitio |
| `hsts` | `main.ts:37` | Sólo en producción, ver abajo |

**CORP no es CORS.** CORS decide si JavaScript puede *leer* la respuesta; CORP, si otro sitio puede *incrustar* el recurso. Quién puede llamar lo controla CORS en `main.ts:51`.
📖 [MDN · CORP](https://developer.mozilla.org/docs/Web/HTTP/Headers/Cross-Origin-Resource-Policy)

Cabeceras que helmet pone y no se tocaron: `X-Content-Type-Options`, `Cross-Origin-Opener-Policy`, `Referrer-Policy`, `X-XSS-Protection: 0` (desactiva un filtro antiguo de IE que introducía sus propios fallos), `Origin-Agent-Cluster`.

### Web — Content-Security-Policy

📖 [Next · headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers) · [MDN · CSP](https://developer.mozilla.org/docs/Web/HTTP/CSP)

Construida en [`next.config.ts:24`](../apps/web/next.config.ts). Es la cabecera más importante del proyecto **porque la sesión vive en `localStorage`**: la CSP es lo que impide que un script inyectado llegue a ejecutarse y leerla.

| Línea | Directiva | Qué controla |
| --- | --- | --- |
| `:28` | `default-src 'self'` | Regla base: todo desde el propio dominio |
| `:29` | `script-src 'self' 'unsafe-inline'` | JavaScript — ver concesiones |
| `:30` | `style-src 'self' 'unsafe-inline'` | CSS: Tailwind y React inyectan estilos en línea |
| `:33` | `connect-src 'self' <api> <ws>` | `fetch`, XHR y **WebSocket** |
| `:36` | `frame-ancestors 'none'` | Clickjacking; versión moderna de `X-Frame-Options` |
| `:38` | `object-src 'none'` | Plugins |
| `:39` | `base-uri 'self'` | Impide inyectar `<base>` y desviar rutas relativas |
| `:41` | `form-action 'self'` | Un form inyectado no puede enviar a otro dominio |

**Dos concesiones deliberadas:**

- `'unsafe-inline'` en `script-src` permite justo lo que la CSP quiere bloquear. La alternativa son [nonces](https://nextjs.org/docs/app/guides/content-security-policy) — un valor aleatorio por respuesta — pero obligan a renderizar cada página en el servidor y tirarían el prerenderizado estático.
- `'unsafe-eval'` sólo en desarrollo, para el refresco en caliente. En producción no se envía.

**`connect-src` debe incluir el esquema `ws:`** o el chat se bloquea en silencio: la conexión ni se intenta y no hay error obvio. Es la línea más fácil de olvidar.

Además: `Permissions-Policy` en `:52` niega cámara, micrófono, geolocalización y pagos con paréntesis vacíos — *nadie, ni siquiera nosotros*. Y `poweredByHeader: false` en `:81` deja de anunciar el framework y su versión.
📖 [MDN · Permissions-Policy](https://developer.mozilla.org/docs/Web/HTTP/Headers/Permissions-Policy)

### HSTS

📖 [MDN](https://developer.mozilla.org/docs/Web/HTTP/Headers/Strict-Transport-Security) · [RFC 6797](https://datatracker.ietf.org/doc/html/rfc6797)

`main.ts:37` y `next.config.ts:68`. Cierra la ventana del primer salto: al escribir el dominio, el navegador prueba `http://` y ahí cabe un intermediario. HSTS le dice que durante un año no vuelva a intentarlo.

`31_536_000` segundos es un año, el mínimo que exige [hstspreload.org](https://hstspreload.org/) para entrar en la lista precargada de los navegadores.

Sólo se envía desde un build de producción. Es inofensiva en local de todos modos — [RFC 6797 §8.1](https://datatracker.ietf.org/doc/html/rfc6797#section-8.1) obliga a ignorarla cuando llega por conexión insegura — pero no enviarla deja más clara la intención.

### CORS

📖 [Nest · CORS](https://docs.nestjs.com/security/cors) · [MDN](https://developer.mozilla.org/docs/Web/HTTP/CORS)

[`main.ts:51`](../apps/api/src/main.ts). Un solo origen, nunca `*`: el navegador **prohíbe** combinar comodín con `credentials: true`, precisamente porque permitiría a cualquier web hacer peticiones en nombre del usuario.

El origen sale de `env.WEB_ORIGIN`, ya validado por Zod.

---

## Límite de peticiones

📖 [Nest · Rate Limiting](https://docs.nestjs.com/security/rate-limiting) · [GitHub](https://github.com/nestjs/throttler)

### Dos límites, no uno

[`config/throttling.ts:21`](../apps/api/src/config/throttling.ts)

| Throttler | Ventana | Límite | Por qué |
| --- | --- | --- | --- |
| `default` | 1 min | 120 | Lecturas normales |
| `auth` | 1 min | 5 | Cada petición es **una contraseña probada** |

Son **independientes**: quedarse sin intentos de login no puede dejar al usuario sin poder leer las salas.

Los límites se aplican **por IP**. Eso no detiene a un atacante distribuido — para eso hacen falta otras herramientas — pero corta en seco el caso común, que es un script desde una sola máquina.

El almacenamiento es **en memoria**. Con varias instancias del servidor, cada una lleva su propia cuenta; ahí haría falta el [almacén de Redis](https://github.com/jmcdo29/nest-lab/tree/main/packages/throttler-storage-redis).

### El orden de los guards importa

[`app.module.ts:42`](../apps/api/src/app.module.ts) registra `ThrottlerGuard`; [`auth/auth.module.ts:29`](../apps/api/src/auth/auth.module.ts) registra `JwtAuthGuard`.

Los guards globales corren **en el orden en que se registran**:

```
petición → ThrottlerGuard → JwtAuthGuard → handler
```

El freno va primero a propósito. Al revés, cada intento del atacante haría a la CPU verificar un JWT antes de rechazarlo: estarías pagando trabajo por cada ataque, que es justo lo que se intenta evitar.
📖 [Nest · Guards globales](https://docs.nestjs.com/guards#binding-guards)

### La trampa de `@SkipThrottle()`

[`auth/auth.controller.ts:73`](../apps/api/src/auth/auth.controller.ts)

```ts
@SkipThrottle({ [THROTTLE_AUTH]: true })
```

**`@SkipThrottle()` sin argumentos sólo salta el throttler llamado literalmente `default`**, no todos. Hay que nombrar el estricto.

Sin esto, `/auth/me` — que el cliente llama al cargar cada página — consumiría el cupo de credenciales, y navegar por la aplicación dejaría al usuario sin poder hacer login sin haber intentado ni una contraseña.
📖 [@SkipThrottle](https://docs.nestjs.com/security/rate-limiting#skipping-requests)

### El límite estricto va en la clase

[`auth/auth.controller.ts:19`](../apps/api/src/auth/auth.controller.ts)

```ts
@Throttle({ [THROTTLE_AUTH]: {} })
@Controller("auth")
```

En el controlador entero, no endpoint por endpoint: así **un método nuevo nace protegido**. Es el mismo criterio que con `@Public()` — proteger por defecto y hacer explícita la excepción.

### Configurable, con el valor de producción por defecto

[`config/environment.ts:34`](../apps/api/src/config/environment.ts)

```ts
AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(5),
DEFAULT_RATE_LIMIT: z.coerce.number().int().positive().default(120),
```

`z.coerce` porque `process.env` siempre da strings.

La suite E2E registra decenas de usuarios en segundos desde una sola IP, así que [`e2e/playwright.config.ts:65`](../e2e/playwright.config.ts) los sube para poder correr. **El valor por defecto es el de producción**: quien no lo toque, queda protegido.

Que el freno funciona de verdad lo comprueba [`auth/throttling.spec.ts`](../apps/api/src/auth/throttling.spec.ts), que levanta una app de Nest real con el guard real y verifica el 429 con [supertest](https://github.com/ladjs/supertest).

---

## Configuración

El patrón más traicionero de un despliegue es una variable que falta y un valor por defecto que la tapa: la aplicación arranca, los logs no dicen nada, y el fallo aparece en el navegador de quien la usa. Aquí se prefiere no arrancar — un contenedor que no levanta se diagnostica en segundos; uno que levanta mal, en horas.

**Toda lectura de `process.env` pasa por el esquema de Zod** de [`config/environment.ts`](../apps/api/src/config/environment.ts). Incluido el CORS del gateway de WebSocket, que antes lo leía en crudo con un `??` hacia localhost — y como está en un decorador, evaluado antes de que exista el contenedor de dependencias, llama a `loadEnvironment()` directamente.

**`assertProductionConfig` rechaza en producción lo que es cómodo en desarrollo**: un `WEB_ORIGIN` o un `DATABASE_URL` apuntando a localhost. Nombra todos los problemas a la vez, no sólo el primero — arreglar uno, redesplegar y descubrir el siguiente es la forma más lenta de configurar un entorno.

**En la web, `NEXT_PUBLIC_API_URL` rompe el build si falta en producción** ([`lib/api-url.ts`](../apps/web/src/lib/api-url.ts)). Se incrusta al compilar, así que un valor por defecto hacia localhost produce una aplicación que compila sin un aviso y luego no conecta con nada, sin log que lo explique y sin arreglo salvo reconstruir.

## Autenticación

### Contraseñas

[`auth/auth.service.ts`](../apps/api/src/auth/auth.service.ts) · 📖 [@node-rs/argon2](https://github.com/napi-rs/node-rs/tree/main/packages/argon2)

argon2id, con parámetros por defecto. Tarda ~18ms **a propósito**: es lo que hace caro probar contraseñas a lo bruto.

### El login tarda lo mismo exista o no la cuenta

Cuando el correo no existe, se verifica igualmente contra un hash de descarte. Sin eso, el camino sin cuenta responde en ~0ms y el camino con cuenta en ~18ms — una diferencia trivial de medir con unas cuantas muestras, que convierte el login en un oráculo de qué correos están registrados.

El mensaje de error también es idéntico en ambos casos. Tapar sólo una de las dos vías es no tapar ninguna.

### Los dos secretos deben diferir

[`config/environment.ts:70`](../apps/api/src/config/environment.ts) lo comprueba al arrancar. Si coincidieran, un access token interceptado — que viaja en cada petición — serviría para renovar la sesión indefinidamente, y su vida corta dejaría de significar nada.

### El refresh token lleva un `jti`

Sin él, dos tokens firmados dentro del mismo segundo salen **idénticos**: `iat` va en segundos, así que el payload entero coincide y con él la firma. La rotación no rotaría nada y un refresh robado seguiría valiendo tras la renovación del usuario legítimo.

Hay un test de regresión en [`auth/auth.service.spec.ts`](../apps/api/src/auth/auth.service.spec.ts).

### El refresh se guarda hasheado

Por la misma razón que la contraseña: quien lea la base de datos no debe poder suplantar a nadie. Ponerlo a `null` es el logout, e invalida el token sin esperar a que expire.

---

## Autorización

### Guard global con lista blanca invertida

[`auth/jwt-auth.guard.ts`](../apps/api/src/auth/jwt-auth.guard.ts)

Toda ruta está protegida por defecto; las abiertas se marcan con `@Public()`. La dirección importa: una lista blanca de rutas *privadas* se olvida en cuanto alguien añade un endpoint, mientras que una de rutas *públicas* **falla hacia el lado seguro**.

### El WebSocket autentica en el handshake

[`chat/chat.gateway.ts:71`](../apps/api/src/chat/chat.gateway.ts)

En un middleware y no en `handleConnection`, porque allí el cliente ya recibió su evento `connect` y sólo después se le echa: para él es indistinguible de una caída de red, así que su lógica de reconexión reintenta en bucle con el mismo token malo.

El token viaja en `auth` del handshake y no en la query string, porque las query strings acaban en los logs del proxy.

### Estar en la sala es la autorización para escribir en ella

[`chat/chat.gateway.ts:177`](../apps/api/src/chat/chat.gateway.ts). Y **el autor sale del token, nunca del payload**: si viniera del cliente, cualquiera podría publicar en nombre de otro cambiando un campo del envío. Hay un test que lo comprueba mandando un `authorId` falso a propósito.

---

## Datos

### Sin SQL crudo

Cero `$queryRaw` en el proyecto. Todo pasa por el query builder de Prisma, que parametriza por construcción.
📖 [Prisma · SQL injection](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries#sql-injection-prevention)

### Listas blancas de columnas

`SHAPE` en [`rooms/rooms.service.ts`](../apps/api/src/rooms/rooms.service.ts) y `USER_SHAPE` en [`auth/auth.service.ts`](../apps/api/src/auth/auth.service.ts) enumeran qué columnas salen del servicio.

Se listan en vez de devolver la fila entera para que una columna nueva no se filtre sola a la API. El día que la tabla tenga un campo interno, hay que añadirlo ahí a conciencia para exponerlo. El `passwordHash` nunca sale.

### Validación compartida

Los esquemas de Zod viven en [`packages/shared/src/schemas.ts`](../packages/shared/src/schemas.ts) y los usan **el servidor y el formulario**. Una sola definición significa que el `maxLength` del input y el límite que aplica el servidor no pueden desincronizarse.

En el servidor se aplican con [`ZodValidationPipe`](../apps/api/src/common/pipes/zod-validation.pipe.ts), que además transforma: el `.trim()` del esquema llega ya aplicado al handler.

### XSS

Sin `dangerouslySetInnerHTML` ni `innerHTML` en todo el frontend. React escapa el contenido por defecto.

---

## Sesión y tokens

Los tokens viven en `localStorage` — ver [`lib/session-store.ts`](../apps/web/src/lib/session-store.ts).

**Es una decisión consciente con una desventaja conocida:** cualquier XSS puede leerlos. La alternativa segura son cookies `httpOnly`, que el JavaScript no ve — pero el handshake de Socket.IO manda el token por `auth`, y eso exige que el cliente pueda leerlo. Elegir cookies significaría autenticar el socket por cookie y montar protección CSRF para el resto: es un rediseño, no un parche.

Lo que sí se hace mientras tanto:

- El access token dura 15 minutos
- El refresh se rota en cada uso y se guarda hasheado
- El logout lo invalida en el servidor
- **La CSP es la mitigación principal** — impide que el script inyectado llegue a ejecutarse

---

## Cadena de suministro

La política vive en [`pnpm-workspace.yaml`](../pnpm-workspace.yaml).

- **Deny-by-default en scripts de instalación.** Un paquete comprometido normalmente entrega su payload desde un `postinstall`
- **`strictDepBuilds`** hace que la instalación *falle*, no que avise, ante una dependencia con scripts sin revisar
- **`minimumReleaseAge: 1440`** rechaza versiones publicadas hace menos de 24 horas; la mayoría de los paquetes comprometidos se retiran del registro en horas
- **`--frozen-lockfile` en CI**, para que el pipeline falle si el lockfile no corresponde al `package.json`
- **Job `audit`** en cada push, con nivel `moderate` en adelante

La política ya se ganó el sueldo dos veces: bloqueó la instalación de Prisma y obligó a decidir paquete por paquete, y el job de audit encontró [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) en una dependencia transitiva de cuarto nivel que nadie había declarado.

---

## Pendiente

| Qué | Por qué no está |
| --- | --- |
| **Protección antibots** | El registro es abierto. Necesita decidir entre [Turnstile](https://developers.cloudflare.com/turnstile/) (gratis, sin fricción) y [hCaptcha](https://www.hcaptcha.com/) (más estricto) |
| **Cookies httpOnly** | Rediseño del transporte del token, ver [Sesión](#sesión-y-tokens) |
| **Rate limit distribuido** | El almacén en memoria no sirve con varias instancias |
| **Cifrado en reposo** | No se almacena todavía nada que lo requiera |
