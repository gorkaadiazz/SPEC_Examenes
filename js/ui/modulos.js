// Módulos: lista y formulario (datos del módulo + sus RA con su peso).

import { h, selector, campo, abrirDialogo } from '../utils/dom.js';
import * as repo from '../repos/modulos.js';
import { SISTEMAS_NOTAS } from '../repos/modulos.js';

export async function render(cont) {
  const modulos = await repo.listar();
  cont.append(
    h('div', { class: 'cabecera' }, h('h1', {}, 'Módulos'), h('button', { type: 'button', class: 'boton primario', onclick: () => abrirFormulario() }, '+ Nuevo')),
    modulos.length
      ? h(
          'div',
          { class: 'lista' },
          modulos.map((m) =>
            h(
              'button',
              { type: 'button', class: 'tarjeta evaluacion', style: `--color-modulo:${m.color}`, onclick: () => abrirFormulario(m) },
              h('span', { class: 'fila separa' }, h('span', { class: 'etiqueta' }, `[${m.abreviatura}]`), h('span', { class: 'mono pequeno tenue' }, m.horas_semanales ? `${m.horas_semanales} h/sem` : 'horas sin indicar')),
              h('span', { class: 'titulo' }, m.nombre),
              m.profesor ? h('span', { class: 'tenue pequeno' }, m.profesor) : null,
            ),
          ),
        )
      : h('p', { class: 'vacio' }, 'No hay módulos. Crea uno con «+ Nuevo».'),
  );
}

/** Fila editable de un RA. */
function filaRA(ra = {}) {
  const fila = h(
    'div',
    { class: 'renglon', 'data-id': ra.id ?? null },
    h('input', { type: 'text', class: 'corto', value: ra.codigo ?? '', placeholder: 'RA1', 'aria-label': 'Código del RA', maxlength: 8 }),
    h('input', { type: 'text', value: ra.descripcion ?? '', placeholder: 'Descripción', 'aria-label': 'Descripción del RA', maxlength: 300 }),
    h('input', { type: 'number', class: 'corto', value: ra.peso ?? '', placeholder: '%', 'aria-label': 'Peso del RA en %', min: 0, max: 100, step: 0.01 }),
    h('button', { type: 'button', class: 'boton fantasma', 'aria-label': 'Quitar RA', onclick: () => { fila.remove(); fila.dispatchEvent(new Event('input')); } }, '✕'),
  );
  return fila;
}

async function abrirFormulario(modulo = null) {
  const ras = modulo ? await repo.listarRA(modulo.id) : [];
  const v = { color: '#8f9aa6', sistema_notas: 'ra', ...(modulo ?? {}) };

  const suma = h('span', { class: 'mono pequeno tenue' });
  const listaRA = h('div', { class: 'lista' }, ras.map(filaRA));
  const error = h('p', { class: 'error', role: 'alert' });

  function leerRA() {
    return [...listaRA.children]
      .map((fila) => {
        const [codigo, descripcion, peso] = fila.querySelectorAll('input');
        return {
          ...(ras.find((r) => r.id === fila.dataset.id) ?? {}),
          codigo: codigo.value.trim().toUpperCase(),
          descripcion: descripcion.value.trim(),
          peso: Number(peso.value) || 0,
        };
      })
      .filter((r) => r.codigo);
  }
  function actualizarSuma() {
    const total = leerRA().reduce((s, r) => s + r.peso, 0);
    suma.textContent = listaRA.children.length ? `suma de pesos: ${Math.round(total * 100) / 100} %` : '';
  }

  const form = h(
    'form',
    { class: 'formulario', onsubmit: guardar },
    campo('Nombre', h('input', { name: 'nombre', type: 'text', value: v.nombre ?? '', required: true, maxlength: 120 })),
    h(
      'div',
      { class: 'dos' },
      campo('Abreviatura', h('input', { name: 'abreviatura', type: 'text', value: v.abreviatura ?? '', required: true, maxlength: 6 })),
      campo('Color', h('input', { name: 'color', type: 'color', value: v.color })),
      campo('Profesor/a', h('input', { name: 'profesor', type: 'text', value: v.profesor ?? '', maxlength: 80 })),
      campo('Horas semanales', h('input', { name: 'horas_semanales', type: 'number', min: 0, max: 40, step: 0.5, inputmode: 'decimal', value: v.horas_semanales ?? '' })),
    ),
    campo('Sistema de notas', selector({ name: 'sistema_notas' }, SISTEMAS_NOTAS, v.sistema_notas)),
    h(
      'fieldset',
      { oninput: actualizarSuma },
      h('legend', {}, 'Resultados de Aprendizaje (código · descripción · peso %)'),
      listaRA,
      h('div', { class: 'fila separa' }, h('button', { type: 'button', class: 'boton', onclick: anadirRA }, '+ Añadir RA'), suma),
    ),
    error,
    h(
      'div',
      { class: 'acciones' },
      modulo ? h('button', { type: 'button', class: 'boton peligro izquierda', onclick: borrar }, 'Borrar') : null,
      h('button', { type: 'button', class: 'boton', onclick: () => dialogo.close() }, 'Cancelar'),
      h('button', { type: 'submit', class: 'boton primario' }, 'Guardar'),
    ),
  );
  const dialogo = abrirDialogo(modulo ? 'Editar módulo' : 'Nuevo módulo', form);
  actualizarSuma();

  function anadirRA() {
    const fila = filaRA({ codigo: `RA${listaRA.children.length + 1}` });
    // Al quitar una fila hay que recalcular la suma (el evento ya no burbujea).
    fila.addEventListener('input', actualizarSuma);
    listaRA.append(fila);
    fila.querySelectorAll('input')[1].focus();
    actualizarSuma();
  }
  for (const fila of listaRA.children) fila.addEventListener('input', actualizarSuma);

  async function guardar(e) {
    e.preventDefault();
    const d = new FormData(form);
    const horas = d.get('horas_semanales');
    try {
      await repo.guardar(
        {
          ...(modulo ?? {}),
          nombre: d.get('nombre').trim(),
          abreviatura: d.get('abreviatura').trim().toUpperCase(),
          color: d.get('color'),
          profesor: d.get('profesor').trim(),
          horas_semanales: horas === '' ? null : Number(horas),
          sistema_notas: d.get('sistema_notas'),
        },
        leerRA(),
      );
      dialogo.close();
    } catch (err) {
      console.error(err);
      error.textContent = `No se ha podido guardar: ${err.message}`;
    }
  }

  async function borrar() {
    if (!confirm(`¿Borrar el módulo «${modulo.nombre}» con todas sus evaluaciones y RA? No se puede deshacer.`)) return;
    await repo.borrar(modulo.id);
    dialogo.close();
  }
}
