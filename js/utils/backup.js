// Exportar e importar todos los datos en JSON (sección 5.5).

import * as db from '../sync/db.js';
import { ORDEN, COLUMNAS, limpiarFila, soloModulosPrecargados } from '../sync/reglas.js';
import { ABREVIATURAS_PRECARGADAS } from '../repos/modulos.js';
import { escribir, preparar } from '../repos/base.js';
import { problema } from '../repos/archivos.js';

const VERSION = 1;
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const aBase64 = (blob) => new Promise((ok, ko) => { const l = new FileReader(); l.onload = () => ok(String(l.result).split(',')[1]); l.onerror = () => ko(l.error); l.readAsDataURL(blob); });

/**
 * Reúne todos los datos del dispositivo.
 * @param {{conArchivos:boolean}} opciones  true: los PDF y fotos van dentro
 *   (en base64); false: solo sus datos y su ruta en la nube.
 */
export async function exportar({ conArchivos = false } = {}) {
  const tablas = {};
  for (const t of ORDEN) tablas[t] = (await db.todos(t)).map((f) => limpiarFila(t, f));
  const copia = { app: 'examenes-2smr', version: VERSION, fecha: new Date().toISOString(), tablas, archivos: [] };
  if (conArchivos) {
    for (const { id, blob } of await db.todos('archivos_blob')) copia.archivos.push({ id, tipo: blob.type, base64: await aBase64(blob) });
  }
  return copia;
}

/**
 * Restaura una copia. Las filas se añaden o sustituyen a las que tengan el
 * mismo id; no se borra nada de lo que ya hay.
 * @returns {Promise<{filas:number, archivos:number}>}
 */
export async function importar(copia) {
  if (copia?.app !== 'examenes-2smr' || typeof copia.tablas !== 'object') throw new Error('Ese archivo no es una copia de esta app.');
  if (copia.version > VERSION) throw new Error('La copia es de una versión más nueva de la app.');
  const ops = [];
  for (const tabla of ORDEN) {
    if (tabla === 'perfiles') continue; // las preferencias no se pisan
    for (const fila of Array.isArray(copia.tablas[tabla]) ? copia.tablas[tabla] : []) {
      if (!fila || typeof fila !== 'object' || !ES_UUID.test(fila.id ?? '')) continue;
      // Solo columnas conocidas; los apuntes vuelven a subirse a la nube desde aquí
      const limpia = limpiarFila(tabla, fila);
      if (tabla === 'archivos') limpia.ruta = null;
      ops.push({ tabla, op: 'upsert', fila: preparar(limpia) });
    }
  }
  if (!ops.length) throw new Error('La copia está vacía.');
  // Si aquí solo están los módulos precargados sin tocar y la copia trae los
  // suyos, se quitan los precargados para no tener cada módulo dos veces.
  if (ops.some((o) => o.tabla === 'modulos')) {
    const conteos = Object.fromEntries(await Promise.all(ORDEN.filter((t) => t !== 'perfiles').map(async (t) => [t, await db.contar(t)])));
    const locales = await db.todos('modulos');
    const enCopia = new Set(ops.filter((o) => o.tabla === 'modulos').map((o) => o.fila.id));
    if (soloModulosPrecargados(conteos, locales.map((m) => m.abreviatura), ABREVIATURAS_PRECARGADAS)) {
      for (const m of locales) if (!enCopia.has(m.id)) ops.unshift({ tabla: 'modulos', op: 'delete', id: m.id });
    }
  }
  let archivos = 0;
  const filasArchivo = new Map(ops.filter((o) => o.tabla === 'archivos').map((o) => [o.fila.id, o.fila]));
  for (const a of Array.isArray(copia.archivos) ? copia.archivos : []) {
    const fila = filasArchivo.get(a?.id);
    if (!fila || typeof a.base64 !== 'string') continue;
    const blob = new Blob([Uint8Array.from(atob(a.base64), (c) => c.charCodeAt(0))], { type: fila.tipo });
    if (problema({ name: fila.nombre, type: blob.type, size: blob.size })) continue; // solo PDF y fotos, máx. 20 MB
    await db.tx(['archivos_blob'], 'readwrite', (t) => t.objectStore('archivos_blob').put({ id: a.id, blob }));
    archivos += 1;
  }
  await escribir(ops);
  return { filas: ops.filter((o) => o.op === 'upsert').length, archivos };
}

export { COLUMNAS };
