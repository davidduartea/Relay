import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Field } from "@/modules/auth/components/Field";
import { PasswordField } from "@/modules/auth/components/PasswordField";

describe("Field", () => {
  it("ata la etiqueta al campo", () => {
    render(<Field name="email" label="Correo" />);

    expect(screen.getByLabelText("Correo")).toBeInTheDocument();
  });

  it("describe el campo con la pista y con el error, en ese orden", () => {
    // El lector lee etiqueta → pista → error, que es como se entiende qué se
    // pedía y qué falló.
    render(
      <Field
        name="displayName"
        label="Nombre"
        hint="Lo verán los demás."
        error="Falta el nombre"
      />,
    );

    const input = screen.getByLabelText("Nombre");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe("displayName-hint displayName-error");
  });

  it("cuenta lo escrito cuando hay tope", async () => {
    const user = userEvent.setup();

    render(<Field name="displayName" label="Nombre" maxLength={40} />);

    expect(screen.getByText("0/40")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nombre"), "Ana Ruiz");

    expect(screen.getByText("8/40")).toBeInTheDocument();
  });

  it("sin tope no enseña contador", () => {
    render(<Field name="email" label="Correo" />);

    expect(screen.queryByText(/\/\d+/)).not.toBeInTheDocument();
  });
});

describe("PasswordField", () => {
  it("empieza oculta y lo anuncia con aria-pressed", () => {
    render(<PasswordField autoComplete="new-password" />);

    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Ver" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("Ver descubre el texto y cambia su propio nombre", async () => {
    const user = userEvent.setup();

    render(<PasswordField autoComplete="new-password" />);
    await user.click(screen.getByRole("button", { name: "Ver" }));

    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
