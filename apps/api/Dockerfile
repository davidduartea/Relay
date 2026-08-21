# syntax=docker/dockerfile:1

###############################################################################
# API — NestJS + Prisma
#
# Construcción en tres etapas. Lo que importa es que la imagen final no lleve
# ni el código fuente, ni el compilador, ni las dependencias de desarrollo:
# sólo el JavaScript compilado y lo que hace falta para ejecutarlo.
#
# Se construye desde la RAÍZ del monorepo, no desde esta carpeta:
#   docker build -f apps/api/Dockerfile .
# El contexto tiene que incluir el lockfile y los demás paquetes del workspace.
###############################################################################

ARG NODE_VERSION=22-alpine


###############################################################################
# 1. deps — instala dependencias
###############################################################################
FROM node:${NODE_VERSION} AS deps

# corepack trae la versión de pnpm que declara packageManager en package.json,
# en vez de la que tuviera instalada la imagen base. Es lo que hace que el
# build sea reproducible.
RUN corepack enable

WORKDIR /repo

# Sólo los manifiestos primero. Docker cachea cada capa, y separar esto del
# código fuente significa que un cambio en un .ts no vuelve a instalar nada.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY e2e/package.json ./e2e/

# El postinstall de la raíz genera el cliente de Prisma, que aquí todavía no
# puede correr porque el esquema no está copiado. Se hace explícito más abajo.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --ignore-scripts


###############################################################################
# 2. build — compila shared, genera Prisma y construye la API
###############################################################################
FROM deps AS build

WORKDIR /repo

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @relay/shared build && \
    pnpm --filter @relay/api exec prisma generate && \
    pnpm --filter @relay/api exec nest build

# `pnpm deploy` arma una carpeta autocontenida con SÓLO las dependencias de
# producción de este paquete, con los enlaces del workspace ya resueltos.
#
# Copiar el node_modules de la raíz en su lugar mete el store entero: Next,
# Playwright, SWC y TypeScript viajarían en la imagen del backend sin que nada
# los use. Medido: 1.46 GB así, contra ~300 MB con deploy.
#
# --legacy porque el modo nuevo exige `inject-workspace-packages`, que cambia
# cómo se resuelven los paquetes del workspace en todo el repo.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    CI=true pnpm --filter @relay/api --prod --legacy deploy /out

# El cliente de Prisma se genera dentro del store, así que `deploy` copia el
# paquete pero no lo que se generó en él. Se vuelve a generar contra la copia
# ya desplegada.
COPY apps/api/prisma /out/prisma
COPY apps/api/prisma.config.ts /out/

# Se invoca el binario directamente en vez de `pnpm exec`: la carpeta que
# produce `deploy` ya no es un proyecto pnpm — no tiene lockfile — así que
# pnpm intentaría validar dependencias y abortaría.
RUN cd /out && ./node_modules/.bin/prisma generate


###############################################################################
# 3. runner — la imagen que se despliega
###############################################################################
FROM node:${NODE_VERSION} AS runner

RUN corepack enable

ENV NODE_ENV=production

WORKDIR /app

# Todo llega ya resuelto desde `deploy`: dist, node_modules de producción, el
# esquema y las migraciones. Estas últimas viajan con la imagen a propósito,
# para que `prisma migrate deploy` pueda llevar la base al día al desplegar.
#
# Node ya trae un usuario `node` sin privilegios. Correr como root dentro del
# contenedor convierte una ejecución remota de código en control del contenedor.
COPY --from=build --chown=node:node /out ./

# El CLI de `prisma` se queda en la imagen — son unos 180 MB, porque arrastra
# TypeScript y sus propias dependencias — para que el contenedor pueda aplicar
# sus migraciones al arrancar y desplegarse de una pieza.
#
# La alternativa habitual es sacarlo a un job aparte que migre antes de
# levantar la aplicación. Es más limpio y más ligero, pero exige un
# orquestador que sepa encadenar los dos pasos; en Railway o Fly con un solo
# proceso, esto es lo que funciona sin ceremonia.
COPY --chmod=755 apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint.sh

USER node

EXPOSE 4000

# Sin curl ni wget en la imagen — se usa el propio Node, que ya está.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
