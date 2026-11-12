// Perfil y preferencias del usuario (tabla `perfiles`, una sola fila).
// Con sesión, el id de la fila es el del usuario; en modo local es 'local'
// (esa fila no se sube: ver sincronizar.js).

import * as db from '../sync/db.js';
import { escribir, preparar } from './base.js';

// Valores por defecto de las preferencias (columna jsonb `preferencias`)
export const PREFERENCIAS = {
  semanas_curso: 30, // semanas de clase, para calcular las horas totales de cada módulo
  contar_justificadas: false, // ¿las faltas justificadas cuentan para el límite?
  peso_examenes: {}, // { moduloId: % } en los módulos con sistema de porcentajes
  fe: { horas_totales: 400, inicio: '', fin: '' }, // Formación en Empresa
  pomodoro: { trabajo: 25, descanso: 5 },
  avisos: false, // notificaciones del navegador
  dias_aviso: 2, // con cuántos días de antelación avisar
};

const idPerfil = () => window.usuario?.id ?? 'local';

/** Devuelve el perfil con todos los valores por defecto rellenados. */
export async function obtener() {
  const id = idPerfil();
  let fila = await db.obtener('perfiles', id);
  if (!fila && id !== 'local') {
    // Primer inicio de sesión: se heredan las preferencias del modo local
    const local = await db.obtener('perfiles', 'local');
    if (local) {
      fila = preparar({ ...local, id, created_at: undefined });
      await escribir([{ tabla: 'perfiles', op: 'upsert', fila }]);
      await db.tx(['perfiles', 'cola'], 'readwrite', (t) => {
        t.objectStore('perfiles').delete('local');
        t.objectStore('cola').delete('perfiles:local');
      });
    }
  }
  const prefs = fila?.preferencias ?? {};
  return {
    limite_faltas: 25,
    ...(fila ?? {}),
    id,
    preferencias: { ...PREFERENCIAS, ...prefs, fe: { ...PREFERENCIAS.fe, ...(prefs.fe ?? {}) }, pomodoro: { ...PREFERENCIAS.pomodoro, ...(prefs.pomodoro ?? {}) }, peso_examenes: { ...(prefs.peso_examenes ?? {}) } },
  };
}

/**
 * Guarda cambios del perfil.
 * @param {object} cambios       columnas (p. ej. { limite_faltas: 20 })
 * @param {object} preferencias  claves de preferencias a cambiar
 */
export async function guardar(cambios = {}, preferencias = {}) {
  const actual = await obtener();
  const fila = preparar({ ...actual, ...cambios, preferencias: { ...actual.preferencias, ...preferencias } });
  await escribir([{ tabla: 'perfiles', op: 'upsert', fila }]);
  return fila;
}
