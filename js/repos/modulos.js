// Módulos y sus Resultados de Aprendizaje (RA).

import * as db from '../sync/db.js';
import { crearRepo, escribir, preparar } from './base.js';
import { opsBorrarEvaluacion } from './evaluaciones.js';

const repo = crearRepo('modulos');
const repoRA = crearRepo('resultados_aprendizaje');

export const SISTEMAS_NOTAS = [
  ['ra', 'Por RA'],
  ['porcentajes', 'Por porcentajes'],
];

// Colores para elegir al crear o editar un módulo: [color, nombre].
export const PALETA = [
  ['#3b6ff5', 'Azul'],
  ['#ef4f5a', 'Coral'],
  ['#12a37a', 'Verde'],
  ['#f29d12', 'Ámbar'],
  ['#0fb0c4', 'Turquesa'],
  ['#8b5cf6', 'Violeta'],
  ['#e85a9b', 'Rosa'],
  ['#64748b', 'Pizarra'],
];

// Colores apagados de la primera versión -> colores nuevos (mismo orden).
const COLORES_ANTIGUOS = ['#6b8fb3', '#c08a72', '#8aa888', '#d1b06b', '#6fa8a6', '#9a8fb8', '#b58a9f', '#8f9aa6'];
const COLORES_NUEVOS = ['#3b6ff5', '#ef4f5a', '#12a37a', '#f29d12', '#0fb0c4', '#8b5cf6', '#e85a9b', '#64748b'];

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
  for (const a of await db.porIndice('archivos', 'modulo_id', id)) ops.push({ tabla: 'archivos', op: 'delete', id: a.id });
  ops.push({ tabla: 'modulos', op: 'delete', id });
  await escribir(ops);
}

/**
 * Precarga los módulos de 2º de SMR la primera vez que se abre la app.
 * (En la fase 3 pasará a hacerse en el primer inicio de sesión del usuario.)
 */
export async function sembrarSiHaceFalta() {
  await sembrar();
  await actualizarColoresAntiguos();
  await ponerIlustraciones();
}

// Ilustración por defecto de cada módulo precargado (por su abreviatura).
const ILUSTRACION_POR_DEFECTO = { SOR: 'sistemas', SI: 'candado', SR: 'red', AO: 'documento', CNV: 'nube', IPE2: 'maletin', PI: 'cohete', FE: 'empresa' };

/** Una sola vez: los módulos guardados antes de que existieran las imágenes reciben una. */
async function ponerIlustraciones() {
  if (await db.obtener('meta', 'ilustraciones_v1')) return;
  const ops = [];
  for (const m of await db.todos('modulos')) {
    if (!m.imagen && !m.foto) ops.push({ tabla: 'modulos', op: 'upsert', fila: preparar({ ...m, imagen: ILUSTRACION_POR_DEFECTO[m.abreviatura] ?? 'libro' }) });
  }
  await escribir(ops);
  await db.tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put({ clave: 'ilustraciones_v1', valor: true }));
}

async function sembrar() {
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

/**
 * Una sola vez: los módulos que conserven un color de la paleta antigua
 * (más apagada) pasan al color equivalente de la paleta nueva.
 */
async function actualizarColoresAntiguos() {
  if (await db.obtener('meta', 'paleta_v2')) return;
  const ops = [];
  for (const m of await db.todos('modulos')) {
    const i = COLORES_ANTIGUOS.indexOf(m.color);
    if (i >= 0) ops.push({ tabla: 'modulos', op: 'upsert', fila: preparar({ ...m, color: COLORES_NUEVOS[i] }) });
  }
  await escribir(ops);
  await db.tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put({ clave: 'paleta_v2', valor: true }));
}
