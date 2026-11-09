// Pantalla provisional para las secciones que llegan en fases posteriores.

import { h } from '../utils/dom.js';

export function pendiente(titulo, fase, descripcion) {
  return (cont) => {
    cont.append(
      h('h1', {}, titulo),
      h('div', { class: 'vacio' }, h('p', { class: 'mono' }, `// fase ${fase}`), h('p', {}, descripcion)),
    );
  };
}
