import { Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { createRoomSchema } from "@relay/shared";
import type { CreateRoomInput, Room } from "@relay/shared";

import { Public } from "../auth/public.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { RoomsService } from "./rooms.service";

/**
 * `@Controller("rooms")` fija el prefijo: todo aquí cuelga de `/rooms`.
 *
 * Nada de esto se descubre por la ruta del archivo. Este controlador existe
 * porque `RoomsModule` lo declara en su array `controllers`. Si lo quitas de
 * ahí, las rutas devuelven 404 aunque el archivo siga en su sitio.
 */
@Controller("rooms")
export class RoomsController {
  /**
   * Aquí está la inyección de dependencias: se pide `RoomsService` en el
   * constructor y Nest lo entrega ya construido. En ningún punto del código
   * aparece `new RoomsService()`.
   *
   * El pago llega en el test: se sustituye por un doble sin tocar este archivo.
   */
  constructor(private readonly rooms: RoomsService) {}

  /** GET /rooms — abierto: el listado de salas no es secreto. */
  @Public()
  @Get()
  list(): Promise<Room[]> {
    // Devolver la promesa sin await es deliberado: Nest la resuelve por su
    // cuenta antes de serializar. Un `async` aquí sólo añadiría un tick.
    return this.rooms.findAll();
  }

  /** GET /rooms/:slug */
  @Public()
  @Get(":slug")
  async bySlug(@Param("slug") slug: string): Promise<Room> {
    const room = await this.rooms.findBySlug(slug);

    if (!room) {
      throw new NotFoundException(`No existe la sala "${slug}"`);
    }

    return room;
  }

  /**
   * POST /rooms
   *
   * El pipe corre antes que el cuerpo del método: si el payload no pasa el
   * esquema, este código nunca se ejecuta y el cliente recibe un 400. Por eso
   * `input` puede tratarse como válido sin comprobar nada.
   */
  @Post()
  create(@Body(new ZodValidationPipe(createRoomSchema)) input: CreateRoomInput): Promise<Room> {
    return this.rooms.create(input);
  }
}
