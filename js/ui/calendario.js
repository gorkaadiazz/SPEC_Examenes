// Pantalla "Calendario": vista de mes y de semana con las evaluaciones
// coloreadas por módulo, y exportación a .ics (sección 4.3).

import { h, poner, opciones } from '../utils/dom.js';
import { generarICS } from '../utils/ics.js';
import { hoy } from '../tools/repaso.js';
import * as repoModulos from '../repos/modulos.js';
import * as repoEvaluaciones from '../repos/evaluaciones.js';
import * as repoPerfil from '../repos/perfil.js';
import { TIPOS, etiqueta } from '../repos/evaluaciones.js';
import { publicacion, abrirFormulario } from './evaluaciones.js';
import { icono } from './iconos.js';

const estado = { vista: 'mes', ref: new Date(), dia: hoy() };
const repintar = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
const clave = (d) => hoy(d); // "2026-11-12"
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Lunes de la semana de una fecha. */
function lunes(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Descarga un texto como archivo. */
export function descargar(nombre, contenido, tipo = 'text/plain') {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  h('a', { href: url, download: nombre }).click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function render(cont) {
  const [modulos, lista, perfil] = await Promise.all([repoModulos.listar(), repoEvaluaciones.listar(), repoPerfil.obtener()]);
  const porId = new Map(modulos.map((m) => [m.id, m]));
  const porDia = new Map();
  for (const e of lista) {
    const k = clave(new Date(e.fecha));
    if (!porDia.has(k)) porDia.set(k, []);
    porDia.get(k).push(e);
  }

  const ref = estado.ref;
  const esMes = estado.vista === 'mes';
  const inicio = esMes ? lunes(new Date(ref.getFullYear(), ref.getMonth(), 1)) : lunes(ref);
  const nDias = esMes ? 42 : 7;
  const dias = Array.from({ length: nDias }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
  const titulo = esMes
    ? ref.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : `${dias[0].getDate()} – ${dias[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`;
  const mover = (n) => {
    estado.ref = esMes ? new Date(ref.getFullYear(), ref.getMonth() + n, 1) : new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 7 * n);
    repintar();
  };

  const selVista = opciones('Vista', 'vista', [['mes', 'Mes'], ['semana', 'Semana']], estado.vista, 'segmentos');
  selVista.querySelector('legend').classList.add('oculto');
  selVista.addEventListener('change', (e) => { estado.vista = e.target.value; if (estado.vista === 'semana') estado.ref = new Date(`${estado.dia}T12:00`); repintar(); });

  const celda = (d) => {
    const k = clave(d);
    const evs = porDia.get(k) ?? [];
    return h(
      'button',
      { type: 'button', class: `dia-cal ${k === hoy() ? 'hoy' : ''} ${k === estado.dia ? 'elegido' : ''} ${esMes && d.getMonth() !== ref.getMonth() ? 'fuera' : ''}`, 'aria-label': `${d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}${evs.length ? `, ${evs.length} evaluaciones` : ''}`, 'aria-pressed': String(k === estado.dia), onclick: () => { estado.dia = k; repintar(); } },
      h('span', { class: 'dia-num num' }, String(d.getDate())),
      h('span', { class: 'dia-puntos' }, evs.slice(0, 4).map((e) => h('i', { style: `--c:${porId.get(e.modulo_id)?.color ?? '#888'}` }))),
    );
  };

  const delDia = porDia.get(estado.dia) ?? [];
  const fechaElegida = new Date(`${estado.dia}T12:00`);

  const exportar = () => {
    const futuras = lista.filter((e) => e.estado === 'pendiente' && new Date(e.fecha) >= new Date(Date.now() - 86_400_000));
    if (!futuras.length) return alert('No hay evaluaciones pendientes que exportar.');
    descargar('examenes-2smr.ics', generarICS(futuras.map((e) => ({ ...e, modulo: porId.get(e.modulo_id), tipoTexto: etiqueta(TIPOS, e.tipo) })), { diasAviso: perfil.preferencias.dias_aviso }), 'text/calendar');
  };

  poner(
    cont,
    h('header', { class: 'barra-superior' }, h('h1', { class: 'titulo-pantalla' }, 'Calendario'), h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Exportar a Google Calendar (.ics)', title: 'Exportar a Google Calendar (.ics)', onclick: exportar }, icono('instalar'))),
    selVista,
    h(
      'div',
      { class: 'cal-cabecera' },
      h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Anterior', onclick: () => mover(-1) }, icono('atras')),
      h('h2', { class: 'cal-titulo' }, titulo.replace(/^./, (c) => c.toUpperCase())),
      h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Siguiente', onclick: () => mover(1) }, icono('flecha')),
    ),
    h('div', { class: `cal ${estado.vista}` }, DIAS.map((d) => h('span', { class: 'cal-dia-semana', 'aria-hidden': 'true' }, d)), dias.map(celda)),
    h(
      'section',
      { class: 'seccion' },
      h('div', { class: 'seccion-cabecera' }, h('h2', {}, fechaElegida.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase())), h('button', { type: 'button', class: 'enlace', onclick: () => abrirFormulario(null, { fecha: new Date(`${estado.dia}T08:30`).toISOString() }) }, 'Apuntar algo')),
      delDia.length ? h('div', { class: 'grupo' }, delDia.map((e) => publicacion(e, porId.get(e.modulo_id), null, {}))) : h('p', { class: 'ayuda' }, 'Nada este día.'),
    ),
    h('p', { class: 'ayuda' }, 'El botón de arriba descarga un archivo .ics con lo pendiente. Ábrelo con Google Calendar para que te avise aunque la app esté cerrada.'),
  );
}
