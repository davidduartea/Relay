/**
 * Sustituto de `server-only` para los tests.
 *
 * El paquete real lanza al importarse desde un bundle de cliente, que es
 * justamente su utilidad: garantiza que nada del servidor acabe en el
 * navegador. Vitest no distingue entornos de Next, así que sin este alias
 * cualquier test que toque un módulo de servidor fallaría por diseño.
 *
 * La garantía sigue viva donde importa: `next build` sí distingue, y ahí el
 * paquete real hace su trabajo.
 */
export {};
