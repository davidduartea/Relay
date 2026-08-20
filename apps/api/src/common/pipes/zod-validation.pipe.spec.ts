import { BadRequestException } from "@nestjs/common";
import { sendMessageSchema } from "@relay/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ZodValidationPipe } from "./zod-validation.pipe";

const VALID = {
  roomId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  body: "hola",
  clientId: "9c858901-8a57-4791-81fe-4c455b099bc9",
};

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe(sendMessageSchema);

  it("deja pasar un payload válido", () => {
    expect(pipe.transform(VALID)).toEqual(VALID);
  });

  it("aplica las transformaciones del esquema, no sólo valida", () => {
    // El esquema declara .trim(); el handler debe recibir el valor ya limpio
    // para no tener que volver a normalizarlo.
    const result = pipe.transform({ ...VALID, body: "  hola  " });

    expect(result.body).toBe("hola");
  });

  it("rechaza el payload inválido con 400", () => {
    expect(() => pipe.transform({ ...VALID, body: "" })).toThrow(BadRequestException);
  });

  it("reporta todos los campos que fallaron, no sólo el primero", () => {
    let thrown: BadRequestException | undefined;

    try {
      pipe.transform({ roomId: "no-es-uuid", body: "", clientId: "tampoco" });
    } catch (error) {
      thrown = error as BadRequestException;
    }

    const response = thrown?.getResponse() as { errors: { field: string }[] };
    const fields = response.errors.map((e) => e.field);

    expect(fields).toEqual(expect.arrayContaining(["roomId", "body", "clientId"]));
  });

  it("etiqueta como (raíz) el fallo que no apunta a un campo", () => {
    const rootPipe = new ZodValidationPipe(z.string());

    let thrown: BadRequestException | undefined;
    try {
      rootPipe.transform(42);
    } catch (error) {
      thrown = error as BadRequestException;
    }

    const response = thrown?.getResponse() as { errors: { field: string }[] };

    expect(response.errors[0]?.field).toBe("(raíz)");
  });
});
