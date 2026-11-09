// Ajustes: tema visual, instalación y datos locales.

import { h, selector, campo } from '../utils/dom.js';
import { VERSION_APP } from '../config.js';
import { borrarTodo } from '../sync/db.js';

export function render(cont) {
  const aviso = window.avisoInstalacion; // lo guarda app.js si Chrome ofrece instalar
  const instalada = window.matchMedia('(display-mode: standalone)').matches;

  cont.append(
    h('h1', {}, 'Ajustes'),

    h(
      'section',
      { class: 'seccion' },
      h('h2', {}, 'Apariencia'),
      campo(
        'Tema',
        selector(
          { onchange: (e) => window.Tema.guardar(e.target.value) },
          [['auto', 'Automático (según el sistema)'], ['oscuro', 'Oscuro'], ['claro', 'Claro']],
          window.Tema.leer(),
        ),
      ),
    ),

    h(
      'section',
      { class: 'seccion' },
      h('h2', {}, 'Instalar'),
      instalada
        ? h('p', { class: 'tenue' }, 'La app ya está instalada en este dispositivo.')
        : aviso
          ? h('div', {}, h('button', { type: 'button', class: 'boton primario', onclick: instalar }, 'Instalar app'))
          : h('p', { class: 'tenue' }, 'En Chrome o Edge: menú ⋮ → «Instalar app» (o «Añadir a pantalla de inicio»). Hace falta abrirla por HTTPS o desde localhost.'),
    ),

    h(
      'section',
      { class: 'seccion' },
      h('h2', {}, 'Datos'),
      h('p', { class: 'tenue' }, 'De momento todo se guarda solo en este dispositivo. La cuenta de Google y la sincronización llegan en la fase 3, y exportar/importar en la fase 8.'),
      h('div', {}, h('button', { type: 'button', class: 'boton peligro', onclick: vaciar }, 'Borrar los datos de este dispositivo')),
    ),

    h('p', { class: 'mono pequeno tenue' }, `v${VERSION_APP}`),
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
