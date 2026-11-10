// Evaluaciones: publicaciones del feed, lista completa y formulario.

import { h, poner, campo, opciones, abrirHoja, enlaceSeguro } from '../utils/dom.js';
import { cuandoCorto, diasHasta, diaSemana, fechaCorta, hora, aInputs, deInputs } from '../utils/fechas.js';
import { porcentajePreparado } from '../utils/progreso.js';
import * as repoModulos from '../repos/modulos.js';
import * as repo from '../repos/evaluaciones.js';
import { TIPOS, PERIODOS, ESTADOS, etiqueta } from '../repos/evaluaciones.js';
import { icono } from './iconos.js';

/** Avatar redondo de un módulo con su abreviatura. */
export function avatar(modulo, extra = '') {
  return h('span', { class: `avatar ${extra}`, style: modulo ? `--c:${modulo.color}` : null, 'aria-hidden': 'true' }, modulo?.abreviatura ?? '?');
}

/** Pastilla con cuánto falta (o el estado si ya no está pendiente). */
export function pastilla(ev, ahora = new Date()) {
  if (ev.estado !== 'pendiente') return h('span', { class: `pastilla ${ev.estado}` }, ev.nota != null ? `${ev.nota}` : etiqueta(ESTADOS, ev.estado));
  const pasada = new Date(ev.fecha) < ahora;
  const dias = diasHasta(ev.fecha, ahora);
  return h('span', { class: `pastilla ${pasada ? 'pasada' : dias <= 1 ? 'urgente' : ''}` }, cuandoCorto(ev.fecha, ahora));
}

/** Una evaluación como fila del feed. Al pulsarla se abre para editar. */
export function publicacion(ev, modulo, temas, { conFecha = false, ahora = new Date() } = {}) {
  const pct = porcentajePreparado(temas);
  const meta = [etiqueta(TIPOS, ev.tipo), conFecha ? `${fechaCorta(ev.fecha)}, ${hora(ev.fecha)}` : hora(ev.fecha)].join(' · ');
  return h(
    'button',
    { type: 'button', class: 'publicacion', style: modulo ? `--c:${modulo.color}` : null, onclick: () => abrirFormulario(ev) },
    avatar(modulo),
    h(
      'span',
      { class: 'cuerpo' },
      h('span', { class: 'titulo' }, ev.titulo),
      h('span', { class: 'meta' }, meta),
      pct != null && ev.estado === 'pendiente' ? h('span', { class: 'barra', role: 'img', 'aria-label': `${pct} % estudiado` }, h('span', { style: `width:${pct}%` })) : null,
    ),
    pastilla(ev, ahora),
  );
}

/** Agrupa evaluaciones por día y devuelve los bloques del feed. */
export function feedPorDias(lista, porId, temas, ahora = new Date()) {
  const dias = new Map();
  for (const ev of lista) {
    const clave = new Date(ev.fecha).toDateString();
    if (!dias.has(clave)) dias.set(clave, []);
    dias.get(clave).push(ev);
  }
  return [...dias.values()].map((evs) => {
    const n = diasHasta(evs[0].fecha, ahora);
    const pista = n === 0 ? 'hoy' : n === 1 ? 'mañana' : null;
    return h(
      'section',
      { class: 'dia' },
      h('h3', {}, diaSemana(evs[0].fecha), pista ? h('span', {}, ` · ${pista}`) : null),
      h('div', { class: 'grupo' }, evs.map((ev) => publicacion(ev, porId.get(ev.modulo_id), temas.get(ev.id), { ahora }))),
    );
  });
}

// Filtros de la lista completa (se conservan mientras la app esté abierta)
const filtro = { estado: 'pendiente' };

/** Pantalla "Evaluaciones": todo, con filtro por estado. */
export async function render(cont) {
  const [modulos, lista, temas] = await Promise.all([repoModulos.listar(), repo.listar(), repo.temasPorEvaluacion()]);
  const porId = new Map(modulos.map((m) => [m.id, m]));
  const visibles = lista.filter((e) => !filtro.estado || e.estado === filtro.estado);
  if (filtro.estado !== 'pendiente') visibles.reverse(); // lo hecho, de lo más reciente a lo más antiguo

  const filtros = opciones('Mostrar', 'filtro-estado', [['pendiente', 'Pendientes'], ['', 'Todas'], ['aprobado', 'Aprobadas'], ['suspendido', 'Suspendidas']], filtro.estado, 'segmentos');
  filtros.querySelector('legend').classList.add('oculto');
  filtros.addEventListener('change', (e) => {
    filtro.estado = e.target.value;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  poner(
    cont,
    h('header', { class: 'cabecera' }, h('h1', {}, 'Evaluaciones'), h('button', { type: 'button', class: 'boton primario', onclick: () => abrirFormulario() }, icono('mas'), 'Nueva')),
    filtros,
    visibles.length
      ? h(
          'div',
          { class: 'grupo' },
          visibles.map((e) => publicacion(e, porId.get(e.modulo_id), temas.get(e.id), { conFecha: true })),
        )
      : h('div', { class: 'vacio' }, icono('evaluaciones'), h('h3', {}, lista.length ? 'Nada por aquí' : 'Aún no hay evaluaciones'), h('p', {}, lista.length ? 'Prueba con otro filtro.' : 'Apunta tu próximo examen o entrega con el botón +.')),
  );
}

/** Fila editable de un tema (casilla + texto + quitar). */
function filaTema(tema = {}) {
  const fila = h(
    'div',
    { class: 'renglon', 'data-id': tema.id ?? null },
    h('input', { type: 'checkbox', class: 'casilla', checked: !!tema.estudiado, 'aria-label': 'Estudiado' }),
    h('input', { type: 'text', value: tema.texto ?? '', 'aria-label': 'Tema', maxlength: 200 }),
    h('button', { type: 'button', class: 'boton redondo', 'aria-label': 'Quitar tema', onclick: () => fila.remove() }, icono('cerrar')),
  );
  return fila;
}

/**
 * Abre el formulario para crear (sin argumentos) o editar una evaluación.
 * `valoresIniciales` permite precargar campos (p. ej. el módulo elegido).
 */
export async function abrirFormulario(ev = null, valoresIniciales = {}) {
  const modulos = await repoModulos.listar();
  if (!modulos.length) {
    alert('Primero crea al menos un módulo (pestaña Tú).');
    return;
  }
  const temas = ev ? await repo.listarTemas(ev.id) : [];
  // Por defecto: mañana a las 08:30
  const porDefecto = new Date(Date.now() + 86_400_000);
  porDefecto.setHours(8, 30, 0, 0);
  const v = { tipo: 'examen_teorico', evaluacion: '1', estado: 'pendiente', fecha: porDefecto.toISOString(), modulo_id: modulos[0].id, ...valoresIniciales, ...(ev ?? {}) };
  const { fecha, hora: horaInicial } = aInputs(v.fecha);

  const listaTemas = h('div', { class: 'lista-edit' }, temas.map(filaTema));
  const nuevoTema = h('input', { type: 'text', placeholder: 'Añade un tema y pulsa Intro', 'aria-label': 'Nuevo tema', maxlength: 200, onkeydown: (e) => e.key === 'Enter' && (e.preventDefault(), anadirTema()) });
  const error = h('p', { class: 'error', role: 'alert' });

  const form = h(
    'form',
    { class: 'formulario', onsubmit: guardar, novalidate: true },
    h('input', { name: 'titulo', type: 'text', class: 'grande', value: v.titulo ?? '', maxlength: 120, placeholder: '¿Qué tienes?', 'aria-label': 'Título' }),
    opciones('Módulo', 'modulo_id', modulos.map((m) => ({ valor: m.id, texto: m.abreviatura, color: m.color })), v.modulo_id),
    opciones('Tipo', 'tipo', TIPOS, v.tipo),
    h('div', { class: 'dos' }, campo('Día', h('input', { name: 'fecha', type: 'date', value: fecha })), campo('Hora', h('input', { name: 'hora', type: 'time', value: horaInicial }))),
    h('fieldset', {}, h('legend', {}, 'Temas que entran'), listaTemas, h('div', { class: 'anadir' }, nuevoTema, h('button', { type: 'button', class: 'boton', onclick: anadirTema }, 'Añadir')), h('p', { class: 'ayuda' }, 'Marca cada tema cuando lo tengas estudiado.')),
    opciones('Evaluación', 'evaluacion', PERIODOS, v.evaluacion, 'segmentos'),
    opciones('Estado', 'estado', ESTADOS, v.estado, 'segmentos'),
    h(
      'div',
      { class: 'dos' },
      campo('Nota', h('input', { name: 'nota', type: 'number', min: 0, max: 10, step: 0.01, inputmode: 'decimal', value: v.nota ?? '', placeholder: '0 – 10' })),
      campo('Enlace', h('input', { name: 'enlace', type: 'url', value: v.enlace ?? '', placeholder: 'https://' })),
    ),
    campo('Notas', h('textarea', { name: 'notas', maxlength: 2000, placeholder: 'Lo que entra, material, lo que dijo el profe…' }, v.notas ?? '')),
    error,
    h(
      'div',
      { class: 'hoja-pie' },
      ev ? h('button', { type: 'button', class: 'boton peligro redondo', 'aria-label': 'Borrar evaluación', onclick: borrar }, icono('papelera')) : null,
      h('button', { type: 'submit', class: 'boton primario' }, ev ? 'Guardar cambios' : 'Publicar'),
    ),
  );
  const hoja = abrirHoja(ev ? 'Editar' : 'Nueva evaluación', form);
  if (!ev) form.titulo.focus();

  function anadirTema() {
    const texto = nuevoTema.value.trim();
    if (!texto) return;
    listaTemas.append(filaTema({ texto }));
    nuevoTema.value = '';
    nuevoTema.focus();
  }

  async function guardar(e) {
    e.preventDefault();
    anadirTema(); // por si escribió un tema y no pulsó "Añadir"
    const d = new FormData(form);
    const titulo = d.get('titulo').trim();
    const enlace = d.get('enlace').trim();
    const nota = d.get('nota');
    if (!titulo) return mostrarError('Ponle un título.', form.titulo);
    if (!d.get('fecha')) return mostrarError('Elige el día.', form.fecha);
    if (enlace && !enlaceSeguro(enlace)) return mostrarError('El enlace tiene que empezar por http:// o https://', form.enlace);
    if (nota !== '' && !(Number(nota) >= 0 && Number(nota) <= 10)) return mostrarError('La nota va de 0 a 10.', form.nota);

    const nuevosTemas = [...listaTemas.children]
      .map((fila) => ({
        ...(temas.find((t) => t.id === fila.dataset.id) ?? {}),
        texto: fila.querySelector('input[type="text"]').value.trim(),
        estudiado: fila.querySelector('input[type="checkbox"]').checked,
      }))
      .filter((t) => t.texto);
    try {
      await repo.guardar(
        {
          ...(ev ?? {}),
          titulo,
          modulo_id: d.get('modulo_id'),
          tipo: d.get('tipo'),
          fecha: deInputs(d.get('fecha'), d.get('hora')),
          evaluacion: d.get('evaluacion'),
          estado: d.get('estado'),
          nota: nota === '' ? null : Number(nota),
          enlace: enlace ? enlaceSeguro(enlace) : null,
          notas: d.get('notas').trim(),
        },
        nuevosTemas,
      );
      hoja.close();
    } catch (err) {
      console.error(err);
      mostrarError(`No se ha podido guardar: ${err.message}`);
    }
  }

  function mostrarError(texto, campoConError) {
    error.textContent = texto;
    campoConError?.focus();
  }

  async function borrar() {
    if (!confirm(`¿Borrar «${ev.titulo}»? No se puede deshacer.`)) return;
    await repo.borrar(ev.id);
    hoja.close();
  }
}
