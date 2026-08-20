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
 * El controlador se prueba con un `RoomsService` falso, y para lograrlo no hay
 * que parchear imports ni módulos: se le dice al contenedor "cuando alguien
 * pida RoomsService, entrega esto". El código de producción no cambia ni sabe
 * que está en un test.
 */
describe("RoomsController", () => {
  const service = {
    findAll: vi.fn<() => Room[]>(),
    findBySlug: vi.fn<(slug: string) => Room | undefined>(),
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

  it("devuelve la lista que da el servicio", () => {
    service.findAll.mockReturnValue([ROOM]);

    expect(controller.list()).toEqual([ROOM]);
  });

  it("busca por slug y devuelve la sala encontrada", () => {
    service.findBySlug.mockReturnValue(ROOM);

    expect(controller.bySlug("general")).toEqual(ROOM);
    expect(service.findBySlug).toHaveBeenCalledWith("general");
  });

  it("lanza 404 cuando el slug no existe", () => {
    service.findBySlug.mockReturnValue(undefined);

    expect(() => controller.bySlug("fantasma")).toThrow(NotFoundException);
  });

  it("delega la creación en el servicio", () => {
    const input = { name: "Frontend", slug: "frontend" };
    service.create.mockReturnValue({ ...ROOM, ...input });

    controller.create(input);

    expect(service.create).toHaveBeenCalledWith(input);
  });
});
