// Repetición espaciada sencilla para las flashcards (sección 5.3). Puro.
// Cada tarjeta tiene un nivel (0-5). Cuanto más alto, más tarda en volver.

const DIAS_POR_NIVEL = [0, 1, 3, 7, 14, 30];
export const NIVEL_MAXIMO = DIAS_POR_NIVEL.length - 1;

const aFecha = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Fecha de hoy como "2026-11-12" (hora local). */
export const hoy = (ahora = new Date()) => aFecha(ahora);

/**
 * Nuevo nivel y próxima revisión según la respuesta.
 * @param {'se'|'dudosa'|'no'} respuesta  "me la sé" / "dudosa" / "no me la sé"
 */
export function repasar(tarjeta, respuesta, ahora = new Date()) {
  const nivel = respuesta === 'se' ? Math.min(NIVEL_MAXIMO, (tarjeta.nivel ?? 0) + 1) : respuesta === 'dudosa' ? Math.max(1, tarjeta.nivel ?? 0) : 0;
  // Dudosa: vuelve mañana. No me la sé: vuelve hoy mismo.
  const dias = respuesta === 'se' ? DIAS_POR_NIVEL[nivel] : respuesta === 'dudosa' ? 1 : 0;
  const proxima = new Date(ahora);
  proxima.setDate(proxima.getDate() + dias);
  return { ...tarjeta, nivel, proxima_revision: aFecha(proxima) };
}

/** Tarjetas que toca repasar hoy (las más atrasadas primero). */
export function pendientes(tarjetas, ahora = new Date()) {
  const limite = hoy(ahora);
  return tarjetas.filter((t) => (t.proxima_revision ?? limite) <= limite).sort((a, b) => (a.proxima_revision ?? '').localeCompare(b.proxima_revision ?? ''));
}
