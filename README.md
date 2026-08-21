# Relay

Chat en tiempo real construido como monorepo: **NestJS + Socket.IO** en el backend, **Next.js** en el frontend, y un paquete compartido que define el contrato de eventos para ambos lados.

El objetivo del proyecto no es el chat en sí, sino ejercitar las partes que normalmente se dejan para después: testing de una capa realtime, accesibilidad verificada en CI, y una política explícita de seguridad de dependencias.

## Estado

| Fase | Qué incluye | Estado |
| --- | --- | --- |
| 0 | Base del monorepo, contrato compartido, CI | ✅ Listo |
| 1a | Persistencia con Prisma y Postgres | ✅ Listo |
| 1b | Auth con JWT y guards | ✅ Listo |
| 1c | Gateway de WebSocket | ✅ Listo |
| 1d | UI del chat en Next.js | ✅ Listo |
| 2 | E2E con dos navegadores | ✅ Listo |
| 3 | Accesibilidad con axe dentro de los E2E | ✅ Listo |

## Stack

- **Backend** — NestJS 11, Socket.IO 4, Postgres 17
- **Frontend** — Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Compartido** — TypeScript 5.9 estricto, Zod 4
- **Calidad** — Vitest en ambos apps, Playwright para E2E, axe-core para accesibilidad, ESLint 9 flat config con jsx-a11y, Prettier
- **Infra** — pnpm workspaces, Docker Compose, GitHub Actions

## Puesta en marcha

Hace falta Docker corriendo para la base de datos.

```bash
pnpm install
pnpm --filter @relay/shared build           # los apps consumen dist/

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

pnpm db:up                                  # Postgres en Docker
pnpm db:migrate                             # crea las tablas
pnpm db:seed                                # dos salas de ejemplo

pnpm dev                                    # api :4000 · web :3000
```

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Levanta API y web en paralelo |
| `pnpm lint` | ESLint sobre todo el monorepo |
| `pnpm typecheck` | `tsc --noEmit` en los tres paquetes |
| `pnpm test` | Vitest en API y web |
| `pnpm test:coverage` | Igual, con umbrales que rompen el build |
| `pnpm build` | Compila shared, luego API y web |
| `pnpm audit` | Avisos de dependencias, nivel moderate en adelante |
| `pnpm db:up` / `db:down` | Postgres en Docker |
| `pnpm db:migrate` | Aplica migraciones pendientes |
| `pnpm db:seed` | Datos de ejemplo (idempotente) |
| `pnpm db:studio` | Explorador visual de la base |
| `pnpm free-port` | Mata el proceso que ocupe el 4000 |
| `pnpm e2e` | Suite end-to-end con Playwright |
| `pnpm e2e:ui` | Igual, en modo interactivo |
| `pnpm e2e:report` | Abre el último reporte HTML |

## Estructura

```
apps/
  api/
    prisma/       Esquema, migraciones y seed
    src/
      common/     Pipes y utilidades transversales
      prisma/     PrismaService + PrismaModule
      auth/       JWT, guard global y decoradores
      config/     Validación del entorno con Zod
      chat/       Gateway de WebSocket
      messages/   Historial e idempotencia
      rooms/      Primer módulo de funcionalidad
  web/
    src/
      app/      Rutas: /, /login, /register, /chat
      lib/      Cliente HTTP y almacén de sesión
      modules/  auth/ y chat/
packages/
  shared/         Contrato de eventos, modelos y esquemas Zod
e2e/              Playwright: auth, chat entre dos navegadores y accesibilidad
```

## Decisiones que vale la pena explicar

**El contrato de eventos vive en `packages/shared`.** `ServerToClientEvents` y `ClientToServerEvents` los importan el gateway de Nest y el cliente de Socket.IO. Cambiar la forma de un evento rompe la compilación de los dos lados a la vez, así que el error sale en `pnpm typecheck` y no en producción.

**Los esquemas de Zod también son compartidos.** El mismo `sendMessageSchema` valida en el servidor y en el formulario. Es lo que evita el bug clásico de que el input deje escribir 600 caracteres y el API responda 400.

**Todos los eventos cliente→servidor usan acknowledgements.** El último argumento es un callback que responde `{ ok: true, data }` o `{ ok: false, error }`. Así el update optimista se puede revertir cuando el envío falla de verdad, en lugar de mentirle al usuario.

**Cada mensaje lleva un `clientId` generado antes de enviar.** Sirve para reconciliar el mensaje optimista con el confirmado, y para que el servidor descarte duplicados cuando el cliente reintenta tras una reconexión.

**Vitest en los dos apps, no Jest en el backend.** Nest genera Jest por defecto; correr un solo runner da un solo formato de coverage. El precio es `unplugin-swc`: Vitest usa esbuild, que borra los decoradores sin emitir la metadata que la inyección de dependencias necesita en runtime.

**`PrismaModule` no es `@Global()`.** Es lo que hace la mayoría de proyectos con el módulo de base de datos, y ahorra importarlo en cada feature. Pero un módulo global es una dependencia invisible: al leer `RoomsModule` no habría forma de saber que toca la base sin abrir el servicio. Importarlo explícitamente cuesta una línea y hace que el grafo diga la verdad. Si algún día son quince módulos, la decisión correcta cambia.

**`RoomsService.create` intenta y captura, en vez de consultar y luego crear.** Un `findUnique` previo deja una ventana entre la comprobación y el insert donde otra petición puede colarse con el mismo slug. La restricción única de la base no tiene esa ventana; el código traduce el error `P2002` a un 409.

**El guard de JWT es global y las rutas abiertas se marcan con `@Public()`.** Una lista blanca de rutas *privadas* se olvida en cuanto alguien añade un endpoint; una de rutas *públicas* falla hacia el lado seguro.

**Access y refresh se firman con secretos distintos, y el arranque lo comprueba.** Si coincidieran, un access token interceptado — que viaja en cada petición — serviría para renovar la sesión indefinidamente, y su vida corta dejaría de significar nada.

**El refresh token lleva un `jti` único.** Sin él, dos tokens firmados dentro del mismo segundo salen idénticos: `iat` va en segundos, así que el payload entero coincide y con él la firma. La rotación entonces no rota nada. Hay un test de regresión para esto.

**Login responde lo mismo exista o no la cuenta**, y verifica contra un hash de descarte cuando el correo no existe, para que tarde igual. Un mensaje o un tiempo distinto por caso convierte el login en un oráculo de qué correos están registrados.

**El gateway autentica en un middleware del handshake, no en `handleConnection`.** Ahí el cliente ya recibió su evento `connect` y sólo después se le echa: para él es indistinguible de una caída de red, así que reintenta en bucle con el mismo token malo. Rechazar en el middleware llega como `connect_error`, que sí puede distinguir.

**La presencia al salir se emite en `disconnecting`, no en `disconnect`.** Cuando salta el segundo, Socket.IO ya vació `client.rooms` y no queda a quién avisar.

**Estar en la sala es la autorización para escribir en ella.** El autor sale del token, nunca del payload: si viniera del cliente, cualquiera podría publicar en nombre de otro cambiando un campo.

**Los errores del gateway van por acknowledgement, no por excepción.** Una excepción llega al cliente como un evento suelto de error, sin forma de saber qué envío la provocó; el ack va atado a esa llamada concreta.

**El socket del cliente vive en estado de React, no en una ref.** Con una ref, el efecto que registra los listeners no tiene de qué depender: corre una sola vez, y en ese primer render el socket todavía no existe porque el token se lee de localStorage en otro efecto. Los listeners no llegaban a engancharse y el chat aparecía vacío al recargar — que es como se abre casi siempre.

**El mensaje se pinta antes de que el servidor conteste, y se reconcilia por `clientId`.** El servidor devuelve el mensaje a todos, incluido el autor; sin reconciliar, quien escribe lo vería dos veces. Si el envío falla de verdad, la copia optimista se retira: dejarla puesta le diría al usuario que su mensaje llegó cuando no lo hizo.

**Los E2E localizan por rol y nombre accesible, nunca por clase de CSS ni `data-testid`.** Un test que busca el botón como `getByRole("button", { name: "Enviar" })` se rompe si alguien le quita la etiqueta — que es exactamente cuando debe romperse, porque en ese momento el botón dejó de servirle a un lector de pantalla. El `data-testid` habría seguido pasando.

**Cada test genera sus propios usuarios y textos de mensaje.** La sala persiste entre ejecuciones, así que un texto fijo hace que la segunda corrida encuentre el mensaje de la primera y el localizador falle por ambigüedad: un test que sólo pasa la primera vez, que es peor que uno que no pasa nunca.

**La accesibilidad se comprueba en dos capas.** `eslint-plugin-jsx-a11y` atrapa lo que se ve leyendo el JSX — un input sin etiqueta, un `onClick` en un div — y corre en cada guardado. `@axe-core/playwright` atrapa lo que sólo existe con la página montada: contraste calculado, ARIA que apunta a ids inexistentes, regiones con scroll inalcanzables. Hacen falta las dos: axe encontró dos violaciones que el linter no podía ver.

**Cuando axe y jsx-a11y se contradicen, gana axe.** La lista de mensajes tiene scroll y necesita `tabIndex`, o con el teclado no se llega a los mensajes antiguos — criterio 2.1.1 de WCAG. jsx-a11y lo prohíbe por heurística; su lista de roles permitidos no contempla el caso. La regla queda configurada, no desactivada.

**Se comprueba contra `wcag2a`, `wcag2aa` y `wcag21aa`, sin las reglas "best-practice" de axe.** Son consejos razonables, pero no son norma, y mezclarlos hace que nadie sepa si un fallo del pipeline es legalmente relevante.

**El freno de peticiones corre ANTES que la autenticación.** Los dos guards son globales y el orden de registro es el orden de ejecución: el límite va primero para que un atacante no haga trabajar a la CPU en argon2 en cada uno de sus intentos, que es justo lo que se intenta evitar.

**Dos límites separados, no uno.** En `/auth/login` cada petición es una contraseña probada, así que van 5 por minuto; en el resto, 120. Independientes: quedarse sin intentos de login no deja al usuario sin poder leer las salas. El límite es configurable por entorno porque los E2E registran decenas de usuarios en segundos desde una sola IP — pero el valor por defecto es el de producción, así que quien no lo toque queda protegido.

**`@SkipThrottle()` sin argumentos sólo salta el throttler llamado `default`**, no todos. Hay que nombrar el estricto explícitamente o `/auth/me` — que el cliente llama al cargar cada página — agotaría el cupo de credenciales sin intentar ni una contraseña.

**`healthz` no toca la base de datos.** Si el orquestador reinicia el contenedor cada vez que Postgres tiene un hipo, una degradación se convierte en una caída. La comprobación de dependencias irá en un `/readyz` aparte.

## Trampas conocidas

**`prisma.config.ts` desactiva la carga automática de `.env`.** En cuanto ese archivo existe, Prisma avisa con *"Prisma config detected, skipping environment variable loading"* y `DATABASE_URL` llega vacía — el esquema ni siquiera valida. El propio config lo carga con `process.loadEnvFile`, nativo desde Node 20.12.

**El cliente generado vive dentro del store de pnpm**, así que cualquier `pnpm install` o re-link lo borra y `tsc` empieza a decir que `@prisma/client` no exporta `PrismaClient`. Todos los comandos pasan por [`scripts/ensure-prisma-client.mjs`](apps/api/scripts/ensure-prisma-client.mjs), que regenera si el cliente falta **o** si `schema.prisma` cambió desde la última vez — comparando un hash guardado. Si nada cambió, no toca nada.

**En Windows el motor de consultas no se puede reemplazar mientras está cargado.** Ese es el motivo de que el guard sea condicional: con el servidor de dev en otra terminal, un `prisma generate` incondicional falla con `EPERM`, y correr los tests con el servidor levantado es lo normal. Cuando el esquema sí cambió y hay un proceso sujetando el motor, el script lo detecta y dice qué hacer.

**`nest start --watch` deja un proceso huérfano** si se cierra la terminal en vez de usar Ctrl+C. Ese hijo sigue escuchando en el 4000 y sosteniendo el motor de Prisma, lo que hace fallar el generate por un servidor que uno creía muerto. Se libera con `pnpm free-port`.

## Seguridad de dependencias

La política vive en [`pnpm-workspace.yaml`](./pnpm-workspace.yaml) y es deliberada:

- **Deny-by-default en scripts de instalación.** Un paquete comprometido normalmente entrega su payload desde un `postinstall`; negarlos por defecto cierra esa vía.
- **`strictDepBuilds`** hace que la instalación *falle*, no que avise, cuando aparece una dependencia con scripts sin revisar.
- **`minimumReleaseAge: 1440`** rechaza versiones publicadas hace menos de 24 horas. La mayoría de los paquetes comprometidos se retiran del registro en horas.
- **`--frozen-lockfile` en CI**, para que el pipeline falle si el lockfile no corresponde al `package.json` en vez de resolver versiones nuevas en silencio.

La política se ganó el sueldo al instalar Prisma: bloqueó los tres paquetes y obligó a decidir uno por uno. Sólo `@prisma/engines` quedó permitido, porque descarga binarios específicos de plataforma que no pueden viajar en el tarball. Los postinstall de `prisma` y `@prisma/client` siguen bloqueados y su trabajo — `prisma generate` — es ahora un paso explícito del build.

## Licencia

MIT
