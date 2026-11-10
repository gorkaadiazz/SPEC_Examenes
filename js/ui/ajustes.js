// Ajustes: tema visual, instalación y cuenta.

import { h, poner, opciones } from '../utils/dom.js';
import { VERSION_APP } from '../config.js';
import { confirmarCierreDeSesion } from '../auth.js';
import { sincronizar } from '../sync/sincronizar.js';
import { icono } from './iconos.js';

export function render(cont) {
  const usuario = window.usuario; // lo pone app.js tras iniciar sesión
  const aviso = window.avisoInstalacion; // lo guarda app.js si Chrome ofrece instalar
  const instalada = window.matchMedia('(display-mode: standalone)').matches;

  const tema = opciones('Tema', 'tema', [['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Automático']], window.Tema.leer(), 'segmentos');
  tema.addEventListener('change', (e) => window.Tema.guardar(e.target.value));

  poner(
    cont,
    h('header', { class: 'cabecera' }, h('h1', {}, 'Ajustes')),

    h('section', { class: 'seccion' }, h('h2', {}, 'Apariencia'), tema, h('p', { class: 'ayuda' }, 'Automático sigue al modo claro u oscuro del móvil.')),

    h(
      'section',
      { class: 'seccion' },
      h('h2', {}, 'Instalar la app'),
      instalada
        ? h('p', { class: 'suave' }, 'Ya está instalada en este dispositivo.')
        : aviso
          ? h('div', {}, h('button', { type: 'button', class: 'boton primario', onclick: instalar }, icono('instalar'), 'Instalar app'))
          : h('p', { class: 'suave' }, 'En Chrome: menú ⋮ → «Instalar app» o «Añadir a pantalla de inicio».'),
    ),

    usuario
      ? h(
          'section',
          { class: 'seccion' },
          h('h2', {}, 'Tu cuenta'),
          h('p', { class: 'suave' }, 'Has entrado como ', h('b', {}, usuario.email), '. Tus datos se sincronizan entre el móvil y el PC.'),
          h('p', {}, h('span', { class: 'estado-datos', 'data-estado-sync': '' })),
          h('div', { class: 'fila' }, h('button', { type: 'button', class: 'boton', onclick: () => sincronizar() }, icono('sincronizar'), 'Sincronizar ahora'), h('button', { type: 'button', class: 'boton peligro', onclick: confirmarCierreDeSesion }, icono('salir'), 'Cerrar sesión')),
        )
      : null,

    h('p', { class: 'ayuda num' }, `Versión ${VERSION_APP}`),
  );


  async function instalar() {
    aviso.prompt();
    await aviso.userChoice;
    window.avisoInstalacion = null;
    location.reload();
  }

}
