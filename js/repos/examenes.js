// Intentos del examen de práctica (tabla `examenes_ia`).

import { crearRepo } from './base.js';

const repo = crearRepo('examenes_ia');

/** Intentos de un módulo, del más antiguo al más nuevo. */
export async function deModulo(moduloId) {
  const filas = await repo.porIndice('modulo_id', moduloId);
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export const guardar = repo.guardar;
export const borrar = repo.borrar;
