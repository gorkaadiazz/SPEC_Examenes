// Pantalla de inicio: historias de los módulos, lo siguiente en grande y el
// resto de la semana agrupado por días.

import { h, poner } from '../utils/dom.js';
import { cuandoLargo, diasHasta, fechaLarga, hora, saludo } from '../utils/fechas.js';
import { porcentajePreparado } from '../utils/progreso.js';
import { pendientes } from '../sync/cola.js';
import * as repoModulos from '../repos/modulos.js';
import * as repo from '../repos/evaluaciones.js';
import { TIPOS, etiqueta } from '../repos/evaluaciones.js';
import { avatar, feedPorDias, abrirFormulario } from './evaluaciones.js';
import { icono } from './iconos.js';

const DIAS_PROXIMO = 7;
let moduloFiltrado = null; // id del módulo cuya "historia" está pulsada

/** Punto de estado de los datos (hasta la fase 3 todo vive en el dispositivo). */
function estadoDatos(n) {
  const texto = !navigator.onLine ? `Sin conexión · ${n} sin subir` : 'Guardado en este dispositivo';
  return h('span', { class: `estado-datos ${navigator.onLine ? 'ok' : ''}`, title: `${n} cambios esperando a la sincronización (fase 3)` }, texto);
}

/** Fila de historias: "Todos" + un círculo por módulo. */
function historias(modulos, proximas, repintar) {
  const cuantas = (id) => proximas.filter((e) => e.modulo_id === id).length;
  const historia = (id, nombre, circulo, n, color) =>
    h(
      'button',
      { type: 'button', class: 'historia', style: color ? `--c:${color}` : null, 'aria-pressed': String(moduloFiltrado === id), 'aria-label': id ? `${nombre}: ${n} esta semana` : 'Ver todos los módulos', onclick: () => { moduloFiltrado = moduloFiltrado === id ? null : id; repintar(); } },
      h('span', { class: 'marco' }, h('span', { class: `anillo ${n ? 'activo' : ''}` }, circulo), n ? h('span', { class: 'contador' }, String(n)) : null),
      h('span', { class: 'nombre' }, nombre),
    );
  return h(
    'nav',
    { class: 'historias', 'aria-label': 'Filtrar por módulo' },
    historia(null, 'Todos', h('span', { class: 'avatar todos' }, icono('todos')), 0),
    modulos.map((m) => historia(m.id, m.abreviatura, avatar(m), cuantas(m.id), m.color)),
  );
}

/** La publicación grande: lo siguiente que tienes. */
function destacada(ev, modulo, temas, ahora) {
  const pct = porcentajePreparado(temas);
  const hechos = temas?.filter((t) => t.estudiado).length ?? 0;
  return h(
    'button',
    { type: 'button', class: 'destacada', style: `--c:${modulo?.color ?? '#888'}`, onclick: () => abrirFormulario(ev) },
    h('span', { class: 'autor' }, avatar(modulo), h('span', {}, h('b', {}, modulo?.nombre ?? 'Sin módulo'), h('span', {}, etiqueta(TIPOS, ev.tipo)))),
    h('span', { class: 'cuando' }, cuandoLargo(ev.fecha, ahora), h('small', {}, `a las ${hora(ev.fecha)}`)),
    h('span', { class: 'titulo' }, ev.titulo),
    pct != null
      ? h('span', { class: 'estudiado' }, h('span', { class: 'fila separa' }, h('span', {}, `${hechos} de ${temas.length} temas estudiados`), h('b', { class: 'num' }, `${pct} %`)), h('span', { class: 'barra' }, h('span', { style: `width:${pct}%` })))
      : h('span', { class: 'estudiado' }, 'Toca para apuntar los temas que entran'),
  );
}

export async function render(cont) {
  const ahora = new Date();
  const [modulos, lista, temas, nPendientes] = await Promise.all([repoModulos.listar(), repo.listar(), repo.temasPorEvaluacion(), pendientes()]);
  const porId = new Map(modulos.map((m) => [m.id, m]));
  if (moduloFiltrado && !porId.has(moduloFiltrado)) moduloFiltrado = null;

  const sinHacer = lista.filter((e) => e.estado === 'pendiente');
  const atrasadas = sinHacer.filter((e) => new Date(e.fecha) < ahora);
  const futuras = sinHacer.filter((e) => new Date(e.fecha) >= ahora);
  const proximas = futuras.filter((e) => diasHasta(e.fecha, ahora) <= DIAS_PROXIMO);
  const delFiltro = futuras.filter((e) => !moduloFiltrado || e.modulo_id === moduloFiltrado);
  const [siguiente, ...resto] = delFiltro;
  const restoSemana = resto.filter((e) => diasHasta(e.fecha, ahora) <= DIAS_PROXIMO);
  const elegido = porId.get(moduloFiltrado);

  const repintar = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

  poner(
    cont,
    h(
      'header',
      { class: 'cabecera' },
      h('div', { class: 'saludo' }, h('h1', {}, saludo(ahora)), h('p', {}, fechaLarga(ahora))),
      h('a', { class: 'boton redondo solo-movil', href: '#/perfil', 'aria-label': 'Tu perfil y tus módulos' }, icono('perfil')),
    ),

    historias(modulos, proximas, repintar),

    atrasadas.length
      ? h('a', { class: 'aviso', href: '#/evaluaciones' }, icono('alerta'), h('span', {}, h('b', {}, `${atrasadas.length} ${atrasadas.length === 1 ? 'evaluación pasada' : 'evaluaciones pasadas'}`), ' sin nota ni estado'), h('span', { class: 'ir' }, 'Revisar'))
      : null,

    siguiente
      ? destacada(siguiente, porId.get(siguiente.modulo_id), temas.get(siguiente.id), ahora)
      : h(
          'div',
          { class: 'vacio' },
          icono('chispa'),
          h('h3', {}, elegido ? `Nada pendiente de ${elegido.abreviatura}` : 'Todo al día'),
          h('p', {}, 'Cuando el profe anuncie un examen o una entrega, apúntalo aquí y te avisaremos.'),
          h('button', { type: 'button', class: 'boton primario', onclick: () => abrirFormulario(null, elegido ? { modulo_id: elegido.id } : {}) }, icono('mas'), elegido ? `Apuntar algo de ${elegido.abreviatura}` : 'Apuntar examen'),
        ),

    restoSemana.length ? h('div', { class: 'seccion' }, h('h2', {}, 'Esta semana'), feedPorDias(restoSemana, porId, temas, ahora)) : null,

    siguiente && !restoSemana.length && resto.length
      ? h('p', { class: 'suave pequeno' }, `Después: ${resto[0].titulo}, ${cuandoLargo(resto[0].fecha, ahora).toLowerCase()}.`)
      : null,

    h('p', { class: 'fila' }, estadoDatos(nPendientes)),
  );
}
