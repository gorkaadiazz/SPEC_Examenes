// Ajustes: tema visual, instalación y datos locales.

import { h, poner, opciones } from '../utils/dom.js';
import { VERSION_APP } from '../config.js';
import { borrarTodo } from '../sync/db.js';
import { configurado } from '../supabase.js';
import { cerrarSesion } from '../auth.js';
import { sincronizar } from '../sync/sincronizar.js';
import { pendientes } from '../sync/cola.js';
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
          h('div', { class: 'fila' }, h('button', { type: 'button', class: 'boton', onclick: () => sincronizar() }, icono('sincronizar'), 'Sincronizar ahora'), h('button', { type: 'button', class: 'boton peligro', onclick: salir }, 'Cerrar sesión')),
          h('p', { class: 'ayuda' }, 'Al cerrar sesión se borra la copia de tus datos de este dispositivo; en la nube no se borra nada.'),
        )
      : h(
          'section',
          { class: 'seccion' },
          h('h2', {}, 'Tus datos'),
          h('p', { class: 'suave' }, configurado ? '' : 'Modo local: todo se guarda solo en este dispositivo. Para sincronizar con el PC hay que configurar Supabase (js/config.js).'),
          h('div', {}, h('button', { type: 'button', class: 'boton peligro', onclick: vaciar }, icono('papelera'), 'Borrar los datos de este dispositivo')),
        ),

    h('p', { class: 'ayuda num' }, `Versión ${VERSION_APP}`),
  );

  async function salir() {
    const n = await pendientes();
    const aviso = n ? `Hay ${n} ${n === 1 ? 'cambio que aún no se ha subido y se perderá' : 'cambios que aún no se han subido y se perderán'}. ` : '';
    if (!confirm(`${aviso}¿Cerrar sesión en este dispositivo?`)) return;
    await cerrarSesion();
  }

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
