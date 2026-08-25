# Despliegue

Dos plataformas, porque el chat lo obliga.

## Por qué no todo en Vercel

Vercel admite WebSockets desde 2026, Socket.IO incluido. Aun así **el API no
puede vivir ahí**.

Una conexión de WebSocket en Vercel queda fijada a la instancia de función que
la aceptó. Con dos instancias, dos personas en la misma sala pueden acabar en
procesos distintos: los mensajes de una no llegan a la otra, y la lista de
presencia de cada una sólo ve a los suyos. Relay reparte por salas y mantiene
presencia, así que es exactamente el caso que se rompe.

Se arregla con un adaptador de Redis para Socket.IO, que difunde entre
instancias. Es una dependencia más y un servicio más, y para este proyecto no
compensa: un solo proceso con estado hace el mismo trabajo.

Así que:

|                          | Dónde   | Por qué                                             |
| ------------------------ | ------- | --------------------------------------------------- |
| Web (Next.js)            | Vercel  | Estático y SSR, que es para lo que está             |
| API (NestJS + Socket.IO) | Railway | Un proceso con estado, sin instancias que se pisen  |
| Postgres                 | Railway | En el mismo proyecto que el API, sin salir a la red |

---

## El orden importa

Cada lado necesita la URL del otro, así que hay una vuelta obligatoria:

```
1. Railway: Postgres + API          → sale la URL del API
2. Vercel: web con esa URL          → sale la URL de la web
3. Railway: WEB_ORIGIN ← URL de la web
4. Railway: redesplegar
```

Saltarse el paso 3 deja el chat conectando eternamente: el `handshake` del
socket lo rechaza CORS y el navegador no explica por qué.

---

## 1 · Railway — Postgres y API

### Postgres

Nuevo proyecto → **Add** → **Database** → **PostgreSQL**. Railway crea la base y
expone `DATABASE_URL` dentro del proyecto.

### El servicio del API

**Add** → **GitHub Repo** → `davidduartea/Relay`.

`railway.json` en la raíz ya dice cómo construirlo:

```json
{
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "apps/api/Dockerfile" },
  "deploy": { "healthcheckPath": "/healthz", "healthcheckTimeout": 60 }
}
```

El Dockerfile se construye desde la **raíz del monorepo** — necesita el lockfile
y `packages/shared` —, que es justo el contexto que Railway usa por defecto.

### Variables

En **Variables** del servicio del API:

| Variable             | Valor                                                      |
| -------------------- | ---------------------------------------------------------- |
| `NODE_ENV`           | `production`                                               |
| `DATABASE_URL`       | `${{Postgres.DATABASE_URL}}`                               |
| `JWT_ACCESS_SECRET`  | 32+ caracteres aleatorios                                  |
| `JWT_REFRESH_SECRET` | 32+ caracteres aleatorios, **distintos** de los anteriores |
| `WEB_ORIGIN`         | de momento cualquier URL válida; se corrige en el paso 3   |
| `APP_VERSION`        | opcional, sale en `/healthz`                               |
| `TRUST_PROXY_HOPS`   | opcional; por defecto 1, que es lo correcto en Railway     |

`PORT` **no se pone**: lo inyecta Railway y el esquema de entorno lo lee.

Para generar los secretos:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Dos veces. Si coinciden, la API se niega a arrancar — `assertSecretsDiffer`
existe para eso: con secretos iguales, un access token vale como refresh y la
vida corta del primero deja de servir de nada.

### Las migraciones

No hay paso manual. `docker-entrypoint.sh` ejecuta `prisma migrate deploy` antes
de arrancar, y si falla el contenedor no levanta. Es deliberado: una API
hablando con un esquema que no le corresponde falla de formas mucho más
difíciles de diagnosticar.

### Comprobación

**Settings** → **Networking** → **Generate Domain**. Luego:

```bash
curl https://TU-API.up.railway.app/healthz
# {"status":"ok","uptimeSeconds":12,"version":"dev"}
```

Si no responde, los logs dirán exactamente qué variable falta:
`assertProductionConfig` las nombra todas de una vez en vez de una por
despliegue.

---

## 2 · Vercel — la web

**Add New** → **Project** → `davidduartea/Relay`.

| Ajuste             | Valor         |
| ------------------ | ------------- |
| Framework          | Next.js       |
| **Root Directory** | `apps/web`    |
| Build Command      | _dejar vacío_ |

El comando se deja vacío a propósito: `apps/web/package.json` declara

```json
"vercel-build": "pnpm --filter @relay/shared build && next build"
```

y Vercel prefiere ese script sobre `build` cuando existe. Hace falta porque
`@relay/shared` se resuelve por `dist/`, que está en `.gitignore` — sin
construirlo antes, `next build` no encuentra el paquete.

### Variables

| Variable  | Valor                           |
| --------- | ------------------------------- |
| `API_URL` | `https://TU-API.up.railway.app` |

**Sin prefijo `NEXT_PUBLIC_`, a propósito.** Con él, Next la incrusta en el
JavaScript y cualquiera descubre el origen del backend descargando un chunk,
sin tener cuenta. Ninguna petición HTTP sale ya del navegador — van todas por
server actions — así que la dirección sólo la necesita el servidor.

La excepción es el WebSocket, que el navegador tiene que abrir él. Esa
dirección se entrega en el render de `/chat`, así que sólo la recibe quien ya
tiene sesión.

**Hace falta al compilar y al ejecutar, con el mismo valor.** Al compilar
porque la CSP se genera entonces y su `connect-src` tiene que listar el origen
del socket; al ejecutar, para las llamadas del servidor y para pasarle esa
dirección al cliente. Si difieren, la aplicación arranca, el chat se pinta
entero y la conexión se queda en «Sin conexión. Reintentando…» — el navegador
la bloquea por CSP y no lo dice en ningún sitio visible.

En Vercel basta con definirla una vez: sirve para los dos momentos.

---

## 3 · Cerrar el círculo

Vuelve a Railway y pon `WEB_ORIGIN` con la URL real de Vercel, **sin barra
final**:

```
WEB_ORIGIN=https://relay-tu-usuario.vercel.app
```

Railway redespliega solo al cambiar una variable.

Ese valor gobierna dos cosas: el CORS de HTTP (`main.ts`) y el del socket
(`chat.gateway.ts`). Con `assertProductionConfig` activo, un `WEB_ORIGIN`
apuntando a `localhost` impide el arranque en producción — a propósito, porque
desplegar así deja la API aceptando peticiones del navegador de cualquiera y
rechazando las del dominio real.

---

## 4 · Verificación

```bash
curl https://TU-API.up.railway.app/healthz          # {"status":"ok",...}
curl https://TU-API.up.railway.app/rooms            # las salas del seed
```

Y en la web desplegada:

1. Crear una cuenta.
2. Abrir la misma sala en una ventana de incógnito con otra cuenta.
3. Escribir en una: el mensaje aparece en la otra sin recargar, la lista de
   presencia cuenta dos, y el indicador de escritura se enciende y se apaga.

Si el estado se queda en «Conectando…», es `WEB_ORIGIN`. Es el único fallo que
se manifiesta así.

---

## Las salas iniciales

El `seed` no corre en el despliegue. Una vez que la base esté en marcha:

```bash
railway run --service api pnpm --filter @relay/api db:seed
```

O crearlas por el API, que también vale:

```bash
curl -X POST https://TU-API.up.railway.app/rooms \
  -H "Content-Type: application/json" \
  -d '{"name":"General","slug":"general"}'
```

---

## `API_INTERNAL_URL`

Sólo hace falta cuando el servidor de Next y el API comparten red privada — en
el `docker-compose` de este repositorio, por ejemplo, donde el API es
`http://api:4000` para el contenedor y el dominio público para el navegador.

Con la web en Vercel y el API en Railway **no aplica**: son plataformas
distintas y el servidor de Next sale por internet igual que el navegador. Se
deja sin definir y cae a `API_URL`.
