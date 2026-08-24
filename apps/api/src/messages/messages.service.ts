import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Message } from "@relay/shared";

import { PrismaService } from "../prisma/prisma.service";

const UNIQUE_VIOLATION = "P2002";

/** Cuántos mensajes se mandan al entrar a una sala. */
export const HISTORY_PAGE_SIZE = 50;

export interface CreateMessageParams {
  roomId: string;
  authorId: string;
  body: string;
  clientId: string;
}

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Últimos mensajes de una sala, en orden cronológico.
   *
   * La consulta pide los más recientes — que es lo que se quiere ver al
   * entrar — y se invierte en memoria para devolverlos en el orden en que se
   * leen. Ordenar ascendente y quedarse con los últimos obligaría a la base a
   * recorrer la sala entera.
   */
  async history(roomId: string, limit = HISTORY_PAGE_SIZE): Promise<Message[]> {
    const rows = await this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: SHAPE,
    });

    return rows.reverse().map(toMessage);
  }

  /**
   * Guarda un mensaje, tolerando reintentos.
   *
   * Si el cliente reenvía tras una reconexión, la restricción
   * `(roomId, clientId)` rechaza el duplicado y aquí se devuelve el mensaje
   * que ya existía. Para el usuario el reintento es transparente; sin esto
   * vería su mensaje dos veces.
   */
  async create(params: CreateMessageParams): Promise<Message> {
    try {
      const row = await this.prisma.message.create({ data: params, select: SHAPE });

      return toMessage(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        const existing = await this.prisma.message.findUnique({
          where: { roomId_clientId: { roomId: params.roomId, clientId: params.clientId } },
          select: SHAPE,
        });

        if (existing) {
          return toMessage(existing);
        }
      }

      throw error;
    }
  }
}

const SHAPE = {
  id: true,
  roomId: true,
  body: true,
  clientId: true,
  createdAt: true,
  author: { select: { id: true, displayName: true } },
} satisfies Prisma.MessageSelect;

type MessageRow = Prisma.MessageGetPayload<{ select: typeof SHAPE }>;

/**
 * Traduce la fila al contrato compartido.
 *
 * La fecha se serializa a ISO aquí y no se deja a `JSON.stringify`: el
 * contrato declara `createdAt: string`, y dejar que la conversión ocurra por
 * accidente en la serialización significa que el tipo miente en cuanto
 * alguien use el valor antes de mandarlo.
 */
function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    roomId: row.roomId,
    authorId: row.author.id,
    authorName: row.author.displayName,
    body: row.body,
    clientId: row.clientId,
    createdAt: row.createdAt.toISOString(),
  };
}
