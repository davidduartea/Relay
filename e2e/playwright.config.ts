import { defineConfig, devices } from "@playwright/test";

const WEB_URL = "http://localhost:3000";
const API_URL = "http://localhost:4000";

const isCI = Boolean(process.env["CI"]);

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",

  // Los E2E tocan la misma base de datos, pero cada test se crea sus propios
  // usuarios y su propia sala con nombres únicos, así que pueden correr en
  // paralelo sin pisarse.
  fullyParallel: true,

  // En CI un `.only` olvidado haría pasar el pipeline ejecutando un solo test.
  forbidOnly: isCI,

  // Reintentar en local esconde los tests inestables justo cuando conviene
  // verlos; en CI evita que un fallo de red tumbe un PR sano.
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,

  reporter: isCI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: WEB_URL,

    // Traza sólo del primer reintento: guardar siempre llena el disco, y
    // cuando un test pasa nadie la mira. Del reintento sí, porque es
    // exactamente el caso que hay que investigar.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /**
   * Playwright levanta la API y la web por su cuenta.
   *
   * `reuseExistingServer` en local aprovecha el `pnpm dev` que ya se tenga
   * abierto — arrancar otro chocaría con el puerto. En CI siempre arranca
   * limpio, porque ahí un servidor "reutilizado" sería de otra ejecución.
   */
  webServer: [
    {
      command: "pnpm --filter @relay/api start",
      url: `${API_URL}/healthz`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",

      // La suite registra decenas de usuarios en segundos desde una sola IP,
      // así que el límite real de credenciales — 5 por minuto — la ahogaría.
      // Se sube sólo aquí; que el freno funciona lo comprueba un test de
      // integración del API, que sí levanta el guard con el límite de verdad.
      env: { AUTH_RATE_LIMIT: "10000", DEFAULT_RATE_LIMIT: "10000" },
    },
    {
      command: "pnpm --filter @relay/web start",
      url: WEB_URL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
