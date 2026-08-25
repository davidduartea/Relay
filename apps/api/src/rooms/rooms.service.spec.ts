import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { RoomsService } from "./rooms.service";

const ROW = { id: "room-1", slug: "general", name: "General" };

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6",
  });

/**
 * El servicio se prueba contra un doble de `PrismaService`, no contra una base
 * real. Estos son tests unitarios: verifican la lógica que vive en esta clase
 * — la traducción de null a undefined y el mapeo de P2002 a un 409 — sin pagar
 * el coste de levantar Postgres.
 *
 * Que las consultas de verdad devuelven lo esperado es trabajo de los tests de
 * integración de la fase 2, que sí usan una base.
 */
describe("RoomsService", () => {
  const room = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  };

  let service: RoomsService;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [RoomsService, PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue({ room })
      .compile();

    service = moduleRef.get(RoomsService);
  });

  it("lista las salas por fecha de creación ascendente", async () => {
    room.findMany.mockResolvedValue([ROW]);

    await expect(service.findAll()).resolves.toEqual([ROW]);
    expect(room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" } }),
    );
  });

  it("encuentra una sala por slug", async () => {
    room.findUnique.mockResolvedValue(ROW);

    await expect(service.findBySlug("general")).resolves.toEqual(ROW);
  });

  it("traduce el null de Prisma a undefined", async () => {
    // El contrato de @relay/shared usa undefined para 'no existe'. Si esta
    // traducción se pierde, el `if (!room)` del controlador sigue funcionando
    // por casualidad, pero cualquier comparación estricta deja de hacerlo.
    room.findUnique.mockResolvedValue(null);

    await expect(service.findBySlug("fantasma")).resolves.toBeUndefined();
  });

  it("crea una sala", async () => {
    const input = { name: "Frontend", slug: "frontend" };
    room.create.mockResolvedValue({ ...ROW, ...input });

    await expect(service.create(input)).resolves.toMatchObject(input);
  });

  it("convierte la violación de unicidad en 409", async () => {
    room.create.mockRejectedValue(uniqueViolation());

    await expect(service.create({ name: "Otra", slug: "general" })).rejects.toThrow(
      ConflictException,
    );
  });

  it("deja pasar cualquier otro error sin disfrazarlo", async () => {
    // Un fallo de conexión no es un conflicto de datos. Convertirlo en 409
    // le diría al cliente que reintente con otro slug cuando el problema es
    // que la base no responde.
    room.create.mockRejectedValue(new Error("connection refused"));

    await expect(service.create({ name: "X", slug: "x" })).rejects.toThrow(
      "connection refused",
    );
  });
});
