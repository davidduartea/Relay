import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import type { Room } from "@relay/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";

const ROOM: Room = { id: "room-1", name: "General", slug: "general" };

/**
 * Este archivo es el argumento a favor de la inyección de dependencias.
 *
 * El servicio pasó de un Map en memoria a Postgres y aquí lo único que cambió
 * fue `mockReturnValue` por `mockResolvedValue`: el doble tiene que devolver
 * promesas porque ahora la firma es asíncrona. Ni una palabra sobre Prisma,
 * ninguna base de datos levantada, ningún import nuevo.
 *
 * El controlador se prueba con un `RoomsService` falso, y para lograrlo no hay
 * que parchear imports ni módulos: se le dice al contenedor "cuando alguien
 * pida RoomsService, entrega esto". El código de producción no cambia ni sabe
 * que está en un test.
 */
describe("RoomsController", () => {
  const service = {
    findAll: vi.fn(),
    findBySlug: vi.fn(),
    create: vi.fn(),
  };

  let controller: RoomsController;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [RoomsService],
    })
      .overrideProvider(RoomsService)
      .useValue(service)
      .compile();

    controller = moduleRef.get(RoomsController);
  });

  it("devuelve la lista que da el servicio", async () => {
    service.findAll.mockResolvedValue([ROOM]);

    await expect(controller.list()).resolves.toEqual([ROOM]);
  });

  it("busca por slug y devuelve la sala encontrada", async () => {
    service.findBySlug.mockResolvedValue(ROOM);

    await expect(controller.bySlug("general")).resolves.toEqual(ROOM);
    expect(service.findBySlug).toHaveBeenCalledWith("general");
  });

  it("lanza 404 cuando el slug no existe", async () => {
    service.findBySlug.mockResolvedValue(undefined);

    await expect(controller.bySlug("fantasma")).rejects.toThrow(NotFoundException);
  });

  it("delega la creación en el servicio", async () => {
    const input = { name: "Frontend", slug: "frontend" };
    service.create.mockResolvedValue({ ...ROOM, ...input });

    await controller.create(input);

    expect(service.create).toHaveBeenCalledWith(input);
  });
});
