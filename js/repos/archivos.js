// Apuntes: PDF o fotos asociados a un módulo y, opcionalmente, a una evaluación.
// - La fila de `archivos` (nombre, tamaño, tipo…) va a la cola de cambios como
//   cualquier otra tabla.
// - El contenido se guarda aparte, en el almacén 'archivos_blob', solo en este
//   dispositivo. En la fase 3 se subirá al bucket privado `temarios` de
//   Supabase Storage y `ruta` guardará su ubicación allí.

import * as db from '../sync/db.js';
import { escribir, preparar } from './base.js';

export const TAMANO_MAXIMO = 20 * 1024 * 1024; // 20 MB, como el límite del bucket
export const TIPOS_ACEPTADOS = 'application/pdf,image/jpeg,image/png,image/webp';

/** Comprueba un archivo antes de guardarlo. Devuelve el motivo si no vale, o null. */
export function problema(archivo) {
  const tipoValido = archivo.type === 'application/pdf' || archivo.type.startsWith('image/');
  if (!tipoValido) return `«${archivo.name}» no es un PDF ni una foto.`;
  if (archivo.size > TAMANO_MAXIMO) return `«${archivo.name}» pesa más de 20 MB.`;
  return null;
}

/** Apuntes de un módulo (incluye los de sus evaluaciones), del más nuevo al más antiguo. */
export async function deModulo(moduloId) {
  const filas = await db.porIndice('archivos', 'modulo_id', moduloId);
  return filas.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Apuntes de una evaluación concreta. */
export async function deEvaluacion(evaluacionId) {
  const filas = await db.porIndice('archivos', 'evaluacion_id', evaluacionId);
  return filas.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Nº de apuntes por módulo: Map(modulo_id -> n). */
export async function contarPorModulo() {
  const mapa = new Map();
  for (const a of await db.todos('archivos')) mapa.set(a.modulo_id, (mapa.get(a.modulo_id) ?? 0) + 1);
  return mapa;
}

/**
 * Guarda un archivo (File) en el dispositivo.
 * @param {File} archivo
 * @param {{modulo_id:string, evaluacion_id?:string|null}} destino
 */
export async function guardar(archivo, { modulo_id, evaluacion_id = null }) {
  const motivo = problema(archivo);
  if (motivo) throw new Error(motivo);
  const fila = preparar({
    modulo_id,
    evaluacion_id,
    nombre: archivo.name,
    tamano: archivo.size,
    tipo: archivo.type,
    ruta: null, // fase 3: "{user_id}/{evaluacion_id}/{nombre}" en Storage
  });
  // Primero el contenido y después la fila: así nunca hay una fila sin archivo.
  await db.tx(['archivos_blob'], 'readwrite', (t) => t.objectStore('archivos_blob').put({ id: fila.id, blob: archivo }));
  await escribir([{ tabla: 'archivos', op: 'upsert', fila }]);
  pedirAlmacenamientoPersistente();
  return fila;
}

/** Devuelve el contenido (Blob) de un apunte, o null si no está en este dispositivo. */
export async function contenido(id) {
  return (await db.obtener('archivos_blob', id))?.blob ?? null;
}

export function borrar(id) {
  return escribir([{ tabla: 'archivos', op: 'delete', id }]);
}

/** "1,2 MB", "350 KB" */
export function tamanoLegible(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Pide al navegador que no borre los datos de la app aunque falte espacio.
let pedido = false;
function pedirAlmacenamientoPersistente() {
  if (pedido || !navigator.storage?.persist) return;
  pedido = true;
  navigator.storage.persist().catch(() => {});
}
