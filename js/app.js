// Arranque de la app y navegación entre pantallas.
// La navegación usa el "hash" de la URL (#/inicio, #/modulos…), que funciona
// en GitHub Pages sin configurar nada en el servidor.
// En la fase 3 aquí se comprobará la sesión antes de pintar cualquier vista.

import { h } from './utils/dom.js';
import { escuchar } from './utils/eventos.js';
import { sembrarSiHaceFalta } from './repos/modulos.js';
import * as inicio from './ui/inicio.js';
import * as evaluaciones from './ui/evaluaciones.js';
import * as modulos from './ui/modulos.js';
import * as ajustes from './ui/ajustes.js';
import * as mas from './ui/mas.js';
import { pendiente } from './ui/pendiente.js';

// Iconos de línea fina (trazos SVG fijos, no contienen datos del usuario).
const ICONOS = {
  inicio: 'M4 11l8-7 8 7M6 10v9h12v-9',
  calendario: 'M5 6h14v13H5zM5 10h14M9 4v4M15 4v4',
  notas: 'M5 19V5M5 19h14M9 15v-4M13 15V8M17 15v-6',
  estudiar: 'M4 6l8-3 8 3-8 3zM7 8v5c2 2 8 2 10 0V8',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
  evaluaciones: 'M7 4h10v16H7zM10 8h4M10 12h4M10 16h2',
  modulos: 'M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z',
  ajustes: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4',
};

// Pantallas. `donde`: 'barra' = barra inferior del móvil y lateral del PC,
// 'pc' = solo en la lateral del PC (en el móvil se llega desde "Más").
const RUTAS = {
  inicio: { titulo: 'Inicio', donde: 'barra', render: inicio.render },
  calendario: { titulo: 'Calendario', donde: 'barra', render: pendiente('Calendario', 5, 'Vista de mes y de semana y exportación a .ics.') },
  notas: { titulo: 'Notas', donde: 'barra', render: pendiente('Notas', 4, 'Notas por RA, «¿qué necesito sacar?», simulador y control de faltas.') },
  estudiar: { titulo: 'Estudiar', donde: 'barra', render: pendiente('Estudiar', 6, 'Examen con IA, Pomodoro y flashcards.') },
  mas: { titulo: 'Más', donde: 'movil', render: mas.render },
  evaluaciones: { titulo: 'Evaluaciones', donde: 'pc', render: evaluaciones.render },
  modulos: { titulo: 'Módulos', donde: 'pc', render: modulos.render },
  ajustes: { titulo: 'Ajustes', donde: 'pc', render: ajustes.render },
};
// En el móvil estas pantallas cuelgan de "Más" (para resaltar su pestaña).
const BAJO_MAS = ['evaluaciones', 'modulos', 'ajustes'];

const vista = document.getElementById('vista');
const nav = document.getElementById('nav');

function rutaActual() {
  const r = location.hash.replace(/^#\/?/, '');
  return RUTAS[r] ? r : 'inicio';
}

function icono(nombre) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICONOS[nombre]);
  svg.append(p);
  return svg;
}

function pintarNav() {
  const actual = rutaActual();
  nav.replaceChildren(
    h('div', { class: 'marca' }, '~/2smr'),
    ...Object.entries(RUTAS).map(([ruta, def]) => {
      const activa = ruta === actual || (ruta === 'mas' && BAJO_MAS.includes(actual));
      const clase = def.donde === 'pc' ? 'solo-pc' : def.donde === 'movil' ? 'solo-movil' : '';
      return h('a', { href: `#/${ruta}`, class: clase, 'aria-current': activa ? 'page' : null }, icono(ruta), def.titulo);
    }),
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

  window.addEventListener('hashchange', () => {
    pintar();
    window.scrollTo(0, 0);
  });
  escuchar('cambio', pintar); // algo se ha guardado o borrado
  window.addEventListener('online', pintar);
  window.addEventListener('offline', pintar);
  // Las cuentas atrás del inicio se refrescan cada minuto.
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
