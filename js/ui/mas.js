// Pantalla "Más" (móvil): acceso al resto de secciones.

import { h } from '../utils/dom.js';

export function render(cont) {
  const enlace = (ruta, texto) => h('a', { class: 'tarjeta', href: `#/${ruta}` }, h('span', {}, texto), h('span', {}, '→'));
  cont.append(
    h('h1', {}, 'Más'),
    h('div', { class: 'menu' }, enlace('evaluaciones', 'Todas las evaluaciones'), enlace('modulos', 'Módulos'), enlace('ajustes', 'Ajustes')),
    h('p', { class: 'tenue pequeno' }, 'Formación en Empresa, herramientas de redes y copias de seguridad llegarán en las siguientes fases.'),
  );
}
