// Cola de cambios pendientes de enviar a Supabase.
// Cada cambio local (guardar o borrar) se apunta aquí en la misma transacción
// que el propio cambio. El sincronizador (sincronizar.js) la va vaciando
// cuando hay conexión.

import { contar, todos, tx } from './db.js';

/**
 * Apunta un cambio dentro de una transacción ya abierta.
 * La clave es "tabla:id": si una fila cambia varias veces sin conexión solo
 * queda su último cambio, que es el único que hay que subir.
 * @param {IDBTransaction} t   transacción que incluye el almacén 'cola'
 * @param {'upsert'|'delete'} op
 * @param {object} [extra]  datos que hacen falta para subir el cambio
 *                          (p. ej. la ruta en Storage de un apunte borrado)
 */
export function encolar(t, tabla, op, id, extra = {}) {
  t.objectStore('cola').put({
    ...extra,
    clave: `${tabla}:${id}`,
    tabla,
    op,
    id,
    fecha: new Date().toISOString(),
    // Identifica esta versión del cambio (dos cambios en el mismo milisegundo
    // tendrían la misma fecha)
    rev: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
}

/** Nº de cambios que aún no se han subido. */
export function pendientes() {
  return contar('cola');
}

/** Lista de cambios pendientes, del más antiguo al más nuevo. */
export async function listarPendientes() {
  const lista = await todos('cola');
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Quita de la cola los cambios ya subidos, salvo los que hayan vuelto a
 * cambiar mientras se subían (esos se subirán en la siguiente vuelta).
 */
export async function quitarSubidos(entradas) {
  if (!entradas.length) return;
  await tx(['cola'], 'readwrite', (t) => {
    const cola = t.objectStore('cola');
    for (const e of entradas) {
      const req = cola.get(e.clave);
      req.onsuccess = () => {
        if (req.result && req.result.rev === e.rev) cola.delete(e.clave);
      };
    }
  });
}
