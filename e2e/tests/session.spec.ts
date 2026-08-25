import { expect, test } from "@playwright/test";

import { makeUser, register, signOut } from "./support";

/**
 * Dónde vive la sesión, comprobado desde el navegador.
 *
 * Son las garantías que justifican el cambio a cookies httpOnly. Un test que
 * sólo mire que «se puede entrar» pasaría igual guardando el token en
 * `localStorage`, que es exactamente lo que se quiso dejar atrás.
 */
test.describe("la sesión no llega al JavaScript", () => {
  test("no queda nada en localStorage ni en sessionStorage", async ({ page }) => {
    await register(page, makeUser("almacen"));

    const stored = await page.evaluate(() => ({
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
    }));

    expect(stored.local).toEqual([]);
    expect(stored.session).toEqual([]);
  });

  test("document.cookie no ve las cookies de sesión", async ({ page }) => {
    // Es la definición práctica de httpOnly: el navegador las manda en cada
    // petición y no se las enseña al script.
    await register(page, makeUser("httponly"));

    const visible = await page.evaluate(() => document.cookie);

    expect(visible).not.toContain("relay_access");
    expect(visible).not.toContain("relay_refresh");
  });

  test("las cookies existen y están marcadas httpOnly", async ({ page }) => {
    await register(page, makeUser("banderas"));

    const cookies = await page.context().cookies();
    const session = cookies.filter((c) => c.name.startsWith("relay_"));

    expect(session.map((c) => c.name).sort()).toEqual(["relay_access", "relay_refresh"]);

    for (const cookie of session) {
      expect(cookie.httpOnly, `${cookie.name} debe ser httpOnly`).toBe(true);
      expect(cookie.sameSite, `${cookie.name} debe ser Lax`).toBe("Lax");
    }
  });

  test("el ticket del socket no se guarda en ningún sitio", async ({ page }) => {
    // Es lo único de la sesión que toca el JavaScript. Vive 60 segundos y un
    // solo uso, así que dejarlo guardado sería tirar esa garantía.
    await register(page, makeUser("ticket"));

    const stored = await page.evaluate(() =>
      JSON.stringify([
        Object.entries(localStorage),
        Object.entries(sessionStorage),
        document.cookie,
      ]),
    );

    expect(stored).not.toMatch(/eyJ/); // ningún JWT, empiecen por donde empiecen
  });

  test("salir borra las cookies del navegador", async ({ page }) => {
    await register(page, makeUser("borrado"));
    await signOut(page);

    const cookies = await page.context().cookies();

    expect(cookies.filter((c) => c.name.startsWith("relay_"))).toEqual([]);
  });
});

/**
 * El origen del backend no viaja en el JavaScript.
 *
 * Es lo que se ganó al quitarle el prefijo `NEXT_PUBLIC_` a la variable. Antes
 * bastaba con descargar un chunk para saber contra qué API habla la
 * aplicación, sin tener cuenta ni haber entrado.
 */
test.describe("el backend no se anuncia al visitante", () => {
  test("ningún chunk servido a un anónimo contiene la dirección del API", async ({
    page,
    request,
  }) => {
    await page.goto("/login");

    const sources = await page
      .locator("script[src]")
      .evaluateAll((tags) => tags.map((t) => (t as HTMLScriptElement).src));

    expect(sources.length, "la página debería cargar algún script").toBeGreaterThan(0);

    for (const src of sources) {
      const body = await (await request.get(src)).text();

      expect(body, `${src} filtra la dirección del API`).not.toContain("localhost:4000");
    }
  });

  test("el HTML de una página pública tampoco la lleva", async ({ page }) => {
    await page.goto("/login");

    expect(await page.content()).not.toContain("localhost:4000");
  });
});
