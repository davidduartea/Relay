import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Los dos últimos son salida de Playwright: el reporte HTML incluye el
    // visor de trazas, que son cientos de kilobytes de JavaScript minificado.
    // Están en .gitignore, pero ESLint no lo lee.
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
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
    // Scripts sueltos de Node. No los cubre typescript-eslint, así que
    // `no-undef` sí se aplica y hay que declararle los globals del entorno.
    // Se listan a mano en vez de añadir el paquete `globals` por cuatro
    // entradas: una dependencia menos que auditar.
    files: ["**/*.mjs", "**/*.cjs", "**/*.js"],
    rules: {
      // En un script de línea de comandos, imprimir ES la interfaz.
      "no-console": "off",
    },
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
        Buffer: "readonly",
      },
    },
  },

  {
    /**
     * Accesibilidad estática en el frontend.
     *
     * Atrapa lo que se ve leyendo el JSX: un input sin etiqueta, un `onClick`
     * en un div que no responde al teclado, un `alt` que falta. Es la mitad
     * barata del problema — corre en milisegundos, en cada guardado.
     *
     * La otra mitad sólo aparece con la página montada: contraste real,
     * atributos ARIA que apuntan a ids inexistentes, orden de encabezados. De
     * eso se encarga axe dentro de los E2E.
     */
    files: ["apps/web/**/*.tsx"],
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      ...jsxA11y.configs.recommended.rules,

      /**
       * Aquí las dos herramientas se contradicen y hay que elegir.
       *
       * axe exige que una región con scroll sea enfocable, porque si no, quien
       * navega con teclado no puede desplazarla y no llega al contenido de
       * arriba — es el criterio 2.1.1 de WCAG, y lo detectó de verdad en la
       * lista de mensajes. jsx-a11y, por su parte, prohíbe `tabIndex` en
       * elementos no interactivos para evitar que se llene el orden de
       * tabulación de paradas inútiles.
       *
       * Gana axe: su regla viene de la norma, la de jsx-a11y es una heurística
       * cuya lista de roles permitidos simplemente no contempla este caso. Se
       * añaden los roles de contenedores que sí pueden necesitar scroll.
       */
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        { tags: [], roles: ["tabpanel", "log", "region"], allowExpressionValues: true },
      ],
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
