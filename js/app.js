// Arranque de la app y navegación entre pantallas.
// La navegación usa el "hash" de la URL (#/inicio, #/perfil…), que funciona
// en GitHub Pages sin configurar nada en el servidor.
// En la fase 3 aquí se comprobará la sesión antes de pintar cualquier vista.

import { h } from './utils/dom.js';
import { escuchar } from './utils/eventos.js';
import { sembrarSiHaceFalta } from './repos/modulos.js';
import { icono } from './ui/iconos.js';
import * as inicio from './ui/inicio.js';
import * as evaluaciones from './ui/evaluaciones.js';
import * as modulos from './ui/modulos.js';
import * as ajustes from './ui/ajustes.js';
import { pendiente } from './ui/pendiente.js';

// Pantallas. `donde`: 'barra' = barra inferior del móvil y lateral del PC;
// 'pc' = solo en la lateral del PC (en el móvil se llega desde el perfil).
const RUTAS = {
  inicio: { titulo: 'Inicio', donde: 'barra', render: inicio.render },
  calendario: { titulo: 'Calendario', donde: 'barra', render: pendiente('Calendario', 'calendario', 'Vista de mes y de semana con todo lo que tienes, y exportación a Google Calendar.') },
  notas: { titulo: 'Notas', donde: 'barra', render: pendiente('Notas', 'notas', 'Tus notas por RA, cuánto necesitas sacar para aprobar y el control de faltas.') },
  estudiar: { titulo: 'Estudiar', donde: 'barra', render: pendiente('Estudiar', 'estudiar', 'Exámenes de práctica con IA a partir de tus apuntes, Pomodoro y flashcards.') },
  evaluaciones: { titulo: 'Evaluaciones', donde: 'pc', render: evaluaciones.render },
  perfil: { titulo: 'Tú', donde: 'pc', render: modulos.render },
  ajustes: { titulo: 'Ajustes', donde: 'pc', render: ajustes.render },
};
// Rutas antiguas que siguen funcionando
const ALIAS = { modulos: 'perfil', mas: 'perfil' };

const vista = document.getElementById('vista');
const nav = document.getElementById('nav');

function rutaActual() {
  let r = location.hash.replace(/^#\/?/, '');
  r = ALIAS[r] ?? r;
  return RUTAS[r] ? r : 'inicio';
}

function enlace(ruta, actual) {
  const def = RUTAS[ruta];
  return h('a', { href: `#/${ruta}`, class: def.donde === 'pc' ? 'solo-pc' : null, 'aria-current': ruta === actual ? 'page' : null }, icono(ruta), def.titulo);
}

function pintarNav() {
  const actual = rutaActual();
  const crear = h('button', { type: 'button', class: 'crear', 'aria-label': 'Apuntar examen o entrega', onclick: () => evaluaciones.abrirFormulario() }, icono('mas'), h('span', { class: 'texto' }, 'Apuntar'));
  // Móvil: Inicio · Calendario · (+) · Notas · Estudiar. El resto, en el perfil.
  nav.replaceChildren(
    h('div', { class: 'marca' }, 'Exámenes'),
    enlace('inicio', actual),
    enlace('calendario', actual),
    crear,
    enlace('notas', actual),
    enlace('estudiar', actual),
    enlace('evaluaciones', actual),
    enlace('perfil', actual),
    enlace('ajustes', actual),
  );
}

let turno = 0; // evita que un pintado lento pise a otro más reciente

async function pintar() {
  const miTurno = ++turno;
  const ruta = rutaActual();
  pintarNav();
  document.title = `${RUTAS[ruta].titulo} · Exámenes 2º SMR`;
  const contenido = document.createDocumentFragment();
  try {
    await RUTAS[ruta].render(contenido);
  } catch (e) {
    console.error(e);
    contenido.replaceChildren(h('p', { class: 'error' }, `No se ha podido cargar la pantalla: ${e.message}`));
  }
  if (miTurno === turno) vista.replaceChildren(contenido);
}

async function arrancar() {
  try {
    await sembrarSiHaceFalta();
  } catch (e) {
    console.error(e); // sin módulos precargados la app sigue funcionando
  }
  await pintar();

  window.addEventListener('hashchange', (e) => {
    const cambioDePantalla = e.oldURL !== e.newURL;
    pintar();
    if (cambioDePantalla) window.scrollTo(0, 0);
  });
  escuchar('cambio', pintar); // algo se ha guardado o borrado
  window.addEventListener('online', pintar);
  window.addEventListener('offline', pintar);
  // El inicio se refresca cada minuto (por si cambia el día).
  setInterval(() => {
    if (rutaActual() === 'inicio' && !document.querySelector('dialog[open]')) pintar();
  }, 60_000);

  // Service worker: hace que la app sea instalable y funcione sin conexión.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((e) => console.warn('Service worker no registrado', e));
  }
}

// Chrome avisa con este evento de que la app se puede instalar; guardamos el
// aviso para lanzarlo desde el botón "Instalar app" de Ajustes.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.avisoInstalacion = e;
  if (rutaActual() === 'ajustes') pintar();
});

arrancar();
