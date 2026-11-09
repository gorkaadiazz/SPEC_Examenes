// Módulos y sus Resultados de Aprendizaje (RA).

import * as db from '../sync/db.js';
import { crearRepo, escribir, preparar } from './base.js';
import { opsBorrarEvaluacion } from './evaluaciones.js';

const repo = crearRepo('modulos');
const repoRA = crearRepo('resultados_aprendizaje');

export const SISTEMAS_NOTAS = [
  ['ra', 'Por Resultados de Aprendizaje (RA)'],
  ['porcentajes', 'Porcentajes simples (exámenes y prácticas)'],
];

/** Todos los módulos, en el orden en que se crearon. */
export async function listar() {
  const filas = await repo.todos();
  return filas.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.created_at.localeCompare(b.created_at));
}

export const obtener = repo.obtener;

/** RA de un módulo ordenados por código (RA1, RA2…). */
export async function listarRA(moduloId) {
  const filas = await repoRA.porIndice('modulo_id', moduloId);
  return filas.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
}

/**
 * Guarda un módulo junto con su lista de RA (los que ya no estén se borran).
 * @param {object} modulo
 * @param {Array<{id?:string, codigo:string, descripcion:string, peso:number}>} ras
 */
export async function guardar(modulo, ras = null) {
  const fila = preparar(modulo);
  const ops = [{ tabla: 'modulos', op: 'upsert', fila }];
  if (ras) {
    const antes = modulo.id ? await listarRA(modulo.id) : [];
    const conservados = new Set(ras.map((r) => r.id).filter(Boolean));
    for (const r of antes) {
      if (!conservados.has(r.id)) ops.push({ tabla: 'resultados_aprendizaje', op: 'delete', id: r.id });
    }
    for (const r of ras) {
      ops.push({ tabla: 'resultados_aprendizaje', op: 'upsert', fila: preparar({ ...r, modulo_id: fila.id }) });
    }
  }
  await escribir(ops);
  return fila;
}

/** Borra un módulo y todo lo que cuelga de él (igual que el `on delete cascade` del servidor). */
export async function borrar(id) {
  const ops = [];
  for (const ev of await db.porIndice('evaluaciones', 'modulo_id', id)) {
    ops.push(...(await opsBorrarEvaluacion(ev.id)));
  }
  for (const ra of await listarRA(id)) ops.push({ tabla: 'resultados_aprendizaje', op: 'delete', id: ra.id });
  ops.push({ tabla: 'modulos', op: 'delete', id });
  await escribir(ops);
}

/**
 * Precarga los módulos de 2º de SMR la primera vez que se abre la app.
 * (En la fase 3 pasará a hacerse en el primer inicio de sesión del usuario.)
 */
export async function sembrarSiHaceFalta() {
  if (await db.obtener('meta', 'modulos_sembrados')) return;
  if ((await db.contar('modulos')) === 0) {
    const resp = await fetch('./data/modulos-2smr.json');
    if (!resp.ok) throw new Error('No se pudo cargar la lista de módulos');
    const lista = await resp.json();
    await escribir(
      lista.map((m, i) => ({
        tabla: 'modulos',
        op: 'upsert',
        fila: preparar({ ...m, profesor: '', horas_semanales: null, sistema_notas: 'ra', orden: i }),
      })),
    );
  }
  await db.tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put({ clave: 'modulos_sembrados', valor: true }));
}
