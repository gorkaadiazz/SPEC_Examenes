// Evaluaciones: tarjeta, lista completa con filtros y formulario de alta/edición.

import { h, selector, campo, abrirDialogo, enlaceSeguro } from '../utils/dom.js';
import { cuentaAtras, diasHasta, formatoFecha, aInputLocal, deInputLocal } from '../utils/fechas.js';
import { porcentajePreparado } from '../utils/progreso.js';
import * as repoModulos from '../repos/modulos.js';
import * as repo from '../repos/evaluaciones.js';
import { TIPOS, PERIODOS, ESTADOS, etiqueta } from '../repos/evaluaciones.js';

/** Tarjeta de una evaluación. Al pulsarla se abre para editar. */
export function tarjeta(ev, modulo, temas, ahora = new Date()) {
  const pct = porcentajePreparado(temas);
  const dias = diasHasta(ev.fecha, ahora);
  const esPendiente = ev.estado === 'pendiente';
  const pasada = new Date(ev.fecha) < ahora;
  const claseCuenta = !esPendiente ? '' : pasada ? 'pasada' : dias <= 1 ? 'urgente' : '';

  return h(
    'button',
    { type: 'button', class: 'tarjeta evaluacion', style: `--color-modulo:${modulo?.color ?? ''}`, onclick: () => abrirFormulario(ev) },
    h(
      'span',
      { class: 'fila separa' },
      h('span', { class: 'fila' }, h('span', { class: 'etiqueta' }, `[${modulo?.abreviatura ?? '?'}]`), h('span', { class: 'tenue pequeno' }, etiqueta(TIPOS, ev.tipo))),
      esPendiente ? h('span', { class: `cuenta ${claseCuenta}` }, cuentaAtras(ev.fecha, ahora)) : h('span', { class: `chip ${ev.estado}` }, etiqueta(ESTADOS, ev.estado)),
    ),
    h('span', { class: 'titulo' }, ev.titulo),
    h(
      'span',
      { class: 'fila separa' },
      h('span', { class: 'mono pequeno tenue' }, formatoFecha(ev.fecha)),
      ev.nota != null ? h('span', { class: 'mono pequeno' }, `nota ${ev.nota}`) : null,
    ),
    pct != null
      ? h('span', { class: 'progreso' }, h('span', { class: 'barra' }, h('span', { style: `width:${pct}%` })), `${pct}% preparado`)
      : null,
  );
}

// Filtros de la lista (se conservan mientras la app esté abierta)
const filtro = { modulo: '', estado: 'pendiente' };

/** Pantalla "Todas las evaluaciones". */
export async function render(cont) {
  const [modulos, lista, temas] = await Promise.all([repoModulos.listar(), repo.listar(), repo.temasPorEvaluacion()]);
  const porId = new Map(modulos.map((m) => [m.id, m]));
  const visibles = lista.filter((e) => (!filtro.modulo || e.modulo_id === filtro.modulo) && (!filtro.estado || e.estado === filtro.estado));
  // Las ya hechas se ven mejor de la más reciente a la más antigua.
  if (filtro.estado !== 'pendiente') visibles.reverse();

  const alCambiar = (clave) => (e) => {
    filtro[clave] = e.target.value;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  cont.append(
    h('div', { class: 'cabecera' }, h('h1', {}, 'Evaluaciones'), h('button', { type: 'button', class: 'boton primario', onclick: () => abrirFormulario() }, '+ Nueva')),
    h(
      'div',
      { class: 'dos' },
      campo('Módulo', selector({ onchange: alCambiar('modulo') }, [['', 'Todos'], ...modulos.map((m) => [m.id, `${m.abreviatura} · ${m.nombre}`])], filtro.modulo)),
      campo('Estado', selector({ onchange: alCambiar('estado') }, [['', 'Todos'], ...ESTADOS], filtro.estado)),
    ),
    visibles.length
      ? h('div', { class: 'lista' }, visibles.map((e) => tarjeta(e, porId.get(e.modulo_id), temas.get(e.id))))
      : h('p', { class: 'vacio' }, lista.length ? 'Nada con estos filtros.' : 'Todavía no hay evaluaciones. Crea la primera con «+ Nueva».'),
  );
}

/** Fila editable de un tema dentro del formulario. */
function filaTema(tema = {}) {
  const fila = h(
    'div',
    { class: 'renglon', 'data-id': tema.id ?? null },
    h('input', { type: 'checkbox', checked: !!tema.estudiado, 'aria-label': 'Estudiado' }),
    h('input', { type: 'text', value: tema.texto ?? '', placeholder: 'Tema o apartado', 'aria-label': 'Tema', maxlength: 200 }),
    h('button', { type: 'button', class: 'boton fantasma', 'aria-label': 'Quitar tema', onclick: () => fila.remove() }, '✕'),
  );
  return fila;
}

/** Abre el formulario para crear (sin argumentos) o editar una evaluación. */
export async function abrirFormulario(ev = null, valoresIniciales = {}) {
  const modulos = await repoModulos.listar();
  if (!modulos.length) {
    alert('Primero crea al menos un módulo (Más → Módulos).');
    return;
  }
  const temas = ev ? await repo.listarTemas(ev.id) : [];
  // Por defecto: mañana a las 08:30
  const porDefecto = new Date(Date.now() + 86_400_000);
  porDefecto.setHours(8, 30, 0, 0);
  const v = { tipo: 'examen_teorico', evaluacion: '1', estado: 'pendiente', fecha: porDefecto.toISOString(), ...valoresIniciales, ...(ev ?? {}) };

  const listaTemas = h('div', { class: 'lista' }, temas.map(filaTema));
  const error = h('p', { class: 'error', role: 'alert' });

  const form = h(
    'form',
    { class: 'formulario', onsubmit: guardar },
    campo('Título', h('input', { name: 'titulo', type: 'text', value: v.titulo ?? '', required: true, maxlength: 120, placeholder: 'p. ej. Examen UD3: DHCP y DNS' })),
    h(
      'div',
      { class: 'dos' },
      campo('Módulo', selector({ name: 'modulo_id', required: true }, modulos.map((m) => [m.id, `${m.abreviatura} · ${m.nombre}`]), v.modulo_id)),
      campo('Tipo', selector({ name: 'tipo' }, TIPOS, v.tipo)),
      campo('Fecha y hora', h('input', { name: 'fecha', type: 'datetime-local', value: aInputLocal(v.fecha), required: true })),
      campo('Evaluación', selector({ name: 'evaluacion' }, PERIODOS, v.evaluacion)),
      campo('Estado', selector({ name: 'estado' }, ESTADOS, v.estado)),
      campo('Nota (0-10)', h('input', { name: 'nota', type: 'number', min: 0, max: 10, step: 0.01, inputmode: 'decimal', value: v.nota ?? '' })),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Temas que entran (marca lo estudiado)'),
      listaTemas,
      h('div', {}, h('button', { type: 'button', class: 'boton', onclick: anadirTema }, '+ Añadir tema')),
    ),
    campo('Enlace (aula virtual, enunciado…)', h('input', { name: 'enlace', type: 'url', value: v.enlace ?? '', placeholder: 'https://' })),
    campo('Notas', h('textarea', { name: 'notas', maxlength: 2000 }, v.notas ?? '')),
    h('p', { class: 'tenue pequeno' }, 'Los RA que evalúa y los PDF del temario se añadirán en las fases 4 y 6.'),
    error,
    h(
      'div',
      { class: 'acciones' },
      ev ? h('button', { type: 'button', class: 'boton peligro izquierda', onclick: borrar }, 'Borrar') : null,
      h('button', { type: 'button', class: 'boton', onclick: () => dialogo.close() }, 'Cancelar'),
      h('button', { type: 'submit', class: 'boton primario' }, 'Guardar'),
    ),
  );
  const dialogo = abrirDialogo(ev ? 'Editar evaluación' : 'Nueva evaluación', form);

  function anadirTema() {
    const fila = filaTema();
    listaTemas.append(fila);
    fila.querySelector('input[type="text"]').focus();
  }

  async function guardar(e) {
    e.preventDefault();
    const d = new FormData(form);
    const enlace = d.get('enlace').trim();
    if (enlace && !enlaceSeguro(enlace)) {
      error.textContent = 'El enlace tiene que empezar por http:// o https://';
      return;
    }
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
          titulo: d.get('titulo').trim(),
          modulo_id: d.get('modulo_id'),
          tipo: d.get('tipo'),
          fecha: deInputLocal(d.get('fecha')),
          evaluacion: d.get('evaluacion'),
          estado: d.get('estado'),
          nota: d.get('nota') === '' ? null : Number(d.get('nota')),
          enlace: enlace ? enlaceSeguro(enlace) : null,
          notas: d.get('notas').trim(),
        },
        nuevosTemas,
      );
      dialogo.close();
    } catch (err) {
      console.error(err);
      error.textContent = `No se ha podido guardar: ${err.message}`;
    }
  }

  async function borrar() {
    if (!confirm(`¿Borrar «${ev.titulo}»? No se puede deshacer.`)) return;
    await repo.borrar(ev.id);
    dialogo.close();
  }
}
