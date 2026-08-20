import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/.next/**", "**/coverage/**", "**/node_modules/**"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // Los argumentos que empiezan con _ son descartes intencionales. Sin esta
      // excepción la gente los renombra a cosas peores para callar la regla.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },

  {
    files: ["apps/api/**/*.ts"],
    rules: {
      // Los decoradores de Nest usan clases vacías como marcadores de módulo.
      "@typescript-eslint/no-extraneous-class": "off",

      // CRÍTICO: apagada a propósito, y no por comodidad.
      //
      // La inyección de dependencias de Nest resuelve qué construir leyendo el
      // tipo del parámetro del constructor en RUNTIME, vía la metadata que
      // emite `emitDecoratorMetadata`. `import type` se borra al compilar, así
      // que si esta regla "arregla" el import de un provider, la metadata pasa
      // a ser undefined y Nest revienta al arrancar con un error de
      // dependencia que no explica la causa.
      //
      // En apps/web sí está activa: ahí ningún tipo se necesita en runtime.
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },

  prettier,
);
