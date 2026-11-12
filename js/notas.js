// Cálculo de notas (sección 4.4 de SPEC.md). Funciones puras: no tocan datos
// ni pantalla, así que se pueden probar con `npm test`.
//
// Un módulo se describe con un "modelo":
//   { exigirTodos, partes: [{ id, codigo, peso, items: [{ id, peso, nota }] }] }
//  · parte  = un RA (o, en el sistema de porcentajes, "Exámenes" / "Prácticas")
//  · items  = las evaluaciones que puntúan en esa parte, con su peso dentro de ella
//  · nota   = null si esa evaluación aún no tiene nota
//  · exigirTodos = hay que tener ≥ 5 en todas las partes para aprobar (RA)

const redondear = (n) => Math.round(n * 100) / 100;

const TIPOS_EXAMEN = ['examen_teorico', 'examen_practico', 'recuperacion'];

/** Modelo por Resultados de Aprendizaje. */
export function modeloRA(ras, enlaces, evaluaciones) {
  const notaDe = new Map(evaluaciones.map((e) => [e.id, e.nota ?? null]));
  return {
    exigirTodos: true,
    partes: ras.map((ra) => ({
      id: ra.id,
      codigo: ra.codigo,
      descripcion: ra.descripcion ?? '',
      peso: Number(ra.peso) || 0,
      items: enlaces.filter((l) => l.ra_id === ra.id && notaDe.has(l.evaluacion_id)).map((l) => ({ id: l.evaluacion_id, peso: Number(l.peso) || 0, nota: notaDe.get(l.evaluacion_id) })),
    })),
  };
}

/** Modelo de porcentajes simples: exámenes por un lado y prácticas/trabajos por otro. */
export function modeloPorcentajes(evaluaciones, pesoExamenes = 60) {
  const items = (filtro) => evaluaciones.filter(filtro).map((e) => ({ id: e.id, peso: 100, nota: e.nota ?? null }));
  return {
    exigirTodos: false,
    partes: [
      { id: 'examenes', codigo: 'Exámenes', descripcion: '', peso: pesoExamenes, items: items((e) => TIPOS_EXAMEN.includes(e.tipo)) },
      { id: 'practicas', codigo: 'Prácticas y trabajos', descripcion: '', peso: 100 - pesoExamenes, items: items((e) => !TIPOS_EXAMEN.includes(e.tipo)) },
    ],
  };
}

/** Sumas de una parte: peso ya puntuado, peso total y puntos acumulados. */
function sumas(parte) {
  let hecho = 0;
  let total = 0;
  let puntos = 0;
  for (const i of parte.items) {
    total += i.peso;
    if (i.nota != null) {
      hecho += i.peso;
      puntos += i.peso * i.nota;
    }
  }
  return { hecho, total, puntos };
}

/**
 * Resumen del módulo.
 * @returns {{ nota:number|null, aprobado:boolean|null, suspensas:string[],
 *   partes:Array<{id,codigo,peso,nota:number|null,hecho:number,total:number}> }}
 *   nota: media ponderada de las partes que ya tienen nota.
 *   aprobado: null si aún no hay notas; false si la media no llega a 5 o
 *   (con exigirTodos) alguna parte está por debajo de 5.
 */
export function resumen(modelo) {
  const partes = modelo.partes.map((p) => {
    const s = sumas(p);
    return { id: p.id, codigo: p.codigo, descripcion: p.descripcion, peso: p.peso, nota: s.hecho > 0 ? redondear(s.puntos / s.hecho) : null, hecho: s.hecho, total: s.total };
  });
  const conNota = partes.filter((p) => p.nota != null && p.peso > 0);
  const pesoTotal = conNota.reduce((a, p) => a + p.peso, 0);
  const nota = pesoTotal > 0 ? redondear(conNota.reduce((a, p) => a + p.peso * p.nota, 0) / pesoTotal) : null;
  const suspensas = modelo.exigirTodos ? partes.filter((p) => p.nota != null && p.nota < 5).map((p) => p.codigo) : [];
  return { nota, aprobado: nota == null ? null : nota >= 5 && suspensas.length === 0, suspensas, partes };
}

/**
 * ¿Qué media necesito en lo que queda de una parte para llegar a `objetivo`?
 * @returns {number|null} null si ya no queda nada por puntuar en esa parte.
 *   Puede salir ≤ 0 (ya lo tienes) o > 10 (imposible).
 */
export function necesitoEnParte(parte, objetivo) {
  const s = sumas(parte);
  const queda = s.total - s.hecho;
  if (queda <= 0) return null;
  return redondear((objetivo * s.total - s.puntos) / queda);
}

/**
 * ¿Qué necesito sacar (la misma nota en todo lo que queda) para que el módulo
 * llegue a `objetivo`? Con exigirTodos, además cada parte tiene que llegar a 5.
 * @returns {{ nota:number|null, imposible:boolean, motivo:string }}
 *   nota: null si no queda nada por puntuar.
 */
export function necesitoEnModulo(modelo, objetivo) {
  // nota del módulo si saco x en todo lo pendiente = a + b·x
  let a = 0;
  let b = 0;
  let pesoPartes = 0;
  let minimo = -Infinity;
  for (const p of modelo.partes) {
    const s = sumas(p);
    if (s.total <= 0 || p.peso <= 0) continue; // parte sin evaluaciones: no cuenta
    pesoPartes += p.peso;
    a += (p.peso * s.puntos) / s.total;
    b += (p.peso * (s.total - s.hecho)) / s.total;
    if (modelo.exigirTodos) {
      const paraCinco = necesitoEnParte(p, 5);
      if (paraCinco == null) {
        if (s.puntos / s.total < 5) return { nota: null, imposible: true, motivo: `${p.codigo} ya está cerrado por debajo de 5` };
      } else minimo = Math.max(minimo, paraCinco);
    }
  }
  if (pesoPartes === 0 || b === 0) return { nota: null, imposible: false, motivo: 'No queda nada por puntuar' };
  const x = redondear(Math.max((objetivo * pesoPartes - a) / b, minimo));
  return { nota: x, imposible: x > 10, motivo: x > 10 ? 'Ni con un 10 en todo lo que queda' : '' };
}

/** Copia del modelo suponiendo que una evaluación saca `nota` (simulador). */
export function simular(modelo, evaluacionId, nota) {
  return { ...modelo, partes: modelo.partes.map((p) => ({ ...p, items: p.items.map((i) => (i.id === evaluacionId ? { ...i, nota } : i)) })) };
}

// ---------------------------------------------------------------------------
// Faltas (sección 4.5)
// ---------------------------------------------------------------------------

/** Horas que se pueden faltar: % de las horas totales del módulo. */
export function limiteFaltas(horasSemanales, semanas, porcentaje = 25) {
  if (!horasSemanales || !semanas) return null;
  return redondear((horasSemanales * semanas * porcentaje) / 100);
}

/**
 * Estado de las faltas de un módulo.
 * @returns {{ horas:number, limite:number|null, quedan:number|null,
 *   proporcion:number, nivel:'ok'|'aviso'|'peligro' }}
 *   nivel: naranja al 70 % del límite y rojo al 90 %.
 */
export function estadoFaltas(faltas, limite, contarJustificadas = false) {
  const horas = redondear(faltas.filter((f) => contarJustificadas || !f.justificada).reduce((a, f) => a + Number(f.horas), 0));
  if (limite == null) return { horas, limite: null, quedan: null, proporcion: 0, nivel: 'ok' };
  const proporcion = limite > 0 ? horas / limite : 1;
  return { horas, limite, quedan: redondear(Math.max(0, limite - horas)), proporcion, nivel: proporcion >= 0.9 ? 'peligro' : proporcion >= 0.7 ? 'aviso' : 'ok' };
}
