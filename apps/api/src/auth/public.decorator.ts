import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = "isPublic";

/**
 * Marca una ruta como accesible sin sesión.
 *
 * Un decorador de Nest no es magia: `SetMetadata` sólo guarda un par
 * clave/valor sobre el handler, y `JwtAuthGuard` lo lee con `Reflector`. El
 * mismo mecanismo que usa `@Controller` para guardar su prefijo.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
