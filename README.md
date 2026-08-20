# Relay

Chat en tiempo real construido como monorepo: **NestJS + Socket.IO** en el backend, **Next.js** en el frontend, y un paquete compartido que define el contrato de eventos para ambos lados.

El objetivo del proyecto no es el chat en sí, sino ejercitar las partes que normalmente se dejan para después: testing de una capa realtime, accesibilidad verificada en CI, y una política explícita de seguridad de dependencias.

## Estado

| Fase | Qué incluye | Estado |
| --- | --- | --- |
| 0 | Base del monorepo, contrato compartido, CI | ✅ Listo |
| 1 | Gateway de WebSocket, auth con JWT, persistencia | ⏳ Siguiente |
| 2 | Unit, integración y E2E con dos navegadores | ⏳ |
| 3 | Accesibilidad con axe dentro de los E2E | ⏳ |

## Stack

- **Backend** — NestJS 11, Socket.IO 4, Postgres 17
- **Frontend** — Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Compartido** — TypeScript 5.9 estricto, Zod 4
- **Calidad** — Vitest en ambos apps, ESLint 9 flat config, Prettier
- **Infra** — pnpm workspaces, Docker Compose, GitHub Actions

## Puesta en marcha

```bash
pnpm install
pnpm --filter @relay/shared build   # los apps consumen dist/
cp .env.example .env
pnpm db:up                          # Postgres en Docker
pnpm dev                            # api :4000 · web :3000
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

## Estructura

```
apps/
  api/            NestJS — gateway, auth, persistencia
  web/            Next.js — cliente del chat
packages/
  shared/         Contrato de eventos, modelos y esquemas Zod
```

## Decisiones que vale la pena explicar

**El contrato de eventos vive en `packages/shared`.** `ServerToClientEvents` y `ClientToServerEvents` los importan el gateway de Nest y el cliente de Socket.IO. Cambiar la forma de un evento rompe la compilación de los dos lados a la vez, así que el error sale en `pnpm typecheck` y no en producción.

**Los esquemas de Zod también son compartidos.** El mismo `sendMessageSchema` valida en el servidor y en el formulario. Es lo que evita el bug clásico de que el input deje escribir 600 caracteres y el API responda 400.

**Todos los eventos cliente→servidor usan acknowledgements.** El último argumento es un callback que responde `{ ok: true, data }` o `{ ok: false, error }`. Así el update optimista se puede revertir cuando el envío falla de verdad, en lugar de mentirle al usuario.

**Cada mensaje lleva un `clientId` generado antes de enviar.** Sirve para reconciliar el mensaje optimista con el confirmado, y para que el servidor descarte duplicados cuando el cliente reintenta tras una reconexión.

**Vitest en los dos apps, no Jest en el backend.** Nest genera Jest por defecto; correr un solo runner da un solo formato de coverage. El precio es `unplugin-swc`: Vitest usa esbuild, que borra los decoradores sin emitir la metadata que la inyección de dependencias necesita en runtime.

**`healthz` no toca la base de datos.** Si el orquestador reinicia el contenedor cada vez que Postgres tiene un hipo, una degradación se convierte en una caída. La comprobación de dependencias irá en un `/readyz` aparte.

## Seguridad de dependencias

La política vive en [`pnpm-workspace.yaml`](./pnpm-workspace.yaml) y es deliberada:

- **Deny-by-default en scripts de instalación.** Un paquete comprometido normalmente entrega su payload desde un `postinstall`; negarlos por defecto cierra esa vía.
- **`strictDepBuilds`** hace que la instalación *falle*, no que avise, cuando aparece una dependencia con scripts sin revisar.
- **`minimumReleaseAge: 1440`** rechaza versiones publicadas hace menos de 24 horas. La mayoría de los paquetes comprometidos se retiran del registro en horas.
- **`--frozen-lockfile` en CI**, para que el pipeline falle si el lockfile no corresponde al `package.json` en vez de resolver versiones nuevas en silencio.

## Licencia

MIT
