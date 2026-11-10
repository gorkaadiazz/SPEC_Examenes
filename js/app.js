// Arranque de la app y navegación entre pantallas.
// La navegación usa el "hash" de la URL (#/inicio, #/perfil…), que funciona
// en GitHub Pages sin configurar nada en el servidor.
//
// Con Supabase configurado (js/config.js), sin sesión solo se ve la pantalla
// de login: ninguna vista de datos se pinta sin usuario (sección 6.1).

import { h } from './utils/dom.js';
import { escuchar } from './utils/eventos.js';
import { sembrar, sembrarSiHaceFalta, actualizarDatosAntiguos, ABREVIATURAS_PRECARGADAS } from './repos/modulos.js';
import * as db from './sync/db.js';
import { configurado } from './supabase.js';
import { usuarioActual, recogerVueltaDeLogin, alCerrarSesion } from './auth.js';
import * as sync from './sync/sincronizar.js';
import { soloModulosPrecargados, ORDEN } from './sync/reglas.js';
import * as login from './ui/login.js';
import { icono } from './ui/iconos.js';
import * as inicio from './ui/inicio.js';
import * as evaluaciones from './ui/evaluaciones.js';
import * as modulos from './ui/modulos.js';
import { fotoDePerfil } from './ui/modulos.js';
import * as ajustes from './ui/ajustes.js';
import { pendiente } from './ui/pendiente.js';

// Pantallas. `donde`: 'barra' = barra inferior del móvil y lateral del PC;
// 'pc' = solo en la lateral del PC (en el móvil se llega desde el perfil).
const RUTAS = {
  inicio: { titulo: 'Inicio', donde: 'barra', render: inicio.render },
  calendario: { titulo: 'Calendario', donde: 'barra', render: pendiente('Calendario', 'calendario', 'Vista de mes y de semana con todo lo que tienes, y exportación a Google Calendar.') },
  notas: { titulo: 'Notas', donde: 'barra', render: pendiente('Notas', 'notas', 'Tus notas por RA, cuánto necesitas sacar para aprobar y el control de faltas.') },
  estudiar: { titulo: 'Estudiar', donde: 'pc', render: pendiente('Estudiar', 'estudiar', 'Exámenes de práctica con IA a partir de tus apuntes, Pomodoro y flashcards.') },
  evaluaciones: { titulo: 'Evaluaciones', donde: 'pc', render: evaluaciones.render },
  perfil: { titulo: 'Perfil', donde: 'barra', render: modulos.render },
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

function enlace(ruta) {
  const def = RUTAS[ruta];
  // En el móvil solo se ven los iconos (como en las redes sociales); el texto
  // queda para el PC y para los lectores de pantalla.
  const dibujo = ruta === 'perfil' && window.usuario ? fotoDePerfil(window.usuario, 'mini') : icono(ruta);
  return h('a', { href: `#/${ruta}`, 'data-ruta': ruta, class: def.donde === 'pc' ? 'solo-pc' : null, title: def.titulo }, dibujo, h('span', { class: 'texto' }, def.titulo));
}

/**
 * La barra se crea una sola vez y después solo se cambia cuál está activa:
 * así la pastilla del icono activo puede animarse al cambiar de pestaña.
 */
function pintarNav() {
  if (!nav.childElementCount) {
    const crear = h('button', { type: 'button', class: 'crear', 'aria-label': 'Apuntar examen o entrega', onclick: () => evaluaciones.abrirFormulario(), title: 'Apuntar' }, icono('crear'), h('span', { class: 'texto' }, 'Apuntar'));
    // Móvil: Inicio · Calendario · (+) · Notas · Perfil. Estudiar y la lista
    // completa están en la barra superior del inicio; Ajustes, en el perfil.
    nav.append(
      h('div', { class: 'marca' }, 'Exámenes'),
      enlace('inicio'),
      enlace('calendario'),
      crear,
      enlace('notas'),
      enlace('perfil'),
      enlace('estudiar'),
      enlace('evaluaciones'),
      enlace('ajustes'),
    );
  }
  const actual = rutaActual();
  for (const a of nav.querySelectorAll('a[data-ruta]')) {
    if (a.dataset.ruta === actual) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
let turno = 0; // evita que un pintado lento pise a otro más reciente
let finEntrada = null;

/**
 * Pinta la pantalla actual.
 * - entrada: se llega a la pantalla (abrir la app o cambiar de pestaña):
 *   se reproducen las animaciones de entrada.
 * - transicion: misma pantalla con otro filtro: la tarjeta destacada se
 *   transforma con View Transitions.
 * - Sin opciones (se ha guardado algo): se repinta sin animar nada.
 */
async function pintar({ entrada = false, transicion = false } = {}) {
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
  if (miTurno !== turno) return;

  // Las filas con scroll horizontal (historias) conservan su posición
  const scrolls = new Map([...vista.querySelectorAll('[data-conservar-scroll]')].map((el) => [el.dataset.conservarScroll, el.scrollLeft]));
  const colocar = () => {
    if (entrada) {
      clearTimeout(finEntrada);
      vista.setAttribute('data-entrada', '');
      finEntrada = setTimeout(() => vista.removeAttribute('data-entrada'), 1400);
    } else {
      vista.removeAttribute('data-entrada');
    }
    vista.replaceChildren(contenido);
    pintarEstadoSync(sync.estado);
    for (const el of vista.querySelectorAll('[data-conservar-scroll]')) el.scrollLeft = scrolls.get(el.dataset.conservarScroll) ?? 0;
  };
  if (transicion && document.startViewTransition && !menosMovimiento.matches) document.startViewTransition(colocar);
  else colocar();
}

/** Pantalla de login a pantalla completa (sin barra de navegación). */
function mostrarLogin(mensajeError) {
  document.body.classList.add('sin-sesion');
  document.title = 'Exámenes 2º SMR';
  const contenido = document.createDocumentFragment();
  login.render(contenido, mensajeError);
  vista.setAttribute('data-entrada', '');
  vista.replaceChildren(contenido);
}

/**
 * Prepara la copia local para este usuario antes de pintar nada:
 *  - si era de otra cuenta, se borra;
 *  - si son datos del modo local (sin cuenta), se suben a la nube, salvo que
 *    la cuenta ya tenga datos y aquí solo estén los módulos precargados
 *    (se descartan para no duplicarlos).
 */
async function prepararDatosLocales(usuario) {
  const propietario = (await db.obtener('meta', 'propietario'))?.valor;
  if (propietario && propietario !== usuario.id) await db.borrarTodo();
  if (!propietario) {
    const conteos = Object.fromEntries(await Promise.all(ORDEN.map(async (t) => [t, await db.contar(t)])));
    if (conteos.modulos > 0) {
      let cuentaConDatos = false;
      try {
        cuentaConDatos = (await sync.contarEnServidor('modulos')) > 0;
      } catch (e) {
        console.warn('No se ha podido consultar la cuenta', e);
      }
      const abreviaturas = (await db.todos('modulos')).map((m) => m.abreviatura);
      if (cuentaConDatos && soloModulosPrecargados(conteos, abreviaturas, ABREVIATURAS_PRECARGADAS)) await db.borrarTodo();
      else await sync.reencolarTodo();
    }
  }
  await db.tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put({ clave: 'propietario', valor: usuario.id }));
}

/**
 * Primer inicio de sesión: si después de descargar la cuenta no tiene
 * módulos, se crean los de 2º SMR (sección 3). Solo tras una descarga
 * completa, para no duplicarlos en un dispositivo nuevo sin conexión.
 */
async function sembrarCuandoToque() {
  if (!(await db.obtener('meta', 'primera_descarga'))) return;
  await sembrar();
  await actualizarDatosAntiguos();
}

/** Mantiene al día los indicadores de sincronización que haya en pantalla. */
function pintarEstadoSync(estado) {
  const pendientes = estado.pendientes;
  const cambios = `${pendientes} ${pendientes === 1 ? 'cambio pendiente' : 'cambios pendientes'}`;
  const textos = {
    local: 'Guardado en este dispositivo',
    sincronizando: 'Sincronizando…',
    sincronizado: pendientes ? `Sincronizado · ${cambios}` : 'Sincronizado',
    'sin-conexion': pendientes ? `Sin conexión (${cambios})` : 'Sin conexión',
    error: `Error al sincronizar${pendientes ? ` (${cambios})` : ''}`,
  };
  for (const el of document.querySelectorAll('[data-estado-sync]')) {
    el.textContent = textos[estado.fase];
    el.dataset.fase = estado.fase;
    el.title = estado.mensaje || '';
  }
}

async function arrancar() {
  let usuario = null;
  if (configurado) {
    // Primero se espera a que supabase-js recoja la sesión de la URL (?code=…)
    // y DESPUÉS se limpia la URL. Al revés, la sesión no llegaba a guardarse
    // y al recargar se volvía al login.
    usuario = await usuarioActual();
    const errorDeLogin = recogerVueltaDeLogin();
    if (!usuario) {
      mostrarLogin(errorDeLogin);
      registrarServiceWorker();
      return;
    }
    await prepararDatosLocales(usuario);
    sync.iniciar(usuario);
    alCerrarSesion(() => location.reload());
  } else {
    try {
      await sembrarSiHaceFalta();
    } catch (e) {
      console.error(e); // sin módulos precargados la app sigue funcionando
    }
  }
  window.usuario = usuario; // para mostrar el email en Ajustes
  await pintar({ entrada: true });

  window.addEventListener('hashchange', (e) => {
    // Los filtros vuelven a pintar la misma pantalla con la misma URL
    const cambioDePantalla = e.oldURL !== e.newURL;
    if (cambioDePantalla) window.scrollTo(0, 0);
    pintar(cambioDePantalla ? { entrada: true } : { transicion: true });
  });
  escuchar('cambio', () => pintar()); // algo se ha guardado o borrado
  escuchar('remoto', () => pintar()); // han llegado cambios de otro dispositivo
  escuchar('sync', pintarEstadoSync);
  if (usuario) {
    // Primera sincronización y, si es una cuenta nueva, módulos de 2º SMR
    escuchar('sync', (estado) => {
      if (estado.fase === 'sincronizado') sembrarCuandoToque().catch((e) => console.error(e));
    });
    sync.sincronizar();
  }
  window.addEventListener('online', () => pintar());
  window.addEventListener('offline', () => pintar());
  // El inicio se refresca cada minuto (por si cambia el día).
  setInterval(() => {
    if (rutaActual() === 'inicio' && !document.querySelector('dialog[open]')) pintar();
  }, 60_000);

  registrarServiceWorker();
}

// Service worker: hace que la app sea instalable y funcione sin conexión.
function registrarServiceWorker() {
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
