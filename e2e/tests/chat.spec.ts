import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

import {
  composer,
  makeUser,
  messageLog,
  presence,
  register,
  sendMessage,
  uniqueText,
  waitUntilConnected,
} from "./support";

/**
 * Chat en tiempo real entre dos personas.
 *
 * Cada usuario vive en su propio `BrowserContext`, que es un perfil aislado:
 * cookies, localStorage y sesión propios. Dos pestañas del mismo contexto
 * compartirían localStorage y la segunda sesión pisaría a la primera — que es
 * exactamente lo que pasa al probarlo a mano en el mismo navegador.
 *
 * Esto es lo que ningún test unitario alcanza: dos clientes reales, un
 * servidor real, una base de datos real y un WebSocket entre medias.
 */
async function openAs(browser: Browser, prefix: string): Promise<{ page: Page; name: string }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const user = makeUser(prefix);

  await register(page, user);

  return { page, name: user.displayName };
}

test.describe("chat entre dos personas", () => {
  test("un mensaje llega al otro navegador sin recargar", async ({ browser }) => {
    const { page: ana } = await openAs(browser, "ana");
    const { page: benito } = await openAs(browser, "benito");

    const text = uniqueText("hola desde el otro navegador");

    await sendMessage(ana, text);

    await expect(messageLog(benito).getByText(text)).toBeVisible();
  });

  test("la conversación fluye en las dos direcciones", async ({ browser }) => {
    const { page: ana } = await openAs(browser, "ana");
    const { page: benito } = await openAs(browser, "benito");

    const pregunta = uniqueText("¿me lees?");
    const respuesta = uniqueText("alto y claro");

    await sendMessage(ana, pregunta);
    await expect(messageLog(benito).getByText(pregunta)).toBeVisible();

    await sendMessage(benito, respuesta);
    await expect(messageLog(ana).getByText(respuesta)).toBeVisible();
  });

  test("quien escribe ve su mensaje una sola vez", async ({ browser }) => {
    // El servidor devuelve el mensaje a TODOS, incluido el autor. Si el
    // cliente no reconciliara su copia optimista por clientId, aparecería
    // duplicado — y sólo se nota mirando la pantalla de quien escribió.
    const { page: ana } = await openAs(browser, "ana");

    const text = uniqueText("un mensaje único");

    await sendMessage(ana, text);

    await expect(messageLog(ana).getByText(text)).toHaveCount(1);
  });

  // Todos los tests entran a la misma sala "General" y corren en paralelo, así
  // que el número de gente presente es impredecible. Las aserciones van sobre
  // el usuario concreto — su nombre es único por test — y no sobre el total.
  test("el otro aparece en la lista de presencia", async ({ browser }) => {
    const { page: ana } = await openAs(browser, "ana");
    const { name: benitoName } = await openAs(browser, "benito");

    await expect(presence(ana).getByText(benitoName)).toBeVisible();
  });

  test("al cerrar una ventana, la otra lo ve salir", async ({ browser }) => {
    const { page: ana } = await openAs(browser, "ana");
    const { page: benito, name: benitoName } = await openAs(browser, "benito");

    await expect(presence(ana).getByText(benitoName)).toBeVisible();

    await benito.context().close();

    await expect(presence(ana).getByText(benitoName)).toBeHidden();
  });

  test("el indicador de escritura aparece y se apaga solo", async ({ browser }) => {
    const { page: ana } = await openAs(browser, "ana");
    const { page: benito } = await openAs(browser, "benito");

    await composer(ana).fill("escribiendo algo largo");

    await expect(benito.getByText(/está escribiendo/i)).toBeVisible();

    // Se apaga por su cuenta: si el otro cierra la pestaña a media frase, el
    // "escribiendo…" no puede quedarse colgado esperando un evento de fin.
    await expect(benito.getByText(/está escribiendo/i)).toBeHidden({ timeout: 10_000 });
  });

  test("el historial sobrevive a una recarga", async ({ browser }) => {
    // REGRESIÓN: el socket vivía en una ref y el efecto de listeners corría
    // una sola vez, antes de que llegara el token desde localStorage. Al
    // recargar, el chat salía vacío para siempre — y recargar es como se abre
    // la página casi siempre.
    const { page: ana } = await openAs(browser, "ana");

    const text = uniqueText("esto tiene que seguir aquí");

    await sendMessage(ana, text);
    await expect(messageLog(ana).getByText(text)).toBeVisible();

    await ana.reload();
    await waitUntilConnected(ana);

    await expect(messageLog(ana).getByText(text)).toBeVisible();
  });

  test("quien llega después recibe lo que ya se dijo", async ({ browser }) => {
    const { page: ana } = await openAs(browser, "ana");
    const text = uniqueText("dicho antes de que llegaras");
    await sendMessage(ana, text);

    const { page: cris } = await openAs(browser, "cris");

    await expect(messageLog(cris).getByText(text)).toBeVisible();
  });
});
