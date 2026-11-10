// Ajustes: tema visual, instalación y datos locales.

import { h, poner, opciones } from '../utils/dom.js';
import { VERSION_APP } from '../config.js';
import { borrarTodo } from '../sync/db.js';
import { icono } from './iconos.js';

export function render(cont) {
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

    h(
      'section',
      { class: 'seccion' },
      h('h2', {}, 'Tus datos'),
      h('p', { class: 'suave' }, 'De momento todo se guarda solo en este dispositivo. La cuenta de Google y la sincronización entre móvil y PC llegan en la próxima fase.'),
      h('div', {}, h('button', { type: 'button', class: 'boton peligro', onclick: vaciar }, icono('papelera'), 'Borrar los datos de este dispositivo')),
    ),

    h('p', { class: 'ayuda num' }, `Versión ${VERSION_APP}`),
  );

  async function instalar() {
    aviso.prompt();
    await aviso.userChoice;
    window.avisoInstalacion = null;
    location.reload();
  }

  async function vaciar() {
    if (!confirm('Se borrarán todos los módulos y evaluaciones de este dispositivo y se volverán a cargar los módulos por defecto. ¿Seguir?')) return;
    await borrarTodo();
    location.hash = '#/inicio';
    location.reload();
  }
}
