// Pantalla provisional para las secciones que llegan en fases posteriores.

import { h, poner } from '../utils/dom.js';
import { icono } from './iconos.js';

export function pendiente(titulo, nombreIcono, descripcion) {
  return (cont) => {
    poner(
      cont,
      h('header', { class: 'cabecera' }, h('h1', {}, titulo)),
      h('div', { class: 'vacio' }, icono(nombreIcono), h('h3', {}, 'Muy pronto'), h('p', {}, descripcion)),
    );
  };
}
