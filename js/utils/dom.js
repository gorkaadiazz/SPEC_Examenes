// Ayudas para crear la interfaz sin frameworks.
// Todo el texto se inserta como nodo de texto (nunca con innerHTML), así lo
// que escriba el usuario no puede colar HTML ni scripts.

import { icono } from '../ui/iconos.js';

/**
 * Crea un elemento: h('button', { class: 'boton', onclick: fn }, 'Guardar')
 * - atributos `on…` => manejadores de eventos
 * - valores false/null/undefined => se ignoran
 * - hijos: nodos, textos o arrays (los null/false se ignoran)
 */
export function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos ?? {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  poner(el, ...hijos);
  return el;
}

/** Como `cont.append(...)`, pero ignorando los huecos (null/false) de las partes opcionales. */
export function poner(cont, ...hijos) {
  cont.append(...hijos.flat(Infinity).filter((x) => x != null && x !== false));
}

/** Campo de formulario con su etiqueta encima. */
export function campo(texto, control, clase = '') {
  return h('label', { class: `campo ${clase}` }, h('span', {}, texto), control);
}

/**
 * Grupo de opciones con aspecto de chip (radio buttons).
 * @param {string} nombre   name del grupo (lo lee FormData)
 * @param {Array<[string,string]|{valor:string,texto:string,color?:string}>} opciones
 * @param {string} elegido  valor marcado al abrir
 * @param {'chips'|'segmentos'|'colores'} estilo
 */
export function opciones(leyenda, nombre, lista, elegido, estilo = 'chips') {
  return h(
    'fieldset',
    {},
    h('legend', {}, leyenda),
    h(
      'div',
      { class: estilo === 'colores' ? 'chips colores' : estilo },
      lista.map((o) => {
        const { valor, texto, color } = Array.isArray(o) ? { valor: o[0], texto: o[1] } : o;
        return h(
          'label',
          { class: 'chip', style: color ? `--c:${color}` : null },
          h('input', { type: 'radio', name: nombre, value: valor, checked: valor === elegido, 'aria-label': estilo === 'colores' ? texto : null }),
          h('span', {}, estilo === 'colores' ? null : [color ? h('i', { class: 'punto' }) : null, texto]),
        );
      }),
    ),
  );
}

/**
 * Abre una hoja que sube desde abajo (en el PC, una ventana centrada).
 * Se elimina sola al cerrarse. Pulsar fuera también la cierra.
 */
export function abrirHoja(titulo, contenido) {
  const d = h(
    'dialog',
    { class: 'hoja', 'aria-labelledby': 'titulo-hoja' },
    h(
      'header',
      { class: 'hoja-cabecera' },
      h('h2', { id: 'titulo-hoja' }, titulo),
      h('button', { type: 'button', class: 'boton redondo', 'aria-label': 'Cerrar', onclick: () => d.close() }, icono('cerrar')),
    ),
    contenido,
  );
  // Un clic en el fondo oscuro llega al propio <dialog>: se cierra.
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}

/** Solo se aceptan enlaces http(s); cualquier otra cosa se descarta. */
export function enlaceSeguro(texto) {
  try {
    const u = new URL(texto);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}
