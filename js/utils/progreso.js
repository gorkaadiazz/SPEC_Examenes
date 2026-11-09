// Cálculos pequeños sobre los temas de una evaluación.

/**
 * % de temas marcados como estudiados (entero 0-100).
 * Devuelve null si la evaluación no tiene temas.
 */
export function porcentajePreparado(temas) {
  if (!temas || temas.length === 0) return null;
  const hechos = temas.filter((t) => t.estudiado).length;
  return Math.round((hechos / temas.length) * 100);
}
