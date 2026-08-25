import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // El tsconfig usa `jsx: "preserve"` porque quien transforma en producción es
  // Next, no tsc. Vitest lee ese tsconfig y sin esto cae al runtime clásico,
  // que exige un `import React` en cada archivo. Lo forzamos a automático.
  esbuild: { jsx: "automatic" },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],

      /**
       * Qué queda fuera del umbral de cobertura unitaria, y por qué.
       *
       * Un umbral sólo significa algo si mide lo que esta suite se propone
       * cubrir. Estos archivos se verifican en otro nivel, y contarlos aquí
       * empuja a escribir tests que montan medio árbol de React para repetir
       * lo que los E2E ya comprueban mejor.
       *
       * - `app/**` son cascarones de ruta: entre tres y nueve líneas que
       *   renderizan un componente. No hay lógica que probar.
       * - `auth-form` y `chat-screen` son composición — orquestan hooks,
       *   navegación y estado de sesión. Su contrato es un recorrido completo,
       *   y eso lo cubren 27 E2E contra un navegador real.
       *
       * Lo que sí entra: hooks, componentes con lógica propia, y las
       * utilidades de `lib/`.
       */
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/app/**",
        "src/modules/auth/index.tsx",
        "src/modules/auth/SessionProvider.tsx",
        "src/modules/chat/main/ChatScreen.tsx",
      ],

      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src/", import.meta.url).pathname,
      "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname,
    },
  },
});
