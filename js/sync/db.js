// Copia local de los datos en IndexedDB.
// Cada tabla de Supabase (sección 6.2 de SPEC.md) tiene aquí un almacén con
// el mismo nombre, así en la fase 3 sincronizar es copiar filas tal cual.

const NOMBRE_BD = 'examenes-2smr';
const VERSION_BD = 1;

// tabla -> índices (columnas por las que se busca)
export const TABLAS = {
  perfiles: [],
  modulos: [],
  resultados_aprendizaje: ['modulo_id'],
  evaluaciones: ['modulo_id', 'fecha'],
  evaluacion_ra: ['evaluacion_id', 'ra_id'],
  temas: ['evaluacion_id'],
  archivos: ['evaluacion_id', 'modulo_id'],
  faltas: ['modulo_id', 'fecha'],
  fe_registros: ['fecha'],
  examenes_ia: ['modulo_id'],
  flashcards: ['modulo_id'],
  pomodoro_sesiones: ['modulo_id'],
  chuletas: [],
  uso_ia: [],
};

let promesaBD = null;

/** Abre (y crea si hace falta) la base de datos. Se reutiliza la conexión. */
export function abrir() {
  if (promesaBD) return promesaBD;
  promesaBD = new Promise((ok, ko) => {
    const req = indexedDB.open(NOMBRE_BD, VERSION_BD);
    req.onupgradeneeded = () => {
      const bd = req.result;
      for (const [tabla, indices] of Object.entries(TABLAS)) {
        if (bd.objectStoreNames.contains(tabla)) continue;
        const almacen = bd.createObjectStore(tabla, { keyPath: 'id' });
        for (const col of indices) almacen.createIndex(col, col);
      }
      // Cola de cambios pendientes de subir: una entrada por fila ("tabla:id").
      if (!bd.objectStoreNames.contains('cola')) bd.createObjectStore('cola', { keyPath: 'clave' });
      // Datos sueltos de la app (p. ej. si ya se precargaron los módulos).
      if (!bd.objectStoreNames.contains('meta')) bd.createObjectStore('meta', { keyPath: 'clave' });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(req.error);
  });
  return promesaBD;
}

/** Convierte una petición de IndexedDB en una promesa. */
function pedir(req) {
  return new Promise((ok, ko) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(req.error);
  });
}

/**
 * Ejecuta `fn(transaccion)` y resuelve cuando la transacción termina entera.
 * Todo lo que se escriba dentro se guarda junto o no se guarda nada.
 */
export async function tx(almacenes, modo, fn) {
  const bd = await abrir();
  return new Promise((ok, ko) => {
    const t = bd.transaction(almacenes, modo);
    t.oncomplete = () => ok();
    t.onerror = () => ko(t.error);
    t.onabort = () => ko(t.error);
    fn(t);
  });
}

export async function todos(almacen) {
  const bd = await abrir();
  return pedir(bd.transaction(almacen).objectStore(almacen).getAll());
}

export async function obtener(almacen, clave) {
  const bd = await abrir();
  return pedir(bd.transaction(almacen).objectStore(almacen).get(clave));
}

export async function porIndice(almacen, indice, valor) {
  const bd = await abrir();
  return pedir(bd.transaction(almacen).objectStore(almacen).index(indice).getAll(valor));
}

export async function contar(almacen) {
  const bd = await abrir();
  return pedir(bd.transaction(almacen).objectStore(almacen).count());
}

/** Borra toda la base de datos local (cerrar sesión, borrar cuenta, pruebas). */
export async function borrarTodo() {
  const bd = await abrir();
  bd.close();
  promesaBD = null;
  await new Promise((ok, ko) => {
    const req = indexedDB.deleteDatabase(NOMBRE_BD);
    req.onsuccess = () => ok();
    req.onerror = () => ko(req.error);
    req.onblocked = () => ok();
  });
}
