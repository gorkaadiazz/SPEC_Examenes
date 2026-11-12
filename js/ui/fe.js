// Pantalla "Formación en Empresa" (sección 5.1): horas exigidas, registro
// diario de horas y tareas, progreso, fecha estimada de fin y exportación.

import { h, poner, campo, abrirHoja } from '../utils/dom.js';
import { fechaCorta } from '../utils/fechas.js';
import { hoy } from '../tools/repaso.js';
import * as repoPerfil from '../repos/perfil.js';
import { feRegistros as repo } from '../repos/varios.js';
import { descargar } from './calendario.js';
import { icono } from './iconos.js';

const num = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

/**
 * Fecha estimada de fin: con la media de horas por día registrado, cuántos
 * días laborables (de lunes a viernes) faltan desde el último registro.
 */
export function finEstimado(registros, horasTotales, desde = new Date()) {
  const hechas = registros.reduce((a, r) => a + Number(r.horas), 0);
  if (!registros.length || hechas >= horasTotales) return null;
  const media = hechas / registros.length;
  let dias = Math.ceil((horasTotales - hechas) / media);
  const d = new Date(desde);
  while (dias > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) dias -= 1;
  }
  return d;
}

export async function render(cont) {
  const [perfil, registros] = await Promise.all([repoPerfil.obtener(), repo.todos()]);
  const fe = perfil.preferencias.fe;
  registros.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const hechas = registros.reduce((a, r) => a + Number(r.horas), 0);
  const pct = fe.horas_totales > 0 ? Math.min(100, Math.round((hechas / fe.horas_totales) * 100)) : 0;
  const fin = finEstimado(registros, fe.horas_totales, registros[0] ? new Date(`${registros[0].fecha}T12:00`) : new Date());

  const exportarCSV = () => descargar('formacion-en-empresa.csv', '﻿Fecha;Horas;Tareas\r\n' + [...registros].reverse().map((r) => `${r.fecha};${String(r.horas).replace('.', ',')};"${(r.tareas ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`).join('\r\n'), 'text/csv');
  const exportarTexto = () => descargar('formacion-en-empresa.txt', [...registros].reverse().map((r) => `${fechaCorta(`${r.fecha}T12:00`)} (${num(r.horas)} h)\n${r.tareas ?? ''}`).join('\n\n'));

  poner(
    cont,
    h('header', { class: 'barra-superior' }, h('h1', { class: 'titulo-pantalla' }, 'Formación en Empresa'), h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Configurar horas y fechas', title: 'Configurar', onclick: () => abrirConfig(fe) }, icono('ajustes'))),
    h(
      'section',
      { class: 'seccion' },
      h('div', { class: 'nota-final' }, h('b', { class: 'num' }, `${pct} %`), h('span', {}, `${num(hechas)} de ${num(fe.horas_totales)} horas`)),
      h('span', { class: 'barra barra-gruesa', role: 'img', 'aria-label': `${pct} % de las horas hechas` }, h('span', { style: `transform:scaleX(${pct / 100})` })),
      h('p', { class: 'ayuda' }, [fe.inicio ? `Empieza el ${fechaCorta(`${fe.inicio}T12:00`)}` : null, fe.fin ? `termina el ${fechaCorta(`${fe.fin}T12:00`)}` : null, hechas >= fe.horas_totales && registros.length ? 'Horas completadas.' : fin ? `A este ritmo acabas hacia el ${fechaCorta(fin)}` : 'Apunta tus primeras horas para ver la fecha estimada de fin'].filter(Boolean).join(' · ')),
      h('button', { type: 'button', class: 'boton primario ancho', onclick: () => abrirRegistro() }, 'Apuntar el día de hoy'),
    ),
    h(
      'section',
      { class: 'seccion' },
      h('div', { class: 'seccion-cabecera' }, h('h2', {}, 'Diario'), registros.length ? h('span', { class: 'fila' }, h('button', { type: 'button', class: 'enlace', onclick: exportarCSV }, 'CSV'), h('button', { type: 'button', class: 'enlace', onclick: exportarTexto }, 'Texto')) : null),
      registros.length
        ? h('div', { class: 'grupo' }, registros.map((r) => h('button', { type: 'button', class: 'publicacion', onclick: () => abrirRegistro(r) }, h('span', { class: 'cuerpo' }, h('span', { class: 'titulo' }, fechaCorta(`${r.fecha}T12:00`)), h('span', { class: 'meta dos-lineas' }, r.tareas || 'Sin tareas apuntadas')), h('span', { class: 'pastilla' }, `${num(r.horas)} h`))))
        : h('p', { class: 'ayuda' }, 'Aquí irá lo que hagas cada día. Te servirá para el diario o la memoria de prácticas.'),
    ),
  );
}

function abrirRegistro(registro = null) {
  const error = h('p', { class: 'error', role: 'alert' });
  const form = h(
    'form',
    { class: 'formulario', onsubmit: guardar },
    h('div', { class: 'dos' }, campo('Día', h('input', { name: 'fecha', type: 'date', value: registro?.fecha ?? hoy(), required: true })), campo('Horas', h('input', { name: 'horas', type: 'number', min: 0.5, max: 24, step: 0.5, inputmode: 'decimal', value: registro?.horas ?? 8, required: true }))),
    campo('Tareas realizadas', h('textarea', { name: 'tareas', rows: 5, maxlength: 2000, placeholder: 'Qué has hecho hoy' }, registro?.tareas ?? '')),
    error,
    h('div', { class: 'hoja-pie' }, registro ? h('button', { type: 'button', class: 'boton peligro redondo', 'aria-label': 'Borrar este día', onclick: borrar }, icono('papelera')) : null, h('button', { type: 'submit', class: 'boton primario' }, 'Guardar')),
  );
  const hoja = abrirHoja(registro ? 'Editar día' : 'Apuntar día', form);
  async function guardar(e) {
    e.preventDefault();
    const d = new FormData(form);
    const horas = Number(d.get('horas'));
    if (!d.get('fecha') || !(horas > 0 && horas <= 24)) return (error.textContent = 'Pon el día y entre 0,5 y 24 horas.');
    await repo.guardar({ ...(registro ?? {}), fecha: d.get('fecha'), horas, tareas: d.get('tareas').trim() });
    hoja.close();
  }
  async function borrar() {
    if (!confirm('¿Borrar este día del diario?')) return;
    await repo.borrar(registro.id);
    hoja.close();
  }
}

function abrirConfig(fe) {
  const form = h(
    'form',
    { class: 'formulario', onsubmit: guardar },
    campo('Horas totales exigidas', h('input', { name: 'horas_totales', type: 'number', min: 1, max: 2000, step: 1, inputmode: 'numeric', value: fe.horas_totales, required: true })),
    h('div', { class: 'dos' }, campo('Fecha de inicio', h('input', { name: 'inicio', type: 'date', value: fe.inicio })), campo('Fecha de fin', h('input', { name: 'fin', type: 'date', value: fe.fin }))),
    h('div', { class: 'hoja-pie' }, h('button', { type: 'submit', class: 'boton primario' }, 'Guardar')),
  );
  const hoja = abrirHoja('Formación en Empresa', form);
  async function guardar(e) {
    e.preventDefault();
    const d = new FormData(form);
    await repoPerfil.guardar({}, { fe: { horas_totales: Math.max(1, Number(d.get('horas_totales')) || 400), inicio: d.get('inicio'), fin: d.get('fin') } });
    hoja.close();
  }
}
