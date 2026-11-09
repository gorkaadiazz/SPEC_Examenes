// Base común de los repositorios: toda lectura y escritura de datos pasa por aquí.
// Las vistas nunca tocan IndexedDB directamente, así en la fase 3 basta con
// añadir la sincronización con Supabase en este punto.

import * as db from '../sync/db.js';
import { encolar } from '../sync/cola.js';
import { emitir } from '../utils/eventos.js';

/** UUID v4 generado en el cliente (permite crear registros sin conexión). */
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Alternativa para contextos sin HTTPS (p. ej. probar por IP en la red local).
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Completa una fila con id, created_at y updated_at antes de guardarla. */
export function preparar(datos) {
  const ahora = new Date().toISOString();
  return {
    ...datos,
    id: datos.id ?? uuid(),
    created_at: datos.created_at ?? ahora,
    updated_at: ahora, // en un conflicto gana el updated_at más reciente
  };
}

/**
 * Aplica varias operaciones en una sola transacción y las apunta en la cola.
 * @param {Array<{tabla:string, op:'upsert', fila:object} | {tabla:string, op:'delete', id:string}>} ops
 */
export async function escribir(ops) {
  if (!ops.length) return;
  const almacenes = [...new Set(ops.map((o) => o.tabla)), 'cola'];
  await db.tx(almacenes, 'readwrite', (t) => {
    for (const o of ops) {
      if (o.op === 'upsert') t.objectStore(o.tabla).put(o.fila);
      else t.objectStore(o.tabla).delete(o.id);
      encolar(t, o.tabla, o.op, o.op === 'upsert' ? o.fila.id : o.id);
    }
  });
  emitir('cambio');
}

/** Crea el repositorio básico de una tabla. */
export function crearRepo(tabla) {
  return {
    tabla,
    todos: () => db.todos(tabla),
    obtener: (id) => db.obtener(tabla, id),
    porIndice: (indice, valor) => db.porIndice(tabla, indice, valor),
    /** Crea o actualiza una fila y devuelve cómo ha quedado. */
    async guardar(datos) {
      const fila = preparar(datos);
      await escribir([{ tabla, op: 'upsert', fila }]);
      return fila;
    },
    borrar: (id) => escribir([{ tabla, op: 'delete', id }]),
  };
}
