import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  alertIn,
  composer,
  makeUser,
  messageLog,
  register,
  sendMessage,
  uniqueText,
} from "./support";

/**
 * Accesibilidad comprobada en el navegador real.
 *
 * El linter atrapa lo que se ve leyendo el JSX. Esto atrapa lo que sólo existe
 * con la página montada: contraste de color calculado, atributos ARIA que
 * apuntan a ids que no existen, orden de encabezados, campos sin nombre
 * accesible una vez resuelto todo el árbol.
 *
 * `wcag2a`, `wcag2aa` y `wcag21aa` son el nivel que piden las vacantes y el
 * que exige la normativa en la mayoría de países. Se dejan fuera las reglas
 * "best-practice" de axe: son consejos razonables, pero no son WCAG, y mezclar
 * ambos hace que nadie sepa si un fallo del pipeline es legalmente relevante.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const scan = (page: Page) => new AxeBuilder({ page }).withTags(WCAG);

/**
 * Comprueba una página entera y falla nombrando cada violación.
 *
 * El mensaje incluye el selector y la ayuda de axe: un fallo que sólo dice
 * "hay 3 violaciones" obliga a reproducirlo en local para saber cuáles, y en
 * CI eso significa no arreglarlo.
 */
async function expectNoViolations(page: Page): Promise<void> {
  const { violations } = await scan(page).analyze();

  const summary = violations.map(
    (violation) =>
      `[${violation.impact ?? "sin impacto"}] ${violation.id}: ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.target.join(" ")}`).join("\n"),
  );

  expect(summary, `Violaciones de accesibilidad:\n${summary.join("\n")}`).toEqual([]);
}

test.describe("accesibilidad", () => {
  test("la portada no tiene violaciones", async ({ page }) => {
    await page.goto("/");

    await expectNoViolations(page);
  });

  test("el login no tiene violaciones", async ({ page }) => {
    await page.goto("/login");

    await expectNoViolations(page);
  });

  test("el registro no tiene violaciones", async ({ page }) => {
    await page.goto("/register");

    await expectNoViolations(page);
  });

  test("el formulario con errores visibles no tiene violaciones", async ({ page }) => {
    // Los estados de error son donde más se rompe la accesibilidad: se añade
    // texto rojo y se olvida atarlo al campo, así que quien no ve el color no
    // se entera de que hay un problema ni de cuál es.
    await page.goto("/register");
    await page.getByLabel("Correo").fill("no-es-un-correo");
    await page.getByLabel("Contraseña").fill("corta");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // Exacto a propósito: la pista bajo el campo dice lo mismo con punto
    // final, así que sin `exact` el localizador encontraría los dos.
    await expect(page.getByText("Mínimo 12 caracteres", { exact: true })).toBeVisible();
    await expectNoViolations(page);
  });

  test("el chat con mensajes no tiene violaciones", async ({ page }) => {
    await register(page, makeUser("a11y"));
    await sendMessage(page, uniqueText("un mensaje para revisar"));
    await expect(messageLog(page).getByRole("listitem").last()).toBeVisible();

    await expectNoViolations(page);
  });

  test("el chat con un error visible no tiene violaciones", async ({ page }) => {
    await register(page, makeUser("a11y-error"));
    await composer(page).fill("x".repeat(2100));

    await expect(alertIn(page)).toBeVisible();
    await expectNoViolations(page);
  });
});

test.describe("navegación por teclado", () => {
  test("el enlace de salto es lo primero que recibe foco", async ({ page }) => {
    // Sin él, quien navega con teclado tiene que atravesar la navegación
    // entera en cada página antes de llegar al contenido.
    await page.goto("/");
    await page.keyboard.press("Tab");

    await expect(page.getByRole("link", { name: /saltar al contenido/i })).toBeFocused();
  });

  test("se puede escribir y enviar un mensaje sin tocar el ratón", async ({ page }) => {
    await register(page, makeUser("teclado-chat"));

    const text = uniqueText("enviado sólo con teclado");

    await composer(page).focus();
    await page.keyboard.type(text);
    await page.keyboard.press("Enter");

    await expect(messageLog(page).getByText(text)).toBeVisible();
  });

  test("el foco vuelve al campo tras enviar", async ({ page }) => {
    // Perderlo obliga a tabular de vuelta para cada mensaje, lo que hace el
    // chat inutilizable sin ratón.
    await register(page, makeUser("foco"));

    await composer(page).focus();
    await page.keyboard.type(uniqueText("hola"));
    await page.keyboard.press("Enter");

    await expect(composer(page)).toBeFocused();
  });

  test("se puede cambiar de sala con el teclado", async ({ page }) => {
    await register(page, makeUser("salas"));

    const frontend = page.getByRole("button", { name: "Frontend" });
    await frontend.focus();
    await page.keyboard.press("Enter");

    await expect(frontend).toHaveAttribute("aria-current", "true");
  });
});

/**
 * Los paneles móviles.
 *
 * Se abren con `showModal()`, así que la trampa de foco la pone el navegador.
 * Estos tests comprueban que sigue puesta: la versión anterior declaraba
 * `aria-modal="true"` con un `div`, y con Tab se recorría la lista de salas y
 * la caja de escritura que estaban tapadas por el velo.
 */
test.describe("paneles móviles", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /**
   * Qué tiene el foco, si está fuera del diálogo.
   *
   * Devuelve `null` cuando el foco está dentro y también cuando está en
   * `<body>`: al cerrar el ciclo, Chromium deja el foco ahí un instante antes
   * de volver al primer elemento. No es un destino en el que se pueda hacer
   * nada, sólo el punto de retorno — lo que importa es que ningún control de
   * detrás del velo llegue a recibirlo.
   */
  const escapedTo = (page: Page) =>
    page.evaluate(() => {
      const active = document.activeElement;

      if (!active || active === document.body || active.closest("dialog")) {
        return null;
      }

      return `${active.tagName} «${active.textContent?.trim().slice(0, 30)}»`;
    });

  test("el cajón de salas retiene el foco", async ({ page }) => {
    await register(page, makeUser("cajon"));

    await page.getByRole("button", { name: /Salas\. Estás en/ }).click();
    await expect(page.getByRole("dialog", { name: "Salas" })).toBeVisible();

    // Diez tabulaciones dan dos vueltas largas al cajón, que tiene cuatro
    // paradas. Sin trampa de foco se llegaría a la lista de salas de detrás,
    // a la caja de escritura y al botón de salir.
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press("Tab");
      expect(await escapedTo(page)).toBeNull();
    }
  });

  test("Escape cierra y devuelve el foco a quien abrió", async ({ page }) => {
    await register(page, makeUser("escape"));

    const opener = page.getByRole("button", { name: /Salas\. Estás en/ });
    await opener.click();
    await expect(page.getByRole("dialog", { name: "Salas" })).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog", { name: "Salas" })).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("la hoja de presencia se abre desde el recuento", async ({ page }) => {
    await register(page, makeUser("hoja"));

    await page.getByRole("button", { name: "Ver quién está en la sala" }).click();

    const sheet = page.getByRole("dialog", { name: "En la sala" });

    await expect(sheet).toBeVisible();
    // La región tiene que ser la de la hoja, no la de la columna oculta.
    await expect(sheet.getByRole("region", { name: /presencia/i })).toBeVisible();
  });

  test("el chat en móvil no tiene violaciones", async ({ page }) => {
    await register(page, makeUser("movil"));
    await sendMessage(page, uniqueText("un mensaje en móvil"));
    await expect(messageLog(page).getByRole("listitem").last()).toBeVisible();

    await expectNoViolations(page);
  });

  test("el cajón abierto no tiene violaciones", async ({ page }) => {
    await register(page, makeUser("cajon-axe"));
    await page.getByRole("button", { name: /Salas\. Estás en/ }).click();
    await expect(page.getByRole("dialog", { name: "Salas" })).toBeVisible();

    await expectNoViolations(page);
  });
});
