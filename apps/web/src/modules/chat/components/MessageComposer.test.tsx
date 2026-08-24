import { MESSAGE_MAX_LENGTH } from "@relay/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MessageComposer } from "@/modules/chat/components/MessageComposer";

describe("MessageComposer", () => {
  const onSend = vi.fn<(body: string) => Promise<boolean>>();
  const onTyping = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    onSend.mockResolvedValue(true);
  });

  const setup = (disabled = false) => {
    render(<MessageComposer disabled={disabled} onSend={onSend} onTyping={onTyping} />);

    return {
      user: userEvent.setup(),
      input: screen.getByLabelText(/escribe un mensaje/i),
      button: screen.getByRole("button", { name: /enviar/i }),
    };
  };

  it("etiqueta el campo, sin depender del placeholder", () => {
    // getByLabelText sólo encuentra el campo si hay un <label> de verdad. Un
    // placeholder desaparece al escribir y no sirve como nombre accesible.
    const { input } = setup();

    expect(input).toBeInTheDocument();
  });

  it("no deja enviar vacío ni sólo espacios", async () => {
    const { user, input, button } = setup();

    expect(button).toBeDisabled();

    await user.type(input, "   ");
    expect(button).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("envía con Enter y recorta los espacios", async () => {
    const { user, input } = setup();

    await user.type(input, "  hola  {Enter}");

    expect(onSend).toHaveBeenCalledWith("hola");
  });

  it("Shift+Enter hace salto de línea en vez de enviar", async () => {
    const { user, input } = setup();

    await user.type(input, "primera{Shift>}{Enter}{/Shift}segunda");

    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue("primera\nsegunda");
  });

  it("limpia el campo y le devuelve el foco tras enviar", async () => {
    // Perder el foco al enviar deja varado a quien navega con teclado: tendría
    // que tabular de vuelta al campo para cada mensaje.
    const { user, input } = setup();

    await user.type(input, "hola{Enter}");

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("conserva el texto si el envío falla, para no perder lo escrito", async () => {
    onSend.mockResolvedValue(false);
    const { user, input } = setup();

    await user.type(input, "hola{Enter}");

    expect(input).toHaveValue("hola");
  });

  it("avisa de que se está escribiendo, una sola vez por ráfaga", async () => {
    const { user, input } = setup();

    await user.type(input, "hola");

    expect(onTyping).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("anuncia el exceso de longitud y ata el error al campo", async () => {
    const { user, input } = setup();

    await user.click(input);
    await user.paste("x".repeat(MESSAGE_MAX_LENGTH + 5));

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent(/no puede pasar de 2000 caracteres/i);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", alert.id);
  });

  it("enseña el contador sólo cerca del límite", async () => {
    // Un contador permanente en un chat es ruido: la mayoría de los mensajes
    // no se acercan ni de lejos a los 2000 caracteres.
    const { user, input } = setup();

    await user.click(input);
    await user.paste("x".repeat(100));

    expect(screen.queryByText(/\/2000/)).not.toBeInTheDocument();

    await user.paste("x".repeat(MESSAGE_MAX_LENGTH));

    expect(screen.getByText(/\/2000/)).toBeInTheDocument();
  });

  it("se desactiva mientras no hay conexión", () => {
    const { input, button } = setup(true);

    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
  });
});
