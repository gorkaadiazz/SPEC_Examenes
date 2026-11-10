// Pantalla de inicio de sesión (sección 2: sencilla, nombre de la app, un
// único botón "Continuar con Google" y un aviso breve de privacidad).

import { h, poner } from '../utils/dom.js';
import { entrarConGoogle, botonGoogle } from '../auth.js';
import { ilustracion } from './ilustraciones.js';
import { VERSION_APP } from '../config.js';

// Logotipo de Google para el botón de inicio de sesión (colores oficiales)
function logoGoogle() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'logo-google');
  const trazos = [
    ['#FFC107', 'M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z'],
    ['#FF3D00', 'M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z'],
    ['#4CAF50', 'M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z'],
    ['#1976D2', 'M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z'],
  ];
  for (const [color, d] of trazos) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('fill', color);
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

/** Pinta la pantalla de login dentro de `cont`. */
export function render(cont, mensajeError = null) {
  const error = h('p', { class: 'error', role: 'alert' }, mensajeError ?? '');
  const boton = h('button', { type: 'button', class: 'boton google', onclick: entrar }, logoGoogle(), 'Continuar con Google');
  // Hueco para el botón oficial de Google; mientras carga se ve el nuestro
  const hueco = h('div', { class: 'hueco-google' }, boton);

  // Los módulos del ciclo, como una fila de historias de adorno
  const colores = [['#3b6ff5', 'sistemas'], ['#ef4f5a', 'candado'], ['#12a37a', 'red'], ['#f29d12', 'documento'], ['#0fb0c4', 'nube']];
  const adorno = h('div', { class: 'login-historias', 'aria-hidden': 'true' }, colores.map(([c, ilu], i) => h('span', { class: 'avatar', style: `--c:${c};--i:${i}` }, ilustracion(ilu))));

  poner(
    cont,
    h(
      'section',
      { class: 'login' },
      adorno,
      h('h1', {}, 'Exámenes', h('br'), h('span', {}, '2º SMR')),
      h('p', { class: 'suave' }, 'Tus exámenes, entregas, apuntes y notas, en el móvil y en el PC.'),
      hueco,
      error,
      h('p', { class: 'ayuda' }, 'Privacidad: tus datos se guardan en tu propia cuenta y solo tú puedes verlos. Solo pueden entrar los emails autorizados.'),
      h('p', { class: 'ayuda num' }, `Versión ${VERSION_APP}`),
    ),
  );

  // Botón oficial de Google (login sin salir de la app). Si no se puede
  // usar, se queda nuestro botón, que entra pasando por Supabase.
  queueMicrotask(async () => {
    const oficial = h('div', { class: 'boton-google-oficial' });
    hueco.append(oficial);
    const listo = await botonGoogle(oficial, {
      alEntrar: () => location.reload(),
      alError: (texto) => (error.textContent = texto),
    }).catch((e) => {
      console.warn(e);
      return false;
    });
    if (listo) boton.remove();
    else oficial.remove();
  });

  async function entrar() {
    if (!navigator.onLine) {
      error.textContent = 'Necesitas conexión a internet para iniciar sesión.';
      return;
    }
    boton.disabled = true;
    error.textContent = '';
    try {
      await entrarConGoogle(); // la página se va a Google
    } catch (e) {
      boton.disabled = false;
      error.textContent = `No se ha podido abrir el inicio de sesión: ${e.message}`;
    }
  }
}
