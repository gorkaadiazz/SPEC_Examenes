// Ayudas para crear la interfaz sin frameworks.
// Todo el texto se inserta como nodo de texto (nunca con innerHTML), así lo
// que escriba el usuario no puede colar HTML ni scripts.

import { icono } from '../ui/iconos.js';

/**
 * Crea un elemento: h('button', { class: 'boton', onclick: fn }, 'Guardar')
 * - atributos `on…` => manejadores de eventos
 * - valores false/null/undefined => se ignoran
 * - hijos: nodos, textos o arrays (los null/false se ignoran)
 */
export function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos ?? {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  poner(el, ...hijos);
  return el;
}

/** Como `cont.append(...)`, pero ignorando los huecos (null/false) de las partes opcionales. */
export function poner(cont, ...hijos) {
  cont.append(...hijos.flat(Infinity).filter((x) => x != null && x !== false));
}

/** Campo de formulario con su etiqueta encima. */
export function campo(texto, control, clase = '') {
  return h('label', { class: `campo ${clase}` }, h('span', {}, texto), control);
}

/**
 * Grupo de opciones con aspecto de chip (radio buttons).
 * @param {string} nombre   name del grupo (lo lee FormData)
 * @param {Array<[string,string]|{valor:string,texto:string,color?:string}>} opciones
 * @param {string} elegido  valor marcado al abrir
 * @param {'chips'|'segmentos'|'colores'} estilo
 */
export function opciones(leyenda, nombre, lista, elegido, estilo = 'chips') {
  return h(
    'fieldset',
    {},
    h('legend', {}, leyenda),
    h(
      'div',
      { class: estilo === 'colores' ? 'chips colores' : estilo },
      lista.map((o) => {
        const { valor, texto, color } = Array.isArray(o) ? { valor: o[0], texto: o[1] } : o;
        return h(
          'label',
          { class: 'chip', style: color ? `--c:${color}` : null },
          h('input', { type: 'radio', name: nombre, value: valor, checked: valor === elegido, 'aria-label': estilo === 'colores' ? texto : null }),
          h('span', {}, estilo === 'colores' ? null : [color ? h('i', { class: 'punto' }) : null, texto]),
        );
      }),
    ),
  );
}

const EASE_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const esMovil = () => window.matchMedia('(max-width: 899px)').matches;
const menosMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Abre una hoja que sube desde abajo (en el PC, una ventana centrada).
 * - Se cierra con la X, con Esc, pulsando fuera o arrastrándola hacia abajo.
 * - Al cerrarse sale por donde entró y después se elimina.
 * - `hoja.close()` (lo usan los formularios al guardar) también anima.
 */
export function abrirHoja(titulo, contenido) {
  const cabecera = h(
    'header',
    { class: 'hoja-cabecera' },
    h('h2', { id: 'titulo-hoja' }, titulo),
    h('button', { type: 'button', class: 'boton redondo', 'aria-label': 'Cerrar', onclick: () => d.close() }, icono('cerrar')),
  );
  const d = h('dialog', { class: 'hoja', 'aria-labelledby': 'titulo-hoja' }, cabecera, contenido);

  // --- Cierre animado -----------------------------------------------------
  const cerrarYa = HTMLDialogElement.prototype.close.bind(d);
  let cerrando = false;
  d.close = async (desdeY = 0) => {
    if (cerrando) return;
    cerrando = true;
    const reducido = menosMovimiento();
    const salida = !reducido && esMovil()
      ? [{ transform: `translateY(${desdeY}px)` }, { transform: 'translateY(100%)' }]
      : reducido ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }];
    const opciones = { duration: esMovil() ? 280 : 180, easing: esMovil() ? EASE_DRAWER : EASE_OUT, fill: 'forwards' };
    const anim = d.animate(salida, opciones);
    try {
      d.animate([{ opacity: 1 }, { opacity: 0 }], { ...opciones, pseudoElement: '::backdrop' });
    } catch {
      /* navegador sin animación del fondo: no pasa nada */
    }
    await anim.finished.catch(() => {});
    cerrarYa();
  };
  // Esc: en vez del cierre seco del navegador, el animado
  d.addEventListener('cancel', (e) => {
    e.preventDefault();
    d.close();
  });
  // Un clic en el fondo oscuro llega al propio <dialog>: se cierra.
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });

  // --- Arrastrar hacia abajo para cerrar (solo móvil) ---------------------
  let inicioY = 0;
  let inicioT = 0;
  let arrastrando = false;
  let dy = 0;
  cabecera.addEventListener('pointerdown', (e) => {
    if (!esMovil() || arrastrando || e.target.closest('button')) return; // un solo dedo
    arrastrando = true;
    inicioY = e.clientY;
    inicioT = performance.now();
    dy = 0;
    cabecera.setPointerCapture(e.pointerId);
    d.getAnimations().forEach((a) => a.cancel());
    d.style.transition = 'none';
  });
  cabecera.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    const bruto = e.clientY - inicioY;
    // Hacia arriba se resiste cada vez más (fricción, no un muro)
    dy = bruto >= 0 ? bruto : -Math.sqrt(-bruto) * 3;
    d.style.transform = `translateY(${dy}px)`;
  });
  const soltar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    const velocidad = dy / (performance.now() - inicioT); // px/ms
    if (dy > 110 || (dy > 40 && velocidad > 0.11)) {
      d.style.transform = '';
      d.close(dy);
    } else {
      // Vuelve a su sitio
      d.style.transition = `transform 300ms ${EASE_DRAWER}`;
      d.style.transform = '';
    }
  };
  cabecera.addEventListener('pointerup', soltar);
  cabecera.addEventListener('pointercancel', soltar);

  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}

/** Solo se aceptan enlaces http(s); cualquier otra cosa se descarta. */
export function enlaceSeguro(texto) {
  try {
    const u = new URL(texto);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}
