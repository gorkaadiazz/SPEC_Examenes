// Utilidades del examen de práctica que no necesitan navegador ni conexión
// (se pueden probar con `npm test`).

/**
 * Valida un examen importado en JSON (plan B sin IA).
 * Acepta { "preguntas": [...] } o directamente la lista.
 * @returns {Array<{pregunta:string,respuesta_modelo:string,tema:string}>}
 */
export function leerExamenJSON(textoJSON) {
  let datos;
  try {
    // Los chats suelen envolver el JSON en ```json … ```
    datos = JSON.parse(textoJSON.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
  } catch {
    throw new Error('Eso no es un JSON válido. Copia solo el bloque de código que te dé el chat.');
  }
  const lista = Array.isArray(datos) ? datos : datos?.preguntas;
  if (!Array.isArray(lista)) throw new Error('Falta la lista "preguntas".');
  const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const preguntas = lista
    .map((p) => ({ pregunta: texto(p?.pregunta, 600), respuesta_modelo: texto(p?.respuesta_modelo, 1200), tema: texto(p?.tema, 80) || 'General' }))
    .filter((p) => p.pregunta && p.respuesta_modelo)
    .slice(0, 30);
  if (!preguntas.length) throw new Error('No hay ninguna pregunta con "pregunta" y "respuesta_modelo".');
  return preguntas;
}

/** Lo que hay que pedirle a un chat para generar un examen importable. */
export const FORMATO_JSON = `{
  "preguntas": [
    {
      "pregunta": "¿Qué hace el protocolo DHCP?",
      "respuesta_modelo": "Asigna automáticamente la configuración IP a los equipos de la red.",
      "tema": "DHCP"
    }
  ]
}`;

export const PROMPT_PARA_CHAT = `Hazme un examen de 10 preguntas cortas sobre los apuntes que te paso. Devuélvelo SOLO como JSON con este formato:\n${FORMATO_JSON}`;

/** Nota media (0-10, un decimal) de una lista de notas por pregunta. */
export function notaMedia(notas) {
  if (!notas.length) return null;
  return Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10;
}

/**
 * Temas flojos: media por tema de todos los intentos, de peor a mejor,
 * quedándose con los que no llegan al 5.
 * @param {Array<{preguntas:Array<{tema:string}>, respuestas:Array<{nota:number}>}>} intentos
 */
export function temasFlojos(intentos) {
  const porTema = new Map();
  for (const intento of intentos) {
    intento.preguntas.forEach((p, i) => {
      const nota = intento.respuestas?.[i]?.nota;
      if (typeof nota !== 'number') return;
      const t = porTema.get(p.tema) ?? { suma: 0, n: 0 };
      t.suma += nota;
      t.n += 1;
      porTema.set(p.tema, t);
    });
  }
  return [...porTema]
    .map(([tema, { suma, n }]) => ({ tema, media: Math.round((suma / n) * 10) / 10, n }))
    .filter((t) => t.media < 5)
    .sort((a, b) => a.media - b.media);
}
