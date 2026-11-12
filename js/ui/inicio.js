// Pantalla de inicio, como el feed de una red social:
//  barra superior · historias de los módulos · lo de esta semana como
//  publicaciones · lo que viene más adelante en una lista compacta.

import { h, poner } from '../utils/dom.js';
import { diasHasta } from '../utils/fechas.js';
import * as repoModulos from '../repos/modulos.js';
import * as repo from '../repos/evaluaciones.js';
import * as repoArchivos from '../repos/archivos.js';
import { avatar, post, publicacion, abrirFormulario } from './evaluaciones.js';
import { icono } from './iconos.js';
import { resumenes } from './notas.js';

const DIAS_PROXIMO = 7;
const MAS_ADELANTE = 5; // cuántas se enseñan en "Más adelante"
let moduloFiltrado = null; // id del módulo cuya "historia" está pulsada

/** Indicador de sincronización (lo actualiza app.js con cada cambio de estado). */
function estadoDatos() {
  return h('span', { class: 'estado-datos', 'data-estado-sync': '', 'aria-live': 'polite' });
}

/** Fila de historias: "Todos" + un círculo por módulo. */
function historias(modulos, proximas, repintar) {
  const cuantas = (id) => proximas.filter((e) => e.modulo_id === id).length;
  const historia = (id, nombre, circulo, n, color, i) =>
    h(
      'button',
      {
        type: 'button',
        class: 'historia',
        style: `${color ? `--c:${color};` : ''}--i:${i}`,
        'aria-pressed': String(moduloFiltrado === id),
        'aria-label': id ? `${nombre}: ${n} esta semana` : 'Ver todos los módulos',
        onclick: () => {
          moduloFiltrado = moduloFiltrado === id ? null : id;
          repintar();
        },
      },
      h('span', { class: 'marco' }, h('span', { class: `anillo ${n ? 'activo' : ''}` }, circulo), n ? h('span', { class: 'contador' }, String(n)) : null),
      h('span', { class: 'nombre' }, nombre),
    );
  return h(
    'nav',
    { class: 'historias', 'aria-label': 'Filtrar por módulo', 'data-conservar-scroll': 'historias' },
    historia(null, 'Todos', h('span', { class: 'avatar todos' }, icono('todos')), 0, null, 0),
    modulos.map((m, i) => historia(m.id, m.abreviatura, avatar(m), cuantas(m.id), m.color, i + 1)),
  );
}

export async function render(cont) {
  const ahora = new Date();
  const [modulos, lista, temas, apuntes] = await Promise.all([repoModulos.listar(), repo.listar(), repo.temasPorEvaluacion(), repoArchivos.contarPorEvaluacion()]);
  const porId = new Map(modulos.map((m) => [m.id, m]));
  if (moduloFiltrado && !porId.has(moduloFiltrado)) moduloFiltrado = null;
  const elegido = porId.get(moduloFiltrado);

  const sinHacer = lista.filter((e) => e.estado === 'pendiente');
  const atrasadas = sinHacer.filter((e) => new Date(e.fecha) < ahora);
  const futuras = sinHacer.filter((e) => new Date(e.fecha) >= ahora);
  const proximas = futuras.filter((e) => diasHasta(e.fecha, ahora) <= DIAS_PROXIMO);
  const delFiltro = futuras.filter((e) => !moduloFiltrado || e.modulo_id === moduloFiltrado);
  const estaSemana = delFiltro.filter((e) => diasHasta(e.fecha, ahora) <= DIAS_PROXIMO);
  const despues = delFiltro.filter((e) => diasHasta(e.fecha, ahora) > DIAS_PROXIMO);

  const repintar = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

  // Alertas de riesgo: un RA por debajo de 5 o las faltas cerca del límite
  const riesgos = [];
  for (const d of await resumenes()) {
    if (d.notas.suspensas.length) riesgos.push({ modulo: d.modulo.abreviatura, grave: true, texto: `${d.notas.suspensas.join(', ')} por debajo de 5` });
    if (d.asistencia.nivel !== 'ok') riesgos.push({ modulo: d.modulo.abreviatura, grave: d.asistencia.nivel === 'peligro', texto: d.asistencia.quedan > 0 ? `te quedan ${d.asistencia.quedan} h de faltas` : 'has superado el límite de faltas' });
  }

  poner(
    cont,
    h(
      'header',
      { class: 'barra-superior' },
      h('h1', { class: 'marca-app' }, 'Exámenes'),
      h(
        'div',
        { class: 'acciones-superior' },
        h('a', { class: 'boton-icono', href: '#/estudiar', 'aria-label': 'Estudiar', title: 'Estudiar' }, icono('estudiar')),
        h('a', { class: 'boton-icono', href: '#/evaluaciones', 'aria-label': 'Todas las evaluaciones', title: 'Todas las evaluaciones' }, icono('lista')),
      ),
    ),

    historias(modulos, proximas, repintar),

    atrasadas.length
      ? h(
          'a',
          { class: 'aviso', href: '#/evaluaciones' },
          icono('alerta'),
          h('span', {}, h('b', {}, `${atrasadas.length} ${atrasadas.length === 1 ? 'evaluación ya pasó' : 'evaluaciones ya pasaron'}`), ' y siguen como pendientes'),
          h('span', { class: 'ir' }, 'Revisar'),
        )
      : null,

    riesgos.map((r) => h('a', { class: `aviso ${r.grave ? 'grave' : ''}`, href: '#/notas' }, icono('alerta'), h('span', {}, h('b', {}, `${r.modulo}: `), r.texto), h('span', { class: 'ir' }, 'Ver'))),

    estaSemana.length
      ? h('section', { class: 'feed', 'aria-label': 'Esta semana' }, estaSemana.map((e) => post(e, porId.get(e.modulo_id), temas.get(e.id) ?? [], apuntes.get(e.id) ?? 0, ahora)))
      : h(
          'div',
          { class: 'vacio' },
          h('span', { class: 'vacio-icono' }, icono('calendario')),
          h('h2', {}, elegido ? `Nada de ${elegido.abreviatura} esta semana` : 'Nada esta semana'),
          h('p', {}, despues.length ? 'Lo siguiente está más abajo.' : 'Cuando el profe anuncie un examen o una entrega, apúntalo aquí.'),
          h('button', { type: 'button', class: 'enlace', onclick: () => abrirFormulario(null, elegido ? { modulo_id: elegido.id } : {}) }, elegido ? `Apuntar algo de ${elegido.abreviatura}` : 'Apuntar un examen'),
        ),

    despues.length
      ? h(
          'section',
          { class: 'seccion' },
          h('div', { class: 'seccion-cabecera' }, h('h2', {}, 'Más adelante'), h('a', { class: 'enlace', href: '#/evaluaciones' }, 'Ver todo')),
          h('div', { class: 'grupo' }, despues.slice(0, MAS_ADELANTE).map((e) => publicacion(e, porId.get(e.modulo_id), temas.get(e.id), { conFecha: true, ahora }))),
        )
      : null,

    h('p', { class: 'pie-estado' }, estadoDatos()),
  );
}
