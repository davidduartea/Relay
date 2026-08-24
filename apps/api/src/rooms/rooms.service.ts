import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateRoomInput, Room } from "@relay/shared";

import { PrismaService } from "../prisma/prisma.service";

/** Código de Prisma para violación de restricción única. */
const UNIQUE_VIOLATION = "P2002";

/**
 * Las salas del chat, ahora sobre Postgres.
 *
 * El `Map` en memoria de la versión anterior desapareció y `RoomsController`
 * no cambió ni una línea: depende de esta clase, no de dónde guarda los datos.
 * Ese es el retorno concreto de la inyección de dependencias.
 */
@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Room[]> {
    return this.prisma.room.findMany({
      select: SHAPE,
      orderBy: { createdAt: "asc" },
    });
  }

  async findBySlug(slug: string): Promise<Room | undefined> {
    const room = await this.prisma.room.findUnique({ where: { slug }, select: SHAPE });

    // Prisma devuelve null y el contrato de @relay/shared usa undefined.
    // La traducción vive aquí para que el resto del código no tenga que
    // acordarse de cuál de los dos vacíos le toca comprobar.
    return room ?? undefined;
  }

  /**
   * Comprobación barata de existencia para el gateway.
   *
   * Cuenta en vez de traer la fila: al entrar a una sala sólo interesa si
   * existe, y traer nombre y slug para tirarlos es trabajo que la base hace
   * en cada join.
   */
  async existsById(id: string): Promise<boolean> {
    return (await this.prisma.room.count({ where: { id } })) > 0;
  }

  async create(input: CreateRoomInput): Promise<Room> {
    try {
      return await this.prisma.room.create({ data: input, select: SHAPE });
    } catch (error) {
      // Se comprueba después de intentar en vez de consultar antes de crear:
      // un `findUnique` previo deja una ventana entre la comprobación y el
      // insert en la que otra petición puede colarse con el mismo slug. La
      // restricción única de la base no tiene esa ventana.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException(`Ya existe una sala con el slug "${input.slug}"`);
      }

      throw error;
    }
  }
}

/**
 * Columnas que salen del servicio.
 *
 * Se listan en vez de devolver la fila entera para que una columna nueva no se
 * filtre sola a la API. El día que `Room` tenga un campo interno, hay que
 * añadirlo aquí a conciencia para exponerlo.
 */
const SHAPE = { id: true, slug: true, name: true } satisfies Prisma.RoomSelect;
