# Docker

Cómo se empaquetan las dos aplicaciones, qué decisiones hay detrás y qué problemas concretos costó resolver.

Cada apartado enlaza al archivo y la línea, y a la documentación oficial.

---

## Los tres conceptos

📖 [Docker overview](https://docs.docker.com/get-started/docker-overview/)

| | Qué es |
| --- | --- |
| **Imagen** | Una plantilla congelada: sistema de archivos completo con Node, el código y las dependencias. No se ejecuta |
| **Contenedor** | Una imagen en ejecución. De una imagen salen tantos contenedores como se quieran, aislados entre sí |
| **Dockerfile** | La receta para construir la imagen |

```
Dockerfile  ──build──▶  Imagen  ──run──▶  Contenedor
```

No es una máquina virtual: un contenedor es un proceso normal del anfitrión, aislado con funciones del kernel. Comparte el kernel en vez de traer el suyo, y por eso arranca en milisegundos y pesa megas en lugar de gigas.

## Capas y caché

📖 [Docker · cache](https://docs.docker.com/build/cache/)

**Cada instrucción del Dockerfile crea una capa, y las capas se cachean.** Es lo que explica el orden de casi todo lo demás.

En [`apps/api/Dockerfile:32`](../apps/api/Dockerfile) se copian **sólo los `package.json`**, y el código fuente no llega hasta la línea 53. Así un cambio en un `.ts` invalida las capas del build pero no las de la instalación: no se reinstalan dependencias.

Escrito al revés — `COPY . .` y luego `pnpm install` — cualquier cambio en cualquier archivo reinstalaría todo.

Hay que copiar **todos** los `package.json` del workspace, no sólo el del paquete que se construye: pnpm necesita ver el grafo completo para resolver el lockfile.

---

## Construcción en tres etapas

📖 [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)

Las dos imágenes usan `deps` → `build` → `runner`. **Sólo la última acaba en la imagen final**; las otras se descartan.

Es lo que mantiene fuera el compilador de TypeScript, el CLI de Nest y las dependencias de desarrollo.

| Etapa | Qué hace |
| --- | --- |
| `deps` | Instala dependencias a partir de los manifiestos |
| `build` | Compila `shared`, genera Prisma, construye la aplicación |
| `runner` | Copia lo compilado con `COPY --from=build` y nada más |

### Detalles de la etapa `deps`

**`corepack enable`** ([`:26`](../apps/api/Dockerfile)) activa la versión de pnpm que declara `packageManager` en package.json, en vez de la que trajera la imagen base. Es lo que hace el build reproducible.
📖 [corepack](https://nodejs.org/api/corepack.html)

**`--mount=type=cache`** ([`:40`](../apps/api/Dockerfile)) monta una carpeta que persiste entre builds pero no queda en la imagen. El store de pnpm sobrevive, así que la segunda construcción no vuelve a descargar nada.
📖 [Cache mounts](https://docs.docker.com/build/cache/optimize/#use-cache-mounts)

**`--ignore-scripts`** salta los postinstall. El de la raíz genera el cliente de Prisma, y en ese punto el esquema todavía no se ha copiado.

---

## API — de 1.46 GB a 658 MB

El primer intento copiaba el `node_modules` de la raíz al runner. Con pnpm esa carpeta **es el store entero**: Next (201 MB), Playwright, SWC y TypeScript viajaban dentro de la imagen del backend sin que nada los usara.

### `pnpm deploy`

[`apps/api/Dockerfile:70`](../apps/api/Dockerfile) · 📖 [pnpm deploy](https://pnpm.io/cli/deploy)

```dockerfile
CI=true pnpm --filter @relay/api --prod --legacy deploy /out
```

Arma una carpeta autocontenida con **sólo las dependencias de producción de ese paquete**, con los enlaces del workspace resueltos.

- **`CI=true`** — al cambiar a `--prod`, pnpm reconstruye `node_modules` y pide confirmación para borrar el existente. Sin terminal aborta, que es la decisión correcta por su parte: borrar `node_modules` sin preguntar en la máquina de alguien sería agresivo.
- **`--legacy`** — el modo nuevo exige `inject-workspace-packages`, que cambiaría cómo se resuelven los paquetes del workspace en todo el repositorio.

### Regenerar Prisma después del deploy

[`apps/api/Dockerfile:81`](../apps/api/Dockerfile)

`deploy` copia el paquete pero **no lo que se generó dentro de él**: el cliente vive en el store. Hay que regenerarlo contra la copia desplegada.

Se invoca el binario directamente y no con `pnpm exec`, porque la carpeta que produce `deploy` ya no es un proyecto pnpm — no tiene lockfile — y pnpm intentaría validar dependencias antes de ejecutar nada.

### Qué queda dentro y por qué

De los 658 MB restantes, unos 180 son el **CLI de Prisma**, que arrastra TypeScript y sus propias dependencias. Se queda para que el contenedor sepa aplicar sus migraciones y se despliegue de una pieza.

La alternativa habitual es sacarlo a un job aparte que migre antes de levantar la aplicación: más limpio y más ligero, pero exige un orquestador que sepa encadenar los dos pasos. En Railway o Fly con un solo proceso, esto es lo que funciona sin ceremonia.

---

## Web — 289 MB con `standalone`

[`apps/web/next.config.ts:92`](../apps/web/next.config.ts) · 📖 [output: standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)

```ts
output: "standalone",
outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
```

`standalone` produce una carpeta con el servidor y **sólo** los módulos que el build detectó como usados. Sin ella habría que copiar `node_modules` entero.

`outputFileTracingRoot` apunta a la raíz del monorepo porque el rastreo arranca en el directorio del proyecto: sin esto no encontraría `@relay/shared`, que vive dos niveles más arriba.

### El enlace roto que tumbaba el contenedor

[`apps/web/Dockerfile:80`](../apps/web/Dockerfile)

El contenedor arrancaba y moría con `MODULE_NOT_FOUND` sobre `@swc/helpers`.

**Causa:** pnpm coloca cada paquete en un store y enlaza simbólicamente desde donde se usa. El rastreo de `standalone` copió el enlace **pero no su destino**. Dentro de la imagen el enlace existía y apuntaba a la nada.

**Arreglo:** copiar el paquete real a donde el enlace espera encontrarlo, en la etapa de build.

La ruta se calcula con `basename` en lugar de escribirla: lleva la versión dentro del nombre de la carpeta (`@swc+helpers@0.5.23`) y quedaría desactualizada en la próxima subida de dependencias, sin que nada avisara hasta el despliegue.

**Lo que no funcionó, por si vuelve a pasar:**

- declarar `@swc/helpers` como dependencia de `@relay/web` — acaba en otra ruta
- `node-linker=hoisted` en `.npmrc` — **pnpm 11 ya no lee ese ajuste de ahí**; los ajustes se movieron a `pnpm-workspace.yaml`
- `--config.node-linker=hoisted` — cambia el layout y rompe la etapa de build

### `HOSTNAME=0.0.0.0`

[`apps/web/Dockerfile:99`](../apps/web/Dockerfile)

Sin esto el contenedor arranca, los logs no dicen nada y desde fuera no responde. Next escucha en `localhost` por defecto, que dentro del contenedor significa *sólo yo*.

---

## Ejecución

### Usuario sin privilegios

[`apps/api/Dockerfile:113`](../apps/api/Dockerfile) · 📖 [USER](https://docs.docker.com/reference/dockerfile/#user)

Por defecto los contenedores corren como `root`. Si alguien consigue ejecutar código en la aplicación, con root controla el contenedor entero. La imagen de Node ya trae un usuario `node`; el `--chown=node:node` de los `COPY` es para que pueda leer sus archivos.

### Healthcheck sin curl

[`apps/api/Dockerfile:118`](../apps/api/Dockerfile) · 📖 [HEALTHCHECK](https://docs.docker.com/reference/dockerfile/#healthcheck)

Se usa el propio Node en lugar de `curl` o `wget`: la imagen alpine no los trae, e instalarlos sólo para esto añade superficie de ataque.

`--start-period=20s` da margen al arranque sin contar los fallos de ese rato.

### ENTRYPOINT y migraciones

[`apps/api/docker-entrypoint.sh`](../apps/api/docker-entrypoint.sh) · 📖 [ENTRYPOINT](https://docs.docker.com/reference/dockerfile/#entrypoint)

Es `ENTRYPOINT` y no `CMD` porque el script debe correr **siempre**: `CMD` se puede sobrescribir al arrancar el contenedor, y saltárselo dejaría la base sin migrar.

Dentro:

- **`set -e`** aborta al primer error. Si la migración falla, el contenedor no arranca — deliberado: una API hablando con un esquema que no le corresponde falla de formas mucho más difíciles de diagnosticar.
- **`migrate deploy`** sólo aplica migraciones ya existentes, nunca genera ni borra. Prisma toma un *advisory lock* de Postgres, así que varias réplicas arrancando a la vez no se pisan.
- **`exec`** sustituye el proceso del shell por Node en vez de crear un hijo. Así Node es el PID 1 y recibe directamente el `SIGTERM`; sin `exec`, la señal se la queda el shell y Node muere de golpe sin cerrar conexiones.

📖 [prisma migrate deploy](https://www.prisma.io/docs/orm/prisma-migrate/workflows/production-and-testing)

---

## Compose

📖 [Compose](https://docs.docker.com/compose/)

### Perfiles

[`docker-compose.yml:33`](../docker-compose.yml) · 📖 [Profiles](https://docs.docker.com/compose/how-tos/profiles/)

Un servicio con `profiles` sólo arranca si se pide explícitamente:

```bash
docker compose up -d                        # sólo Postgres
docker compose --profile full up -d --build # la pila entera
```

Existe para que `pnpm db:up` siga haciendo lo de siempre. Sin el perfil, arrancaría también API y web, y se perdería el desarrollo con recarga en caliente.

### El DNS entre servicios

[`docker-compose.yml:44`](../docker-compose.yml) · 📖 [Networking](https://docs.docker.com/compose/how-tos/networking/)

```yaml
DATABASE_URL: postgresql://relay:relay@postgres:5432/relay
```

`postgres` es el **nombre del servicio**: compose crea una red donde el DNS lo resuelve. `localhost` apuntaría al propio contenedor de la API, donde no hay base de datos. Es de los errores más comunes al pasar de local a contenedores.

### Variables obligatorias

[`docker-compose.yml:46`](../docker-compose.yml) · 📖 [Interpolación](https://docs.docker.com/reference/compose-file/interpolation/)

```yaml
JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:?falta JWT_ACCESS_SECRET}
```

La sintaxis `${VAR:?mensaje}` hace que compose falle con ese mensaje si la variable no existe, en vez de arrancar con un secreto vacío.

### Esperar a que la base esté sana

[`docker-compose.yml:55`](../docker-compose.yml) · 📖 [depends_on](https://docs.docker.com/reference/compose-file/services/#depends_on)

```yaml
depends_on:
  postgres:
    condition: service_healthy
```

`depends_on` a secas sólo espera a que el **contenedor exista**, no a que el servicio de dentro acepte conexiones. Sin la condición, la primera migración fallaría contra una base que aún está arrancando.

### Variables que se incrustan al compilar

[`docker-compose.yml:62`](../docker-compose.yml) · 📖 [Next · env vars](https://nextjs.org/docs/app/guides/environment-variables)

`NEXT_PUBLIC_API_URL` va como **argumento de build**, no como variable de entorno: las `NEXT_PUBLIC_*` se resuelven al compilar. Cambiar de entorno exige reconstruir la imagen — es la contrapartida de que el navegador pueda leerlas.

---

## `.dockerignore`

📖 [Build context](https://docs.docker.com/build/concepts/context/#dockerignore-files)

Todo el contexto se envía al motor de Docker **antes** de ejecutar nada, así que un `node_modules` olvidado convierte un build de segundos en uno de minutos.

Y lo crítico: **los `.env` nunca deben entrar**. Quedan en el historial de capas aunque un `RUN` posterior los borre, y cualquiera con la imagen puede extraerlos.

---

## Tamaños

| Imagen | Tamaño |
| --- | --- |
| `relay-web` | 289 MB |
| `relay-api` | 658 MB |
| `postgres:17-alpine` | 423 MB |

Verificado con la pila corriendo: registro contra la API, cabeceras de seguridad en la web y el límite de peticiones devolviendo 429 al sexto intento.
