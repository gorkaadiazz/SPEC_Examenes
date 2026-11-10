// Utilidades de fechas. Las fechas se guardan siempre en ISO (UTC), como hará
// Postgres con `timestamptz`, y se muestran en la hora local del dispositivo.

const DIA = 86_400_000;
const dos = (n) => String(n).padStart(2, '0');
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Medianoche (hora local) del día de `fecha`. */
function inicioDelDia(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Días naturales que faltan: 0 = hoy, 1 = mañana, negativo = ya pasó. */
export function diasHasta(fechaISO, ahora = new Date()) {
  return Math.round((inicioDelDia(fechaISO) - inicioDelDia(ahora)) / DIA);
}

/** Cuánto falta, en palabras: "Hoy", "Mañana", "En 3 días", "Ayer", "Hace 4 días". */
export function cuandoLargo(fechaISO, ahora = new Date()) {
  const n = diasHasta(fechaISO, ahora);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  return n > 0 ? `En ${n} días` : `Hace ${-n} días`;
}

/** Versión corta para pastillas: "Hoy", "Mañana", "3 días", "Hace 2 d". */
export function cuandoCorto(fechaISO, ahora = new Date()) {
  const n = diasHasta(fechaISO, ahora);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  return n > 0 ? `${n} días` : `Hace ${-n} d`;
}

/** "08:30" */
export function hora(fechaISO) {
  const d = new Date(fechaISO);
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** "Jueves 13" */
export function diaSemana(fechaISO) {
  const d = new Date(fechaISO);
  return `${mayuscula(d.toLocaleDateString('es-ES', { weekday: 'long' }))} ${d.getDate()}`;
}

/** "jue 13 nov" */
export function fechaCorta(fechaISO) {
  const d = new Date(fechaISO);
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[,.]/g, '');
}

/** "Lunes, 10 de noviembre" */
export function fechaLarga(fecha = new Date()) {
  return mayuscula(new Date(fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
}

/** Saludo según la hora del día. */
export function saludo(ahora = new Date()) {
  const h = ahora.getHours();
  if (h >= 6 && h < 14) return 'Buenos días';
  if (h >= 14 && h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

/** ISO -> { fecha: "2026-11-12", hora: "09:30" } para <input type="date"> y <input type="time">. */
export function aInputs(fechaISO) {
  const d = new Date(fechaISO);
  return { fecha: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`, hora: hora(fechaISO) };
}

/** Valores de <input type="date"> y <input type="time"> -> ISO. Sin hora se usa 08:00. */
export function deInputs(fecha, horaTexto) {
  return new Date(`${fecha}T${horaTexto || '08:00'}`).toISOString();
}
