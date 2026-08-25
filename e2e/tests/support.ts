import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Utilidades compartidas por los E2E.
 *
 * La regla de fondo: todo se localiza por rol y nombre accesible, nunca por
 * clase de CSS ni por `data-testid`. Un test que encuentra el botón como
 * `getByRole("button", { name: "Enviar" })` falla si alguien le quita la
 * etiqueta — que es justo cuando debe fallar, porque en ese momento el botón
 * dejó de ser usable con lector de pantalla.
 */

export interface TestUser {
  email: string;
  displayName: string;
  password: string;
}

/** Datos únicos por test, para que puedan correr en paralelo sin pisarse. */
export function makeUser(prefix: string): TestUser {
  const id = crypto.randomUUID().slice(0, 8);

  return {
    email: `${prefix}-${id}@e2e.test`,
    displayName: `${prefix}-${id}`,
    password: "contrasena-larga-e2e",
  };
}

/**
 * Texto de mensaje único.
 *
 * Los mensajes quedan guardados en la sala, y el historial se los sirve a la
 * ejecución siguiente. Con un texto fijo, la segunda corrida encuentra dos
 * coincidencias y el localizador falla por ambigüedad — un test que sólo pasa
 * la primera vez, que es peor que uno que no pasa nunca.
 */
export function uniqueText(label: string): string {
  return `${label} [${crypto.randomUUID().slice(0, 8)}]`;
}

export async function register(page: Page, user: TestUser): Promise<void> {
  await page.goto("/register");

  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Nombre").fill(user.displayName);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/\/chat$/);
  await waitUntilConnected(page);
}

export async function login(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");

  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/chat$/);
  await waitUntilConnected(page);
}

/**
 * Espera a que el socket esté conectado.
 *
 * Sin esto los tests son inestables: la página aparece antes que la conexión,
 * y un mensaje enviado en ese hueco se pierde. La señal la da la propia
 * interfaz, que ya muestra el estado a quien la usa.
 */
export async function waitUntilConnected(page: Page): Promise<void> {
  await expect(page.getByText("En línea")).toBeVisible({ timeout: 15_000 });
}

/** El registro de mensajes, que es el `role="log"` con aria-live. */
export const messageLog = (page: Page) => page.getByRole("log", { name: "Mensajes" });

export const composer = (page: Page) => page.getByLabel("Escribe un mensaje");

export async function sendMessage(page: Page, body: string): Promise<void> {
  await composer(page).fill(body);
  await composer(page).press("Enter");
}

/**
 * La lista de presencia lateral.
 *
 * En escritorio es la columna derecha; por debajo de `lg` esa columna se oculta
 * y la lista vive en la hoja que abre el recuento de la cabecera. El nombre de
 * la región es el mismo en los dos sitios.
 */
export const presence = (page: Page) => page.getByRole("region", { name: /presencia/i });

/**
 * El aviso de error del contenido, acotado a `main`.
 *
 * Next inserta su propio `<div role="alert" id="__next-route-announcer__">`
 * para anunciar los cambios de ruta a los lectores de pantalla, así que un
 * `getByRole("alert")` a secas encuentra dos elementos y Playwright falla por
 * ambigüedad. Acotarlo al contenido deja fuera al anunciador del framework.
 */
export const alertIn = (page: Page) => page.getByRole("main").getByRole("alert");

/**
 * Cierra la sesión y espera a que termine de verdad.
 *
 * Salir dejó de ser instantáneo: ahora es un server action que avisa al API
 * para invalidar el refresh token y borra las cookies, y sólo después navega.
 * Un test que pulse y navegue en la línea siguiente lo hace con las cookies
 * todavía puestas, y el proxy lo devuelve al chat — que es justo lo que debe
 * hacer con una sesión abierta.
 *
 * Esperar a `/login` es esperar al efecto observable, no a un tiempo fijo.
 */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Salir" }).click();
  await page.waitForURL("**/login");
}
