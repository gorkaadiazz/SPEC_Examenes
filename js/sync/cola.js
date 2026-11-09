// Cola de cambios pendientes de enviar a Supabase.
// En las fases 1-2 solo se rellena; en la fase 3 un sincronizador la irá
// vaciando (subiendo cada fila) cuando haya conexión.

import { contar, todos } from './db.js';

/**
 * Apunta un cambio dentro de una transacción ya abierta.
 * La clave es "tabla:id": si una fila cambia varias veces sin conexión solo
 * queda su último cambio, que es el único que hay que subir.
 * @param {IDBTransaction} t   transacción que incluye el almacén 'cola'
 * @param {'upsert'|'delete'} op
 */
export function encolar(t, tabla, op, id) {
  t.objectStore('cola').put({
    clave: `${tabla}:${id}`,
    tabla,
    op,
    id,
    fecha: new Date().toISOString(),
  });
}

/** Nº de cambios que aún no se han subido. */
export function pendientes() {
  return contar('cola');
}

/** Lista de cambios pendientes (la usará el sincronizador de la fase 3). */
export function listarPendientes() {
  return todos('cola');
}
