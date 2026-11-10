// Pantalla provisional para las secciones que llegan en fases posteriores.

import { h, poner } from '../utils/dom.js';
import { icono } from './iconos.js';

export function pendiente(titulo, nombreIcono, descripcion) {
  return (cont) => {
    poner(
      cont,
      h('header', { class: 'barra-superior' }, h('h1', { class: 'titulo-pantalla' }, titulo)),
      h('div', { class: 'vacio' }, h('span', { class: 'vacio-icono' }, icono(nombreIcono)), h('h2', {}, 'Muy pronto'), h('p', {}, descripcion)),
    );
  };
}
