import { IBM_Plex_Sans, Jost } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SessionProvider } from "@/modules/auth/session-provider";
import "./globals.css";

/**
 * Las dos familias del sistema.
 *
 * `next/font` las descarga al compilar y las sirve desde el propio dominio, así
 * que no hay petición a fonts.googleapis.com en tiempo de ejecución: la CSP
 * puede seguir con `font-src 'self'` y no se filtra a Google quién visita la
 * página. También elimina el salto de texto al cargar, porque el CSS de la
 * fuente entra en el mismo documento.
 */
const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-display",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Relay",
  description: "Salas de chat para tu equipo. Escribes y los demás lo leen al instante.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `lang` es la primera regla de accesibilidad que casi todo el mundo se
    // salta: sin él, el lector de pantalla lee español con fonética inglesa.
    <html lang="es" className={`${jost.variable} ${plex.variable}`}>
      <body className="bg-paper text-ink min-h-dvh font-[family-name:var(--font-ui)] antialiased">
        {/* Enlace de salto: invisible hasta que recibe foco. Deja a quien
            navega con teclado brincarse la navegación en cada página. */}
        <a
          href="#main"
          className="bg-blue sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Saltar al contenido
        </a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
