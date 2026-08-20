import { z } from "zod";

/**
 * Esquemas de validación compartidos.
 *
 * El backend los usa para rechazar payloads inválidos y el frontend para
 * validar el formulario antes de enviar. Una sola definición significa que el
 * `maxLength` del input y el límite que aplica el servidor no pueden
 * desincronizarse — que es el bug clásico de "el form deja escribir 600
 * caracteres y el API responde 400".
 */

export const MESSAGE_MAX_LENGTH = 2000;
export const DISPLAY_NAME_MAX_LENGTH = 40;
export const PASSWORD_MIN_LENGTH = 12;
export const ROOM_NAME_MAX_LENGTH = 60;

/** minúsculas y números separados por guiones: `equipo-frontend`. */
export const ROOM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createRoomSchema = z.object({
  name: z.string().trim().min(1, "Ponle nombre a la sala").max(ROOM_NAME_MAX_LENGTH),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(ROOM_SLUG_PATTERN, "Sólo minúsculas, números y guiones"),
});

export const sendMessageSchema = z.object({
  roomId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, "El mensaje no puede estar vacío")
    .max(MESSAGE_MAX_LENGTH, `Máximo ${MESSAGE_MAX_LENGTH} caracteres`),
  clientId: z.uuid(),
});

export const joinRoomSchema = z.object({
  roomId: z.uuid(),
});

export const typingSchema = z.object({
  roomId: z.uuid(),
  isTyping: z.boolean(),
});

export const registerSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type TypingInput = z.infer<typeof typingSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
