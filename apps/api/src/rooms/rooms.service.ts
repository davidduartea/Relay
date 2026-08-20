import { randomUUID } from "node:crypto";

import { ConflictException, Injectable } from "@nestjs/common";
import type { CreateRoomInput, Room } from "@relay/shared";

/**
 * Las salas del chat.
 *
 * `@Injectable()` marca la clase como algo que el contenedor de Nest puede
 * construir e inyectar. No la instancias tú en ningún lado: la declaras en el
 * array `providers` de un módulo y Nest la pasa por constructor a quien la pida.
 *
 * Por defecto es singleton — una sola instancia para toda la aplicación — que
 * es la razón por la que un `Map` en memoria funciona aquí. En la fase 1 el
 * Map se cambia por Prisma y el controlador no se entera, porque depende de
 * esta clase y no de cómo guarda los datos.
 */
@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, Room>();

  constructor() {
    // Una sala inicial para que `GET /rooms` no salga vacío la primera vez.
    this.seed({ name: "General", slug: "general" });
  }

  findAll(): Room[] {
    return [...this.rooms.values()];
  }

  findBySlug(slug: string): Room | undefined {
    return this.rooms.get(slug);
  }

  create(input: CreateRoomInput): Room {
    if (this.rooms.has(input.slug)) {
      // Lanzar una excepción de Nest evita tener que devolver un objeto de
      // error y que cada handler decida el status: el filtro de excepciones la
      // convierte en 409 con el cuerpo JSON correcto.
      throw new ConflictException(`Ya existe una sala con el slug "${input.slug}"`);
    }

    return this.seed(input);
  }

  private seed(input: CreateRoomInput): Room {
    const room: Room = { id: randomUUID(), name: input.name, slug: input.slug };
    this.rooms.set(room.slug, room);

    return room;
  }
}
