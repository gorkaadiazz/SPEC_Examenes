// Sincronización entre la copia local (IndexedDB) y Supabase (sección 6.7).
//
//  · Lectura: la app siempre pinta desde IndexedDB; después se descarga lo
//    nuevo del servidor y se repinta.
//  · Escritura: cada cambio se guarda en IndexedDB y en la cola. Aquí se sube
//    la cola cuando hay conexión (al momento, al volver la conexión, al abrir
//    la app y cada minuto).
//  · Conflictos: gana el cambio con el updated_at más reciente (lo comprueban
//    el trigger del servidor al subir y decidirDescarga() al bajar).
//  · Borrados: se suben como cualquier cambio; los de otros dispositivos se
//    descargan de la tabla `borrados`.

import { cliente } from '../supabase.js';
import * as db from './db.js';
import { encolar, listarPendientes, pendientes, quitarSubidos } from './cola.js';
import { ORDEN, SOLO_LECTURA, limpiarFila, decidirDescarga, rutaApunte } from './reglas.js';
import { emitir, escuchar } from '../utils/eventos.js';

const BUCKET = 'temarios';
const TROZO = 200; // filas por petición
const MARGEN_DESCARGA = 60_000; // se vuelve a pedir el último minuto, por si acaso

let usuario = null;
let enMarcha = null; // promesa de la sincronización en curso
let siguiente = null; // promesa de la vuelta que se hará al terminar la actual
let temporizador = null;

/**
 * Estado que muestra la app:
 *  fase: 'local' | 'sincronizando' | 'sincronizado' | 'sin-conexion' | 'error'
 */
export const estado = { fase: 'local', pendientes: 0, mensaje: '', rechazados: 0 };

async function avisar(cambios = {}) {
  Object.assign(estado, cambios);
  estado.pendientes = await pendientes().catch(() => estado.pendientes);
  emitir('sync', estado);
}

/** Empieza a sincronizar para este usuario. */
export function iniciar(user) {
  usuario = user;
  estado.fase = navigator.onLine ? 'sincronizando' : 'sin-conexion';
  // Cada cambio local se sube al poco (se agrupan los cambios seguidos)
  escuchar('cambio', () => programar(1500));
  window.addEventListener('online', () => programar(0));
  window.addEventListener('offline', () => avisar({ fase: 'sin-conexion' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') programar(0);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') programar(0);
  }, 60_000);
}

function programar(ms) {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => sincronizar(), ms);
}

/**
 * Sube lo pendiente y baja lo nuevo. Devuelve true si ha ido bien.
 * Si ya hay una sincronización en marcha, espera a que acabe y hace otra
 * vuelta (la que está en marcha puede haber leído la cola antes de este cambio).
 */
export function sincronizar() {
  if (!usuario) return Promise.resolve(false);
  if (enMarcha) {
    siguiente ??= enMarcha.then(() => {
      siguiente = null;
      return sincronizar();
    });
    return siguiente;
  }
  enMarcha = unaVuelta().finally(() => {
    enMarcha = null;
  });
  return enMarcha;
}

async function unaVuelta() {
  clearTimeout(temporizador);
  if (!navigator.onLine) {
    await avisar({ fase: 'sin-conexion' });
    return false;
  }
  await avisar({ fase: 'sincronizando' });
  try {
    await subir();
    await bajar();
    await avisar({ fase: 'sincronizado', mensaje: '' });
    return true;
  } catch (e) {
    console.warn('Sincronización', e);
    const red = esErrorDeRed(e) || !navigator.onLine;
    await avisar({ fase: red ? 'sin-conexion' : 'error', mensaje: red ? '' : e.message ?? String(e) });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

function esErrorDeRed(e) {
  const texto = `${e?.message ?? ''} ${e?.details ?? ''}`;
  return /failed to fetch|networkerror|network request failed|load failed/i.test(texto) && !e?.code;
}

// Errores de datos (restricciones, RLS…): reintentar no los arregla. La fila
// se descarta de la cola para no bloquear el resto y se avisa en la consola.
function esErrorDeDatos(e) {
  return /^(22|23)/.test(e?.code ?? '') || e?.code === '42501';
}

/** Lanza el error si es transitorio (red, sesión caducada…). */
function relanzarSiTransitorio(error) {
  if (!error) return;
  if (esErrorDeDatos(error)) return;
  throw Object.assign(new Error(error.message ?? 'Error de Supabase'), { code: error.code, details: error.details });
}

// ---------------------------------------------------------------------------
// Subir
// ---------------------------------------------------------------------------

async function subir() {
  const entradas = await listarPendientes();
  const guardar = entradas.filter((e) => e.op === 'upsert' && ORDEN.includes(e.tabla));
  const borrar = entradas.filter((e) => e.op === 'delete' && ORDEN.includes(e.tabla));
  // Entradas de tablas que no se suben (p. ej. uso_ia): fuera de la cola
  await quitarSubidos(entradas.filter((e) => !ORDEN.includes(e.tabla)));

  for (const tabla of ORDEN) {
    const lote = guardar.filter((e) => e.tabla === tabla);
    for (let i = 0; i < lote.length; i += TROZO) await subirTrozo(tabla, lote.slice(i, i + TROZO));
  }
  for (const tabla of [...ORDEN].reverse()) {
    const lote = borrar.filter((e) => e.tabla === tabla);
    for (let i = 0; i < lote.length; i += TROZO) await borrarTrozo(tabla, lote.slice(i, i + TROZO));
  }
}

async function subirTrozo(tabla, entradas) {
  const filas = [];
  for (const e of entradas) {
    let fila = await db.obtener(tabla, e.id);
    if (!fila) continue; // ya no existe (se borró después): nada que subir
    if (tabla === 'archivos' && !fila.ruta) fila = await subirContenido(fila);
    filas.push(limpiarFila(tabla, fila));
  }
  if (filas.length) {
    const { error } = await cliente.from(tabla).upsert(filas, { onConflict: 'id' });
    if (error) {
      relanzarSiTransitorio(error);
      // Un error de datos en el lote: se reintenta fila a fila para salvar las buenas
      for (const fila of filas) {
        const r = await cliente.from(tabla).upsert(fila, { onConflict: 'id' });
        relanzarSiTransitorio(r.error);
        if (r.error) {
          estado.rechazados += 1;
          console.warn(`El servidor ha rechazado una fila de ${tabla}`, fila, r.error);
        }
      }
    }
  }
  await quitarSubidos(entradas);
}

/** Sube el contenido de un apunte a Storage y apunta su ruta en la fila. */
async function subirContenido(fila) {
  const guardado = await db.obtener('archivos_blob', fila.id);
  if (!guardado?.blob) return fila; // el contenido no está en este dispositivo
  const ruta = rutaApunte(usuario.id, fila);
  const { error } = await cliente.storage.from(BUCKET).upload(ruta, guardado.blob, { contentType: fila.tipo, upsert: true });
  if (error) {
    if (esErrorDeRed(error) || !error.statusCode || Number(error.statusCode) >= 500) throw error;
    console.warn('Storage ha rechazado el apunte', fila.nombre, error);
    estado.rechazados += 1;
    return fila;
  }
  // Se guarda la ruta sin cambiar updated_at ni volver a pasar por la cola
  const conRuta = { ...fila, ruta };
  await db.tx(['archivos'], 'readwrite', (t) => t.objectStore('archivos').put(conRuta));
  return conRuta;
}

async function borrarTrozo(tabla, entradas) {
  if (tabla === 'archivos') {
    const rutas = entradas.map((e) => e.ruta).filter(Boolean);
    if (rutas.length) {
      const { error } = await cliente.storage.from(BUCKET).remove(rutas);
      if (error && esErrorDeRed(error)) throw error;
    }
  }
  const { error } = await cliente.from(tabla).delete().in('id', entradas.map((e) => e.id));
  relanzarSiTransitorio(error);
  await quitarSubidos(entradas);
}

// ---------------------------------------------------------------------------
// Bajar
// ---------------------------------------------------------------------------

async function bajar() {
  const ultima = (await db.obtener('meta', 'ultima_descarga'))?.valor ?? null;
  const desde = ultima ? new Date(Date.parse(ultima) - MARGEN_DESCARGA).toISOString() : null;
  let maxima = ultima;
  let cambios = 0;
  const masReciente = (a, b) => (!a || (b && b > a) ? b : a);

  for (const tabla of [...ORDEN, ...SOLO_LECTURA]) {
    for (let desdeFila = 0; ; desdeFila += 1000) {
      let consulta = cliente.from(tabla).select('*').order('sync_at').range(desdeFila, desdeFila + 999);
      if (desde) consulta = consulta.gt('sync_at', desde);
      const { data, error } = await consulta;
      if (error) throw error;
      cambios += await aplicarRemotas(tabla, data);
      for (const f of data) maxima = masReciente(maxima, f.sync_at);
      if (data.length < 1000) break;
    }
  }

  // Borrados en otros dispositivos (la primera vez no hace falta: se acaba
  // de descargar todo lo que existe)
  if (desde) {
    const { data: borrados, error } = await cliente.from('borrados').select('tabla, fila_id, sync_at').gt('sync_at', desde).order('sync_at').limit(5000);
    if (error) throw error;
    cambios += await aplicarBorrados(borrados);
    for (const b of borrados) maxima = masReciente(maxima, b.sync_at);
  }

  if (maxima !== ultima) await db.tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put({ clave: 'ultima_descarga', valor: maxima }));
  await db.tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put({ clave: 'primera_descarga', valor: true }));
  if (cambios) emitir('remoto');
}

/** Guarda en la copia local las filas que llegan del servidor. Devuelve cuántas cambian. */
async function aplicarRemotas(tabla, filas) {
  if (!filas.length) return 0;
  const decisiones = [];
  for (const remota of filas) {
    const local = await db.obtener(tabla, remota.id);
    const pendiente = await db.obtener('cola', `${tabla}:${remota.id}`);
    if (local && local.updated_at === remota.updated_at && local.sync_at === remota.sync_at) continue; // igual
    if (decidirDescarga(local, pendiente, remota) === 'aplicar') decisiones.push({ remota, pendiente, local });
  }
  if (!decisiones.length) return 0;
  await db.tx([tabla, 'cola'], 'readwrite', (t) => {
    for (const { remota, pendiente, local } of decisiones) {
      // Si había un apunte con contenido local y el servidor aún no tiene ruta, se conserva la local
      const fila = tabla === 'archivos' && local?.ruta && !remota.ruta ? { ...remota, ruta: local.ruta } : remota;
      t.objectStore(tabla).put(fila);
      if (pendiente) t.objectStore('cola').delete(pendiente.clave); // gana el servidor
    }
  });
  return decisiones.length;
}

/** Borra de la copia local lo que se ha borrado en otro dispositivo. */
async function aplicarBorrados(borrados) {
  const validos = borrados.filter((b) => ORDEN.includes(b.tabla) || SOLO_LECTURA.includes(b.tabla));
  if (!validos.length) return 0;
  const tablas = [...new Set(validos.map((b) => b.tabla))];
  let n = 0;
  await db.tx([...tablas, 'cola', 'archivos_blob'], 'readwrite', (t) => {
    for (const b of validos) {
      t.objectStore(b.tabla).delete(b.fila_id);
      t.objectStore('cola').delete(`${b.tabla}:${b.fila_id}`);
      if (b.tabla === 'archivos') t.objectStore('archivos_blob').delete(b.fila_id);
      n += 1;
    }
  });
  return n;
}

// ---------------------------------------------------------------------------
// Utilidades para el primer inicio de sesión
// ---------------------------------------------------------------------------

/** Apunta en la cola TODAS las filas locales (para subir los datos del modo local). */
export async function reencolarTodo() {
  for (const tabla of ORDEN) {
    const filas = await db.todos(tabla);
    if (!filas.length) continue;
    await db.tx(['cola'], 'readwrite', (t) => {
      for (const f of filas) encolar(t, tabla, 'upsert', f.id);
    });
  }
}

/** Nº de filas en el servidor de una tabla (para saber si la cuenta ya tiene datos). */
export async function contarEnServidor(tabla) {
  const { count, error } = await cliente.from(tabla).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Enlace temporal (2 min) para ver un apunte que no está en este dispositivo. */
export async function enlaceTemporal(ruta) {
  const { data, error } = await cliente.storage.from(BUCKET).createSignedUrl(ruta, 120);
  if (error) throw error;
  return data.signedUrl;
}
