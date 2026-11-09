// Utilidades de fechas. Las fechas se guardan siempre en ISO (UTC), como hará
// Postgres con `timestamptz`, y se muestran en la hora local del dispositivo.

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

const dos = (n) => String(n).padStart(2, '0');

/**
 * Cuenta atrás al estilo "T-3d 04h". Con menos de un día: "T-04h 12m".
 * Si la fecha ya pasó devuelve "T+…" (tiempo transcurrido).
 */
export function cuentaAtras(fechaISO, ahora = new Date()) {
  const diff = new Date(fechaISO).getTime() - ahora.getTime();
  const abs = Math.abs(diff);
  const signo = diff >= 0 ? '-' : '+';
  const d = Math.floor(abs / DIA);
  const h = Math.floor((abs % DIA) / HORA);
  const m = Math.floor((abs % HORA) / MIN);
  return d >= 1 ? `T${signo}${d}d ${dos(h)}h` : `T${signo}${dos(h)}h ${dos(m)}m`;
}

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

/** "lun, 12 nov · 09:30" */
export function formatoFecha(fechaISO) {
  const d = new Date(fechaISO);
  const dia = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${dia} · ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** ISO -> valor para <input type="datetime-local"> (hora local). */
export function aInputLocal(fechaISO) {
  const d = new Date(fechaISO);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> -> ISO. */
export function deInputLocal(valor) {
  return new Date(valor).toISOString();
}
