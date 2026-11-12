// Pantalla "Notas": nota de cada módulo por RA, "¿qué necesito?", simulador
// y control de faltas (secciones 4.4 y 4.5).

import { h, poner, campo, opciones, abrirHoja } from '../utils/dom.js';
import { fechaCorta } from '../utils/fechas.js';
import { modeloRA, modeloPorcentajes, resumen, necesitoEnParte, necesitoEnModulo, simular, limiteFaltas, estadoFaltas } from '../notas.js';
import { hoy } from '../tools/repaso.js';
import * as repoModulos from '../repos/modulos.js';
import * as repoEvaluaciones from '../repos/evaluaciones.js';
import * as repoPerfil from '../repos/perfil.js';
import { faltas as repoFaltas, enlacesRA } from '../repos/varios.js';
import { avatar } from './evaluaciones.js';
import { icono } from './iconos.js';

const estado = { moduloId: null, objetivo: 5, simulada: null, notaSimulada: 7 };
const repintar = (arriba = false) => {
  if (arriba) window.scrollTo(0, 0);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};

/**
 * Datos de notas y faltas de todos los módulos (también los usa Inicio para
 * las alertas de riesgo).
 */
export async function resumenes() {
  const [modulos, evaluaciones, enlaces, faltas, perfil] = await Promise.all([repoModulos.listar(), repoEvaluaciones.listar(), enlacesRA(), repoFaltas.todos(), repoPerfil.obtener()]);
  const prefs = perfil.preferencias;
  return Promise.all(
    modulos.map(async (modulo) => {
      const suyas = evaluaciones.filter((e) => e.modulo_id === modulo.id);
      const modelo = modulo.sistema_notas === 'porcentajes' ? modeloPorcentajes(suyas, prefs.peso_examenes[modulo.id] ?? 60) : modeloRA(await repoModulos.listarRA(modulo.id), enlaces, suyas);
      const susFaltas = faltas.filter((f) => f.modulo_id === modulo.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
      const limite = limiteFaltas(modulo.horas_semanales, prefs.semanas_curso, perfil.limite_faltas);
      return { modulo, evaluaciones: suyas, modelo, notas: resumen(modelo), faltas: susFaltas, asistencia: estadoFaltas(susFaltas, limite, prefs.contar_justificadas) };
    }),
  );
}

const claseNota = (r) => (r.aprobado == null ? '' : r.aprobado ? 'aprobado' : 'suspendido');
const textoNota = (n) => (n == null ? '—' : String(n).replace('.', ','));

/** Barra de faltas: verde, naranja al 70 % del límite y rojo al 90 %. */
function barraFaltas(a) {
  if (a.limite == null) return h('p', { class: 'ayuda' }, a.horas ? `${a.horas} h de faltas · pon las horas semanales del módulo para ver el límite` : 'Pon las horas semanales del módulo (Perfil) para controlar las faltas.');
  return h(
    'div',
    { class: `faltas ${a.nivel}` },
    h('span', { class: 'barra', role: 'img', 'aria-label': `${a.horas} horas de faltas de un límite de ${a.limite}` }, h('span', { style: `transform:scaleX(${Math.min(1, a.proporcion)})` })),
    h('span', { class: 'faltas-texto' }, a.quedan > 0 ? `${a.horas} h de ${a.limite} · te quedan ${a.quedan} h` : `${a.horas} h de ${a.limite} · has superado el límite`),
  );
}

export async function render(cont) {
  const datos = await resumenes();
  const elegido = datos.find((d) => d.modulo.id === estado.moduloId);
  if (elegido) return renderDetalle(cont, elegido);
  estado.moduloId = null;

  poner(
    cont,
    h('header', { class: 'barra-superior' }, h('h1', { class: 'titulo-pantalla' }, 'Notas')),
    datos.length
      ? h(
          'div',
          { class: 'lista-modulos' },
          datos.map((d) =>
            h(
              'article',
              { class: 'fila-modulo', style: `--c:${d.modulo.color}` },
              h(
                'button',
                { type: 'button', class: 'fila-modulo-cabecera', onclick: () => { estado.moduloId = d.modulo.id; estado.simulada = null; repintar(true); } },
                avatar(d.modulo),
                h('span', { class: 'cuerpo' }, h('b', {}, d.modulo.nombre), h('span', { class: 'meta' }, d.notas.suspensas.length ? `Por debajo de 5: ${d.notas.suspensas.join(', ')}` : d.notas.nota == null ? 'Sin notas todavía' : d.notas.aprobado ? 'Vas aprobando' : 'Media por debajo de 5')),
                h('span', { class: `nota-grande num ${claseNota(d.notas)}` }, textoNota(d.notas.nota)),
              ),
              h('div', { class: 'fila-modulo-faltas' }, barraFaltas(d.asistencia), h('button', { type: 'button', class: 'boton pequeno-boton', onclick: () => abrirFalta(d.modulo) }, 'Falta hoy')),
            ),
          ),
        )
      : h('div', { class: 'vacio' }, h('span', { class: 'vacio-icono' }, icono('notas')), h('h2', {}, 'Sin módulos'), h('p', {}, 'Crea tus módulos en Perfil.')),
  );
}

function renderDetalle(cont, d) {
  const { modulo, modelo, notas } = d;
  const total = necesitoEnModulo(modelo, estado.objetivo);
  const pendientes = d.evaluaciones.filter((e) => e.nota == null && modelo.partes.some((p) => p.items.some((i) => i.id === e.id)));
  if (!pendientes.some((e) => e.id === estado.simulada)) estado.simulada = pendientes[0]?.id ?? null;
  const simulado = estado.simulada ? resumen(simular(modelo, estado.simulada, estado.notaSimulada)) : null;
  const sinRA = modelo.exigirTodos && !modelo.partes.length;
  const sinVinculos = modelo.exigirTodos && modelo.partes.length > 0 && modelo.partes.every((p) => !p.items.length);

  const selObjetivo = opciones('Quiero sacar un…', 'objetivo', ['5', '6', '7', '8', '9', '10'].map((n) => [n, n]), String(estado.objetivo), 'segmentos');
  selObjetivo.addEventListener('change', (e) => { estado.objetivo = Number(e.target.value); repintar(); });

  const frase = (x) => (x == null ? 'Ya está todo puntuado' : x <= 0 ? 'Ya lo tienes' : x > 10 ? `Imposible (haría falta un ${textoNota(x)})` : `Necesitas un ${textoNota(x)} de media en lo que queda`);

  poner(
    cont,
    h(
      'header',
      { class: 'barra-superior' },
      h('button', { type: 'button', class: 'boton-icono atras', 'aria-label': 'Volver a Notas', onclick: () => { estado.moduloId = null; repintar(true); } }, icono('atras')),
      h('h1', { class: 'titulo-pantalla crece' }, modulo.abreviatura),
    ),
    h('div', { class: 'nota-final', style: `--c:${modulo.color}` }, h('b', { class: `num ${claseNota(notas)}` }, textoNota(notas.nota)), h('span', {}, modulo.nombre)),
    notas.suspensas.length ? h('p', { class: 'aviso' }, icono('alerta'), h('span', {}, h('b', {}, `${notas.suspensas.join(', ')} por debajo de 5. `), 'El módulo no se aprueba hasta que todos los RA lleguen a 5, aunque la media dé aprobado.')) : null,
    sinRA ? h('p', { class: 'ayuda' }, 'Este módulo aún no tiene RA. Añádelos en Perfil → el módulo, y marca en cada examen qué RA evalúa.') : null,
    sinVinculos ? h('p', { class: 'ayuda' }, 'Ningún examen está vinculado a un RA todavía. Abre un examen y marca «RA que evalúa».') : null,

    modelo.partes.length
      ? h(
          'section',
          { class: 'seccion' },
          h('h2', {}, modelo.exigirTodos ? 'Resultados de Aprendizaje' : 'Por partes'),
          selObjetivo,
          h(
            'div',
            { class: 'grupo' },
            notas.partes.map((p, i) =>
              h(
                'div',
                { class: 'fila-ra' },
                h('span', { class: 'cuerpo' }, h('b', {}, `${p.codigo} · ${p.peso} %`), p.descripcion ? h('span', { class: 'meta' }, p.descripcion) : null, h('span', { class: 'meta' }, p.total ? frase(necesitoEnParte(modelo.partes[i], estado.objetivo)) : 'Sin evaluaciones')),
                h('span', { class: `pastilla ${p.nota == null ? '' : p.nota >= 5 ? 'aprobado' : 'suspendido'}` }, textoNota(p.nota)),
              ),
            ),
          ),
          h('p', { class: 'resultado-necesito' }, h('b', {}, `Para un ${estado.objetivo} en el módulo: `), total.nota == null ? total.motivo : total.imposible ? `imposible. ${total.motivo || `Haría falta un ${textoNota(total.nota)}`}.` : total.nota <= 0 ? 'ya lo tienes.' : `necesitas un ${textoNota(total.nota)} en todo lo que queda.`),
        )
      : null,

    pendientes.length
      ? h(
          'section',
          { class: 'seccion' },
          h('h2', {}, 'Simulador'),
          campo('Si en…', h('select', { onchange: (e) => { estado.simulada = e.target.value; repintar(); } }, pendientes.map((e) => h('option', { value: e.id, selected: e.id === estado.simulada }, e.titulo)))),
          campo(`…saco un ${textoNota(estado.notaSimulada)}`, h('input', { type: 'range', min: 0, max: 10, step: 0.5, value: estado.notaSimulada, onchange: (e) => { estado.notaSimulada = Number(e.target.value); repintar(); } })),
          h('p', { class: 'resultado-necesito' }, h('b', {}, 'El módulo quedaría en '), h('span', { class: `pastilla ${claseNota(simulado)}` }, textoNota(simulado.nota)), simulado.suspensas.length ? ` · ${simulado.suspensas.join(', ')} seguiría por debajo de 5` : ''),
          h('div', { class: 'chips' }, simulado.partes.filter((p) => p.nota != null).map((p) => h('span', { class: `pastilla ${p.nota >= 5 ? 'aprobado' : 'suspendido'}` }, `${p.codigo}: ${textoNota(p.nota)}`))),
        )
      : null,

    h(
      'section',
      { class: 'seccion', style: `--c:${modulo.color}` },
      h('div', { class: 'seccion-cabecera' }, h('h2', {}, 'Faltas'), h('button', { type: 'button', class: 'enlace', onclick: () => abrirFalta(modulo) }, 'Añadir falta')),
      barraFaltas(d.asistencia),
      d.faltas.length
        ? h(
            'div',
            { class: 'grupo' },
            d.faltas.map((f) =>
              h(
                'div',
                { class: 'fila-ra' },
                h('span', { class: 'cuerpo' }, h('b', {}, fechaCorta(`${f.fecha}T12:00`)), h('span', { class: 'meta' }, `${f.horas} h · ${f.justificada ? 'justificada' : 'sin justificar'}`)),
                h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Borrar falta', onclick: async () => confirm('¿Borrar esta falta?') && repoFaltas.borrar(f.id) }, icono('papelera')),
              ),
            ),
          )
        : null,
    ),
  );
}

/** Hoja rápida para apuntar una falta (por defecto, hoy y 1 hora). */
function abrirFalta(modulo) {
  const error = h('p', { class: 'error', role: 'alert' });
  const form = h(
    'form',
    { class: 'formulario', onsubmit: guardar },
    h('div', { class: 'dos' }, campo('Día', h('input', { name: 'fecha', type: 'date', value: hoy(), required: true })), campo('Horas', h('input', { name: 'horas', type: 'number', min: 0.5, max: 12, step: 0.5, value: 1, inputmode: 'decimal', required: true }))),
    h('label', { class: 'renglon elegir suelto' }, h('input', { type: 'checkbox', class: 'casilla', name: 'justificada' }), h('span', {}, 'Está justificada')),
    error,
    h('div', { class: 'hoja-pie' }, h('button', { type: 'submit', class: 'boton primario' }, 'Guardar falta')),
  );
  const hoja = abrirHoja(`Falta en ${modulo.abreviatura}`, form);
  async function guardar(e) {
    e.preventDefault();
    const d = new FormData(form);
    const horas = Number(d.get('horas'));
    if (!d.get('fecha') || !(horas > 0 && horas <= 12)) return (error.textContent = 'Pon el día y entre 0,5 y 12 horas.');
    await repoFaltas.guardar({ modulo_id: modulo.id, fecha: d.get('fecha'), horas, justificada: d.has('justificada') });
    hoja.close();
  }
}
