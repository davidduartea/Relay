import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { MessagesService } from "./messages.service";

const ROOM_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const CLIENT_ID = "9c858901-8a57-4791-81fe-4c455b099bc9";

const row = (id: string, body: string) => ({
  id,
  roomId: ROOM_ID,
  body,
  clientId: CLIENT_ID,
  createdAt: new Date("2026-08-20T10:00:00.000Z"),
  author: { id: "user-ana", displayName: "Ana" },
});

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6",
  });

describe("MessagesService", () => {
  const message = { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() };

  let service: MessagesService;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [MessagesService, PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue({ message })
      .compile();

    service = moduleRef.get(MessagesService);
  });

  describe("history", () => {
    it("pide los más recientes a la base pero los devuelve en orden de lectura", async () => {
      // La consulta baja por fecha — es la que aprovecha el índice — y el
      // servicio invierte. Si esto se rompiera, el chat saldría del revés.
      message.findMany.mockResolvedValue([row("m3", "tercero"), row("m1", "primero")]);

      const history = await service.history(ROOM_ID);

      expect(message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } }),
      );
      expect(history.map((m) => m.id)).toEqual(["m1", "m3"]);
    });

    it("aplana el autor al contrato compartido", async () => {
      message.findMany.mockResolvedValue([row("m1", "hola")]);

      const [first] = await service.history(ROOM_ID);

      expect(first).toMatchObject({ authorId: "user-ana", authorName: "Ana" });
      expect(first).not.toHaveProperty("author");
    });

    it("serializa la fecha a ISO, no la deja como Date", async () => {
      // El contrato declara `createdAt: string`. Dejar que la conversión
      // ocurra sola en JSON.stringify hace que el tipo mienta en cuanto
      // alguien use el valor antes de mandarlo.
      message.findMany.mockResolvedValue([row("m1", "hola")]);

      const [first] = await service.history(ROOM_ID);

      expect(first?.createdAt).toBe("2026-08-20T10:00:00.000Z");
    });
  });

  describe("create", () => {
    it("guarda el mensaje", async () => {
      message.create.mockResolvedValue(row("m1", "hola"));

      const saved = await service.create({
        roomId: ROOM_ID,
        authorId: "user-ana",
        body: "hola",
        clientId: CLIENT_ID,
      });

      expect(saved.id).toBe("m1");
    });

    it("devuelve el existente cuando el cliente reintenta el mismo envío", async () => {
      // Un reintento tras reconectar choca con la restricción única. Devolver
      // el que ya está hace el reintento transparente; sin esto el usuario
      // vería su mensaje dos veces.
      message.create.mockRejectedValue(uniqueViolation());
      message.findUnique.mockResolvedValue(row("m1", "hola"));

      const saved = await service.create({
        roomId: ROOM_ID,
        authorId: "user-ana",
        body: "hola",
        clientId: CLIENT_ID,
      });

      expect(saved.id).toBe("m1");
      expect(message.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId_clientId: { roomId: ROOM_ID, clientId: CLIENT_ID } },
        }),
      );
    });

    it("deja pasar cualquier otro error sin disfrazarlo", async () => {
      message.create.mockRejectedValue(new Error("connection refused"));

      await expect(
        service.create({ roomId: ROOM_ID, authorId: "user-ana", body: "hola", clientId: CLIENT_ID }),
      ).rejects.toThrow("connection refused");
    });
  });
});
