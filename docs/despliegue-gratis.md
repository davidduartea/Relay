# Despliegue sin coste

Tres servicios, tres cuentas, cero euros:

|                          | Dónde        | Por qué ahí                                          |
| ------------------------ | ------------ | ---------------------------------------------------- |
| Web (Next.js)            | **Vercel**   | Estático y SSR, que es para lo que está              |
| API (NestJS + Socket.IO) | **Koyeb**    | Proceso con estado que no caduca en el plan gratuito |
| Postgres                 | **Supabase** | Postgres gestionado con plan gratuito sin caducidad  |

La alternativa de pago está en [`despliegue.md`](./despliegue.md): Railway, 5 USD
al mes, sin arranques en frío y con todo ya configurado.

---

## Por qué esta combinación y no otra

**Vercel no puede alojar el API.** Admite WebSockets, pero cada conexión queda
fijada a la instancia que la aceptó: con dos instancias, dos personas de la
misma sala caen en procesos distintos y dejan de verse. Relay reparte por salas
y mantiene presencia, así que es exactamente el caso que se rompe.

**Fly.io ya no tiene plan gratuito** para cuentas nuevas desde octubre de 2024.

**Render duerme a los 15 minutos** y tarda cerca de un minuto en despertar, y su
Postgres gratuito caduca a los 90 días.

**Neon** es la otra opción para la base y se comporta mejor con la
inactividad — suspende sólo el compute y despierta sola en milisegundos, en
lugar de pausar el proyecto entero. Si Supabase te da problemas, es el cambio
más directo: mismas dos URLs, misma configuración.

---

## El precio de que sea gratis

Koyeb escala a cero sin tráfico. **La primera visita tras un rato de silencio
espera a que el servicio arranque.** La base responde enseguida; el arranque
del contenedor es lo que se nota.

Si esto va enlazado desde un CV, tenlo en cuenta: quien abre el enlace y ve una
pantalla en blanco no siempre espera.

---

## 1 · Supabase — la base de datos

1. **supabase.com** → **New Project**. Guarda la contraseña que te pide: se
   enseña una sola vez y va dentro de las cadenas de conexión.
2. Elige la región más cercana a donde vayas a poner el API.
3. **Project Settings** → **Database** → **Connection string**. Verás **tres**
   y la diferencia importa:

| Cadena                 | Puerto | Para qué                                        |
| ---------------------- | ------ | ----------------------------------------------- |
| **Transaction pooler** | `6543` | `DATABASE_URL` — las consultas de la aplicación |
| **Session pooler**     | `5432` | alternativa por IPv4 (ver más abajo)            |
| **Direct connection**  | `5432` | `DIRECT_URL` — las migraciones de Prisma        |

A la de transacción hay que **añadirle `?pgbouncer=true`**:

```
postgresql://postgres.REF:CONTRASEÑA@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Ese parámetro apaga las sentencias preparadas de Prisma. Sin él, Prisma intenta
crearlas en segundo plano, el pooler en modo transacción no las mantiene entre
peticiones, y aparecen errores intermitentes de «prepared statement already
exists» que sólo se ven bajo carga.

### Por qué hacen falta las dos

El pooler en modo transacción **no admite las sentencias DDL** que usa
`prisma migrate deploy` — `CREATE TABLE`, `ALTER TABLE`. Y este contenedor
migra al arrancar, así que con una sola URL no levantaría.

**Es el fallo más común de esta combinación**: poner la del pooler en las dos
variables. Arranca, consulta bien, y muere en la migración.

### Si la conexión directa no responde

Supabase sirve la conexión directa **sólo por IPv6** en el plan gratuito; el
IPv4 es un extra de pago. Si el contenedor no tiene ruta IPv6, la migración
falla con un error de red — no de permisos.

La salida sin pagar: usar el **session pooler** (puerto 5432) como `DIRECT_URL`.
En modo sesión cada cliente mantiene su conexión al servidor durante toda la
sesión, así que sí admite DDL y sentencias preparadas, y llega por IPv4.

### Lo que hay que saber del plan gratuito

Supabase **pausa el proyecto entero tras una semana sin actividad** y hay que
restaurarlo a mano desde el panel. No es sólo la base: se lleva el proyecto con
ella.

Para un enlace que alguien abre de vez en cuando, eso significa encontrárselo
roto. Cualquier consulta reinicia la cuenta atrás, así que basta con entrar una
vez por semana — o programar algo que consulte, si no quieres acordarte.

### Lo que ya está hecho en el repositorio

`schema.prisma` declara las dos URLs:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

📖 [Prisma · PgBouncer](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer)

---

## 2 · Koyeb — el API

1. **koyeb.com** → cuenta con GitHub. Pide tarjeta **sólo para verificar
   identidad**; el plan gratuito no cobra.
2. **Create Service** → **GitHub** → `davidduartea/Relay`.
3. Tipo de construcción: **Dockerfile**.
   - Dockerfile: `apps/api/Dockerfile`
   - **Build context: la raíz del repositorio** — el Dockerfile necesita el
     lockfile y `packages/shared`, que están fuera de `apps/api`
4. Tamaño de instancia: **Free (nano)**.
5. Puerto: **4000**, y la comprobación de salud en **`/healthz`**.

### Variables

| Variable             | Valor                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| `NODE_ENV`           | `production`                                                            |
| `DATABASE_URL`       | transaction pooler de Supabase (6543) **con `?pgbouncer=true`**         |
| `DIRECT_URL`         | conexión directa de Supabase (5432), o el session pooler si no hay IPv6 |
| `JWT_ACCESS_SECRET`  | 32+ caracteres aleatorios                                               |
| `JWT_REFRESH_SECRET` | otros 32+, **distintos**                                                |
| `WEB_ORIGIN`         | provisional; se corrige en el paso 4                                    |

Para generar los secretos, dos veces:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Si coinciden, la API se niega a arrancar: `assertSecretsDiffer` existe para eso.

`PORT` y `TRUST_PROXY_HOPS` no se ponen — el primero lo inyecta la plataforma y
el segundo ya vale 1 por defecto, que es lo correcto detrás de un balanceador.

### Comprobación

```bash
curl https://TU-SERVICIO.koyeb.app/healthz
```

Las migraciones se aplican solas al arrancar. Si una falla, el contenedor no
levanta — es deliberado.

---

## 3 · Vercel — la web

Igual que en el despliegue de pago:

| Ajuste             | Valor                                        |
| ------------------ | -------------------------------------------- |
| **Root Directory** | `apps/web`                                   |
| Build Command      | _dejar vacío_ — usa el script `vercel-build` |
| `API_URL`          | `https://TU-SERVICIO.koyeb.app`              |

`API_URL` sin prefijo `NEXT_PUBLIC_` y sin barra final. Hace falta al compilar y
al ejecutar con el mismo valor: la CSP se genera al compilar y su `connect-src`
tiene que listar el origen del socket.

---

## 4 · Cerrar el círculo

Vuelve a Koyeb y pon `WEB_ORIGIN` con la URL real de Vercel, sin barra final.

Sin este paso el chat se queda en «Conectando…» para siempre: el handshake del
socket lo rechaza CORS y el navegador no explica por qué.

---

## 5 · Las salas

El seed no corre en el despliegue. Con una cuenta creada y sesión iniciada,
desde la propia web, o por el API:

```bash
curl -X POST https://TU-SERVICIO.koyeb.app/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{"name":"General","slug":"general"}'
```

---

## Si algo falla

| Síntoma                             | Causa                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| «Conectando…» eterno                | `WEB_ORIGIN` no coincide con el dominio de Vercel                                   |
| «Sin conexión. Reintentando…»       | `API_URL` distinto entre build y runtime: lo bloquea la CSP                         |
| El contenedor no arranca            | Los logs nombran la variable que falta                                              |
| Error de DDL al migrar              | `DIRECT_URL` apunta al pooler de transacción (6543) en vez de a la conexión directa |
| La migración no llega a la base     | Conexión directa sólo por IPv6. Usa el session pooler (5432) como `DIRECT_URL`      |
| «prepared statement already exists» | Falta `?pgbouncer=true` en `DATABASE_URL`                                           |
| Todo dejó de responder de golpe     | Supabase pausó el proyecto por inactividad. Restaurar desde el panel                |
| La primera visita tarda             | Koyeb estaba dormido. Es el precio del plan gratuito                                |
