// Pantalla de inicio: avisos urgentes, "lo próximo" (7 días) y resumen por módulo.

import { h, poner } from '../utils/dom.js';
import { diasHasta, formatoFecha } from '../utils/fechas.js';
import { pendientes } from '../sync/cola.js';
import * as repoModulos from '../repos/modulos.js';
import * as repo from '../repos/evaluaciones.js';
import { tarjeta, abrirFormulario } from './evaluaciones.js';

const DIAS_PROXIMO = 7;

/** Indicador discreto del estado de los datos. */
function indicadorSinc(nPendientes) {
  // Hasta la fase 3 no hay servidor: todo vive en este dispositivo y los
  // cambios se van apuntando en la cola para subirlos cuando exista.
  const cambios = `${nPendientes} ${nPendientes === 1 ? 'cambio pendiente' : 'cambios pendientes'}`;
  const texto = navigator.onLine ? `○ solo en este dispositivo (${cambios})` : `○ sin conexión (${cambios})`;
  return h('p', { class: 'sinc', title: 'La sincronización con la nube llega en la fase 3' }, texto);
}

export async function render(cont) {
  const ahora = new Date();
  const [modulos, lista, temas, nPendientes] = await Promise.all([repoModulos.listar(), repo.listar(), repo.temasPorEvaluacion(), pendientes()]);
  const porId = new Map(modulos.map((m) => [m.id, m]));
  const sinHacer = lista.filter((e) => e.estado === 'pendiente');

  const atrasadas = sinHacer.filter((e) => new Date(e.fecha) < ahora);
  const futuras = sinHacer.filter((e) => new Date(e.fecha) >= ahora);
  const urgentes = futuras.filter((e) => diasHasta(e.fecha, ahora) <= 1);
  const proximas = futuras.filter((e) => diasHasta(e.fecha, ahora) <= DIAS_PROXIMO);

  const linea = (e, cuando) => h('p', {}, h('strong', {}, `${cuando}: `), `[${porId.get(e.modulo_id)?.abreviatura ?? '?'}] ${e.titulo}`, h('span', { class: 'mono tenue' }, ` · ${formatoFecha(e.fecha).split(' · ')[1]}`));

  poner(cont,
    h(
      'header',
      { class: 'cabecera' },
      h('div', {}, h('h1', { class: 'titulo-app' }, '2smr@ribera:~$', h('span', { class: 'cursor', 'aria-hidden': 'true' })), indicadorSinc(nPendientes)),
      h('button', { type: 'button', class: 'boton primario', onclick: () => abrirFormulario() }, '+ Nueva'),
    ),

    urgentes.length ? h('div', { class: 'banner', role: 'status' }, urgentes.map((e) => linea(e, diasHasta(e.fecha, ahora) === 0 ? 'Hoy' : 'Mañana'))) : null,

    atrasadas.length
      ? h(
          'div',
          { class: 'banner peligro' },
          h('p', {}, h('strong', {}, `${atrasadas.length} ${atrasadas.length === 1 ? 'evaluación pasada sigue' : 'evaluaciones pasadas siguen'} como pendiente. `), h('a', { href: '#/evaluaciones' }, 'Revisar')),
        )
      : null,

    h(
      'section',
      { class: 'seccion' },
      h('h2', {}, `Lo próximo · ${DIAS_PROXIMO} días`),
      proximas.length
        ? h('div', { class: 'lista' }, proximas.map((e) => tarjeta(e, porId.get(e.modulo_id), temas.get(e.id), ahora)))
        : h('p', { class: 'vacio' }, futuras.length ? `Nada en los próximos ${DIAS_PROXIMO} días. Lo siguiente: ${futuras[0].titulo} (${formatoFecha(futuras[0].fecha)}).` : 'No hay nada pendiente. Añade tu próximo examen o entrega con «+ Nueva».'),
    ),

    h(
      'section',
      { class: 'seccion' },
      h('div', { class: 'cabecera' }, h('h2', {}, 'Módulos'), h('a', { class: 'pequeno', href: '#/modulos' }, 'editar')),
      h(
        'div',
        { class: 'rejilla' },
        modulos.map((m) => {
          const suyas = futuras.filter((e) => e.modulo_id === m.id);
          return h(
            'div',
            { class: 'tarjeta modulo', style: `--color-modulo:${m.color}` },
            h('span', { class: 'etiqueta' }, `[${m.abreviatura}]`),
            h('span', { class: 'nombre' }, m.nombre),
            h('span', { class: 'dato' }, 'pendientes', h('b', {}, String(suyas.length))),
            // Nota actual y % de faltas se calculan en la fase 4.
            h('span', { class: 'dato' }, 'nota', h('b', {}, '—')),
            h('span', { class: 'dato' }, 'faltas', h('b', {}, '—')),
          );
        }),
      ),
    ),
  );
}
