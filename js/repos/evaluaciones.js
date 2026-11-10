// Evaluaciones (exámenes, prácticas, trabajos…) y sus temas.

import * as db from '../sync/db.js';
import { crearRepo, escribir, preparar } from './base.js';

const repo = crearRepo('evaluaciones');

// [valor guardado, texto que se muestra]
export const TIPOS = [
  ['examen_teorico', 'Examen teórico'],
  ['examen_practico', 'Examen práctico'],
  ['practica', 'Práctica de laboratorio'],
  ['trabajo', 'Trabajo'],
  ['exposicion', 'Exposición'],
  ['entrega', 'Entrega en el aula virtual'],
  ['recuperacion', 'Recuperación'],
];
export const PERIODOS = [
  ['1', '1ª evaluación'],
  ['2', '2ª evaluación'],
  ['final', 'Final'],
];
export const ESTADOS = [
  ['pendiente', 'Pendiente'],
  ['entregado', 'Entregado'],
  ['aprobado', 'Aprobado'],
  ['suspendido', 'Suspendido'],
];

/** Texto de un valor de las listas anteriores. */
export function etiqueta(lista, valor) {
  return lista.find(([v]) => v === valor)?.[1] ?? valor;
}

/** Todas las evaluaciones ordenadas por fecha (las más cercanas primero). */
export async function listar() {
  const filas = await repo.todos();
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export const obtener = repo.obtener;

/** Temas de una evaluación en su orden. */
export async function listarTemas(evaluacionId) {
  const filas = await db.porIndice('temas', 'evaluacion_id', evaluacionId);
  return filas.sort((a, b) => a.orden - b.orden);
}

/** Todos los temas agrupados por evaluación: Map(evaluacion_id -> temas[]). */
export async function temasPorEvaluacion() {
  const mapa = new Map();
  for (const t of await db.todos('temas')) {
    if (!mapa.has(t.evaluacion_id)) mapa.set(t.evaluacion_id, []);
    mapa.get(t.evaluacion_id).push(t);
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.orden - b.orden);
  return mapa;
}

/**
 * Guarda una evaluación con su lista de temas (los que ya no estén se borran).
 * @param {object} evaluacion
 * @param {Array<{id?:string, texto:string, estudiado:boolean}>} temas
 */
export async function guardar(evaluacion, temas = null) {
  const fila = preparar(evaluacion);
  const ops = [{ tabla: 'evaluaciones', op: 'upsert', fila }];
  if (temas) {
    const antes = evaluacion.id ? await listarTemas(evaluacion.id) : [];
    const conservados = new Set(temas.map((t) => t.id).filter(Boolean));
    for (const t of antes) {
      if (!conservados.has(t.id)) ops.push({ tabla: 'temas', op: 'delete', id: t.id });
    }
    temas.forEach((t, i) => {
      ops.push({ tabla: 'temas', op: 'upsert', fila: preparar({ ...t, evaluacion_id: fila.id, orden: i }) });
    });
  }
  await escribir(ops);
  return fila;
}

/** Marca o desmarca un tema como estudiado. */
export async function marcarTema(tema, estudiado) {
  await escribir([{ tabla: 'temas', op: 'upsert', fila: preparar({ ...tema, estudiado }) }]);
}

/** Operaciones para borrar una evaluación y lo que cuelga de ella. */
export async function opsBorrarEvaluacion(id) {
  const ops = [];
  for (const tabla of ['temas', 'evaluacion_ra', 'archivos']) {
    for (const f of await db.porIndice(tabla, 'evaluacion_id', id)) ops.push({ tabla, op: 'delete', id: f.id, extra: f.ruta ? { ruta: f.ruta } : undefined });
  }
  ops.push({ tabla: 'evaluaciones', op: 'delete', id });
  return ops;
}

export async function borrar(id) {
  await escribir(await opsBorrarEvaluacion(id));
}
