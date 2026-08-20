import { BadRequestException, Injectable } from "@nestjs/common";
import type { PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

export interface ValidationFailure {
  /** Ruta al campo que falló, en notación de puntos: `user.email`. */
  field: string;
  message: string;
}

/**
 * Valida el payload contra un esquema de Zod antes de que llegue al handler.
 *
 * Nest trae un `ValidationPipe` propio, pero exige class-validator: las reglas
 * se declaran como decoradores sobre clases DTO. Eso obligaría a escribir las
 * mismas reglas dos veces — una para el servidor y otra para el formulario —
 * y a que se desincronicen con el tiempo.
 *
 * Con este pipe el esquema de `@relay/shared` es la única definición: el mismo
 * objeto valida en el servidor y en el cliente.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      // Se devuelven todos los errores, no sólo el primero: un formulario que
      // sólo puede mostrar un fallo a la vez obliga al usuario a enviar,
      // corregir y reenviar tantas veces como campos malos tenga.
      throw new BadRequestException({
        message: "La petición no pasó la validación",
        errors: toFailures(result.error.issues),
      });
    }

    return result.data;
  }
}

function toFailures(issues: readonly { path: PropertyKey[]; message: string }[]) {
  return issues.map<ValidationFailure>((issue) => ({
    field: issue.path.map(String).join(".") || "(raíz)",
    message: issue.message,
  }));
}
