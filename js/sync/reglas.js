// Reglas de la sincronización, sin efectos secundarios (se pueden probar con
// `npm test` sin navegador ni Supabase).

// Tablas que se sincronizan, en orden de "padres antes que hijos": al subir se
// recorren en este orden (para que exista el módulo antes que su evaluación) y
// al borrar, al revés.
export const ORDEN = [
  'perfiles',
  'modulos',
  'resultados_aprendizaje',
  'evaluaciones',
  'evaluacion_ra',
  'temas',
  'archivos',
  'faltas',
  'fe_registros',
  'examenes_ia',
  'flashcards',
  'pomodoro_sesiones',
  'chuletas',
];

// Tablas que solo se descargan (las escribe el servidor)
export const SOLO_LECTURA = ['uso_ia'];

const COMUNES = ['id', 'created_at', 'updated_at'];

// Columnas que se suben de cada tabla (las mismas que en supabase/migrations).
// Lo que no esté aquí no se envía: user_id lo pone el servidor y sync_at también.
export const COLUMNAS = {
  perfiles: [...COMUNES, 'nombre', 'curso', 'centro', 'limite_faltas', 'tema', 'preferencias'],
  modulos: [...COMUNES, 'nombre', 'abreviatura', 'color', 'profesor', 'horas_semanales', 'sistema_notas', 'orden', 'imagen', 'foto'],
  resultados_aprendizaje: [...COMUNES, 'modulo_id', 'codigo', 'descripcion', 'peso'],
  evaluaciones: [...COMUNES, 'modulo_id', 'titulo', 'tipo', 'fecha', 'evaluacion', 'estado', 'nota', 'notas', 'enlace'],
  evaluacion_ra: [...COMUNES, 'evaluacion_id', 'ra_id', 'peso'],
  temas: [...COMUNES, 'evaluacion_id', 'texto', 'estudiado', 'orden'],
  archivos: [...COMUNES, 'modulo_id', 'evaluacion_id', 'ruta', 'nombre', 'tamano', 'tipo'],
  faltas: [...COMUNES, 'modulo_id', 'fecha', 'horas', 'justificada'],
  fe_registros: [...COMUNES, 'fecha', 'horas', 'tareas'],
  examenes_ia: [...COMUNES, 'modulo_id', 'temas', 'preguntas', 'respuestas', 'nota', 'fecha'],
  flashcards: [...COMUNES, 'modulo_id', 'pregunta', 'respuesta', 'nivel', 'proxima_revision'],
  pomodoro_sesiones: [...COMUNES, 'modulo_id', 'inicio', 'minutos'],
  chuletas: [...COMUNES, 'categoria', 'comando', 'descripcion'],
};

/** Copia de la fila solo con las columnas que existen en Supabase. */
export function limpiarFila(tabla, fila) {
  const limpia = {};
  for (const col of COLUMNAS[tabla]) {
    if (fila[col] !== undefined) limpia[col] = fila[col];
  }
  return limpia;
}

/**
 * Llega una fila del servidor: ¿se guarda en la copia local?
 * @param {object|undefined} local      la fila que hay en este dispositivo
 * @param {object|undefined} pendiente  su cambio sin subir en la cola, si lo hay
 * @param {object} remota               la fila que manda el servidor
 * @returns {'aplicar'|'ignorar'}
 */
export function decidirDescarga(local, pendiente, remota) {
  if (!pendiente) return 'aplicar'; // sin cambios locales: manda el servidor
  if (pendiente.op === 'delete') return 'ignorar'; // aquí se borró: se subirá el borrado
  if (!local) return 'aplicar';
  // Los dos han cambiado: gana el updated_at más reciente
  return Date.parse(remota.updated_at) > Date.parse(local.updated_at) ? 'aplicar' : 'ignorar';
}

/** Nombre seguro para Storage: sin barras, acentos ni caracteres raros. */
export function nombreSeguro(nombre) {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|-+$/g, '');
  return (limpio || 'archivo').slice(-80);
}

/** Ruta del apunte en el bucket `temarios` (sección 6.4 de SPEC.md). */
export function rutaApunte(userId, fila) {
  const carpeta = fila.evaluacion_id ?? `modulo-${fila.modulo_id}`;
  return `${userId}/${carpeta}/${fila.id}-${nombreSeguro(fila.nombre)}`;
}

/**
 * ¿Los datos locales son solo los módulos precargados sin tocar?
 * Se usa al iniciar sesión por primera vez en un dispositivo: si la cuenta ya
 * tiene datos en la nube, esos módulos de ejemplo se descartan para no
 * duplicarlos; si el usuario ya había apuntado cosas, se conservan y se suben.
 */
export function soloModulosPrecargados(conteos, abreviaturasModulos, abreviaturasSemilla) {
  const otros = Object.entries(conteos).filter(([tabla]) => tabla !== 'modulos');
  if (otros.some(([, n]) => n > 0)) return false;
  return abreviaturasModulos.every((a) => abreviaturasSemilla.includes(a));
}
