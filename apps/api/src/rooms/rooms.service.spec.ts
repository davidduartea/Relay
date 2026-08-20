import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { RoomsService } from "./rooms.service";

describe("RoomsService", () => {
  let service: RoomsService;

  beforeEach(async () => {
    // Instancia nueva en cada test: el servicio es singleton en producción,
    // así que si se compartiera entre tests el estado de uno contaminaría al
    // siguiente y el orden de ejecución empezaría a importar.
    const moduleRef = await Test.createTestingModule({
      providers: [RoomsService],
    }).compile();

    service = moduleRef.get(RoomsService);
  });

  it("arranca con la sala general", () => {
    const rooms = service.findAll();

    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.slug).toBe("general");
  });

  it("crea una sala y le asigna un id", () => {
    const room = service.create({ name: "Frontend", slug: "frontend" });

    expect(room.id).toEqual(expect.any(String));
    expect(room.slug).toBe("frontend");
    expect(service.findAll()).toHaveLength(2);
  });

  it("encuentra por slug lo que acaba de crear", () => {
    service.create({ name: "Frontend", slug: "frontend" });

    expect(service.findBySlug("frontend")?.name).toBe("Frontend");
  });

  it("devuelve undefined cuando el slug no existe", () => {
    expect(service.findBySlug("fantasma")).toBeUndefined();
  });

  it("rechaza un slug repetido con 409", () => {
    expect(() => service.create({ name: "Otra general", slug: "general" })).toThrow(
      ConflictException,
    );
  });
});
