import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Alert } from "./alert";

describe("Alert", () => {
  it("se anuncia en cuanto aparece", () => {
    render(<Alert>Correo o contraseña incorrectos</Alert>);

    expect(screen.getByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos");
  });

  it("es enfocable por código sin entrar en el orden de tabulación", () => {
    // Hace falta para llevarle el foco al aparecer: `role="alert"` consigue
    // que se lea, pero quien navega con teclado seguiría donde estaba.
    render(<Alert>Algo salió mal.</Alert>);

    expect(screen.getByRole("alert")).toHaveAttribute("tabindex", "-1");
  });

  it("sin onDismiss no lleva botón de cerrar", () => {
    // El aviso del formulario no debe poder descartarse: describe algo que
    // sigue sin resolverse.
    render(<Alert>Ese correo ya está registrado</Alert>);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("con onDismiss ofrece cerrar y avisa al pulsarlo", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();

    render(<Alert onDismiss={onDismiss}>No se pudo enviar el mensaje</Alert>);
    await user.click(screen.getByRole("button", { name: "Cerrar el aviso" }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("añade el detalle como segunda línea", () => {
    render(<Alert detail="Espera un minuto y vuelve a probar.">Demasiados intentos</Alert>);

    expect(screen.getByText("Espera un minuto y vuelve a probar.")).toBeInTheDocument();
  });

  it("cambia el glifo con el tono, para no depender del color", () => {
    const { rerender } = render(<Alert tone="error">Falló</Alert>);

    expect(screen.getByText("⚠")).toBeInTheDocument();

    rerender(<Alert tone="neutral">No se pudo conectar.</Alert>);

    expect(screen.getByText("◌")).toBeInTheDocument();
  });
});
