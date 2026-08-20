import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Relay",
  description: "Chat en tiempo real con Nest y Next.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `lang` es la primera regla de accesibilidad que casi todo el mundo se
    // salta: sin él, el lector de pantalla lee español con fonética inglesa.
    <html lang="es">
      <body className="bg-ground text-ink min-h-dvh antialiased">
        {/* Enlace de salto: invisible hasta que recibe foco. Deja a quien
            navega con teclado brincarse la navegación en cada página. */}
        <a
          href="#main"
          className="focus:bg-accent sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2 focus:text-white"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
