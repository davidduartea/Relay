import { expect, test } from "@playwright/test";

import { alertIn, login, makeUser, register, signOut, waitUntilConnected } from "./support";

test.describe("autenticación", () => {
  test("registrarse deja dentro del chat", async ({ page }) => {
    await register(page, makeUser("nuevo"));

    await expect(page.getByRole("heading", { name: "Relay" })).toBeVisible();
  });

  test("la sesión sobrevive a una recarga", async ({ page }) => {
    const user = makeUser("persistente");
    await register(page, user);

    await page.reload();

    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole("banner")).toContainText(user.displayName);
  });

  test("salir invalida la sesión y devuelve al login", async ({ page }) => {
    const user = makeUser("salida");
    await register(page, user);

    await signOut(page);
    await expect(page).toHaveURL(/\/login$/);

    // Volver atrás no debe recuperar la sesión: el token ya no está guardado.
    await page.goto("/chat");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("se puede volver a entrar con las mismas credenciales", async ({ page }) => {
    const user = makeUser("recurrente");
    await register(page, user);
    await signOut(page);
    await expect(page).toHaveURL(/\/login$/);

    await login(page, user);

    await expect(page.getByRole("banner")).toContainText(user.displayName);
  });

  test("el chat exige sesión", async ({ page }) => {
    await page.goto("/chat");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("la contraseña corta se rechaza antes de salir del navegador", async ({ page }) => {
    // La validación usa el mismo esquema de Zod que aplica el servidor, así
    // que el error aparece sin ida y vuelta.
    await page.goto("/register");
    await page.getByLabel("Correo").fill("corto@e2e.test");
    await page.getByLabel("Nombre").fill("Corto");
    await page.getByLabel("Contraseña").fill("corta");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // Exacto a propósito: la pista bajo el campo dice lo mismo con punto
    // final, así que sin `exact` el localizador encontraría los dos.
    await expect(page.getByText("Mínimo 12 caracteres", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("el correo repetido lo rechaza el servidor", async ({ page }) => {
    const user = makeUser("duplicado");
    await register(page, user);
    await signOut(page);

    await page.goto("/register");
    await page.getByLabel("Correo").fill(user.email);
    await page.getByLabel("Nombre").fill("Otro");
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(alertIn(page)).toContainText(/ya está registrado/i);
  });

  test("las credenciales incorrectas dan el mismo mensaje que una cuenta inexistente", async ({
    page,
  }) => {
    // Un mensaje distinto por caso le diría a un atacante qué correos existen.
    const user = makeUser("oraculo");
    await register(page, user);
    await signOut(page);

    await page.goto("/login");
    await page.getByLabel("Correo").fill(user.email);
    await page.getByLabel("Contraseña").fill("equivocada-pero-larga");
    await page.getByRole("button", { name: "Entrar" }).click();
    const wrongPassword = await alertIn(page).textContent();

    await page.goto("/login");
    await page.getByLabel("Correo").fill("nadie-existe@e2e.test");
    await page.getByLabel("Contraseña").fill("equivocada-pero-larga");
    await page.getByRole("button", { name: "Entrar" }).click();
    const noAccount = await alertIn(page).textContent();

    expect(wrongPassword).toBe(noAccount);
  });

  test("se puede completar el registro sólo con el teclado", async ({ page }) => {
    // Nadie que navegue con teclado debería quedarse atascado en el primer
    // formulario de la aplicación.
    const user = makeUser("teclado");
    await page.goto("/register");

    await page.getByLabel("Correo").focus();
    await page.keyboard.type(user.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(user.displayName);
    await page.keyboard.press("Tab");
    await page.keyboard.type(user.password);

    // Ver/Ocultar vive dentro del campo de contraseña, así que es una parada
    // más antes del botón. Se comprueba en vez de saltarla a ciegas: si algún
    // día cambia el orden, el test dice cuál es el paso que se movió.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Ver" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/chat$/);
    await waitUntilConnected(page);
  });
});
