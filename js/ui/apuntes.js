// Sección "Apuntes" de los formularios: lista de PDF/fotos con botón de subir.
// Los cambios (subir o quitar) se aplican al pulsar Guardar en el formulario,
// así un formulario cancelado no deja archivos sueltos.

import { h } from '../utils/dom.js';
import * as repo from '../repos/archivos.js';
import { TIPOS_ACEPTADOS, problema, tamanoLegible } from '../repos/archivos.js';
import { icono } from './iconos.js';

/** Abre un apunte (fila guardada o File recién elegido) en una pestaña nueva. */
export async function abrirApunte(apunte) {
  const blob = apunte instanceof Blob ? apunte : await repo.contenido(apunte.id);
  if (!blob) {
    alert('Este apunte se subió desde otro dispositivo. Podrás verlo aquí cuando llegue la sincronización.');
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, target: '_blank', rel: 'noopener' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * @param {Array<object>} existentes  filas de `archivos` ya guardadas
 * @param {string} texto  explicación bajo el título
 * @returns {{ el: HTMLElement, aplicar: (destino:{modulo_id:string, evaluacion_id?:string}) => Promise<void> }}
 */
export function seccionApuntes(existentes, texto) {
  const quitados = new Set(); // ids de filas guardadas que se quieren borrar
  const nuevos = []; // File elegidos en este formulario
  let recien = new Set(); // los recién elegidos entran con animación
  const lista = h('div', { class: 'apuntes' });
  const error = h('p', { class: 'error', role: 'alert' });
  const selector = h('input', { type: 'file', accept: TIPOS_ACEPTADOS, multiple: true, class: 'oculto', 'aria-hidden': 'true', tabindex: -1, onchange: elegir });

  function fila({ nombre, tamano, tipo, abrir, quitar, nuevo = false }) {
    const esPdf = tipo === 'application/pdf';
    return h(
      'div',
      { class: `apunte ${nuevo ? 'nuevo' : ''}` },
      h('button', { type: 'button', class: 'apunte-abrir', onclick: abrir }, h('span', { class: `apunte-icono ${esPdf ? 'pdf' : 'foto'}`, 'aria-hidden': 'true' }, esPdf ? 'PDF' : icono('foto')), h('span', { class: 'apunte-texto' }, h('span', { class: 'apunte-nombre' }, nombre), h('span', { class: 'apunte-meta' }, tamanoLegible(tamano)))),
      h('button', { type: 'button', class: 'boton redondo', 'aria-label': `Quitar ${nombre}`, onclick: quitar }, icono('cerrar')),
    );
  }

  function pintar() {
    lista.replaceChildren(
      ...nuevos.map((f, i) => fila({ nombre: f.name, tamano: f.size, tipo: f.type, nuevo: recien.has(f), abrir: () => abrirApunte(f), quitar: () => { nuevos.splice(i, 1); pintar(); } })),
      ...existentes.filter((a) => !quitados.has(a.id)).map((a) => fila({ ...a, abrir: () => abrirApunte(a), quitar: () => { quitados.add(a.id); pintar(); } })),
    );
    recien = new Set();
  }

  function elegir() {
    error.textContent = '';
    const fallos = [];
    for (const f of selector.files) {
      const motivo = problema(f);
      if (motivo) fallos.push(motivo);
      else {
        nuevos.unshift(f);
        recien.add(f);
      }
    }
    selector.value = '';
    error.textContent = fallos.join(' ');
    pintar();
  }

  pintar();
  const el = h(
    'fieldset',
    {},
    h('legend', {}, 'Apuntes'),
    h('p', { class: 'ayuda' }, texto),
    lista,
    error,
    h('div', {}, h('button', { type: 'button', class: 'boton', onclick: () => selector.click() }, icono('subir'), 'Subir PDF o foto'), selector),
  );

  async function aplicar(destino) {
    for (const id of quitados) await repo.borrar(id);
    for (const f of nuevos) await repo.guardar(f, destino);
  }

  return { el, aplicar };
}
