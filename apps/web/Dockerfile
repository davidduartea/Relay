# syntax=docker/dockerfile:1

###############################################################################
# Web — Next.js
#
# Aprovecha `output: "standalone"`, que empaqueta el servidor con sólo los
# módulos que el build detectó como usados. La imagen final no lleva ni
# `node_modules` completo ni el código fuente.
#
# Se construye desde la RAÍZ del monorepo:
#   docker build -f apps/web/Dockerfile .
###############################################################################

ARG NODE_VERSION=22-alpine


###############################################################################
# 1. deps
###############################################################################
FROM node:${NODE_VERSION} AS deps

RUN corepack enable

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY e2e/package.json ./e2e/

# Enlazado plano, sólo dentro de la imagen.
#
# pnpm monta node_modules con enlaces simbólicos a un store; el rastreo de
# `output: standalone` no siempre los sigue, y algunas dependencias
# transitivas de Next — `@swc/helpers`, sin ir más lejos — se quedan fuera.
# El contenedor arranca y muere con MODULE_NOT_FOUND.
#
# `hoisted` produce un árbol plano al estilo npm, que el rastreo sí recorre
# entero. Sólo afecta a cómo queda el disco aquí dentro: la resolución sigue
# saliendo del lockfile, así que --frozen-lockfile mantiene las versiones
# exactas y el desarrollo local conserva los enlaces de pnpm.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --ignore-scripts


###############################################################################
# 2. build
###############################################################################
FROM deps AS build

WORKDIR /repo

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# La URL del API se incrusta en el bundle: las variables NEXT_PUBLIC_* se
# resuelven al construir, no al arrancar. Cambiar de entorno exige reconstruir
# — es la contrapartida de que el navegador pueda leerlas.
ARG API_URL=http://localhost:4000
ENV API_URL=${API_URL}

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @relay/shared build && \
    pnpm --filter @relay/web build

# Repara los enlaces rotos que deja el rastreo de `standalone`.
#
# pnpm coloca cada paquete en un store y enlaza simbólicamente desde donde se
# usa. El rastreo de Next copia el enlace pero no siempre su destino, así que
# el contenedor arranca y muere con MODULE_NOT_FOUND — le pasa a
# `@swc/helpers`, que Next necesita en runtime.
#
# La ruta se calcula con `basename` en lugar de escribirla: lleva la versión
# dentro del nombre de la carpeta y quedaría desactualizada en la próxima
# subida de dependencias, sin que nada avisara hasta desplegar.
RUN set -e; \
    for pkg in @swc+helpers; do \
      src=$(ls -d /repo/node_modules/.pnpm/${pkg}@* 2>/dev/null | head -1); \
      [ -n "$src" ] || { echo "no se encontró $pkg en el store"; exit 1; }; \
      dest="/repo/apps/web/.next/standalone/node_modules/.pnpm/$(basename "$src")"; \
      mkdir -p "$dest"; \
      cp -R "$src/." "$dest/"; \
      echo "reparado: $(basename "$src")"; \
    done


###############################################################################
# 3. runner
###############################################################################
FROM node:${NODE_VERSION} AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# `standalone` deja el servidor y sus dependencias resueltas dentro de esa
# carpeta, respetando la estructura del monorepo — de ahí las rutas anidadas.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./

# Los estáticos y el contenido público van aparte: el rastreo de `standalone`
# sólo sigue imports de JavaScript y no los ve.
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
