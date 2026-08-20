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
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/app/layout.tsx"],
      thresholds: { lines: 60, functions: 60, branches: 50, statements: 60 },
    },
  },
  resolve: {
    alias: { "@": new URL("./src/", import.meta.url).pathname },
  },
});
