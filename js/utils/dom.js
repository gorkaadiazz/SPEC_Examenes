// Ayudas para crear la interfaz sin frameworks.
// Todo el texto se inserta como nodo de texto (nunca con innerHTML), así lo
// que escriba el usuario no puede colar HTML ni scripts.

/**
 * Crea un elemento: h('button', { class: 'boton', onclick: fn }, 'Guardar')
 * - atributos `on…` => manejadores de eventos
 * - valores false/null/undefined => se ignoran
 * - hijos: nodos, textos o arrays (los null se ignoran)
 */
export function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos ?? {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...hijos.flat(Infinity).filter((x) => x != null && x !== false));
  return el;
}

/** <select> a partir de pares [valor, texto], con `valor` ya elegido. */
export function selector(atributos, opciones, valor) {
  return h(
    'select',
    atributos,
    opciones.map(([v, texto]) => h('option', { value: v, selected: v === valor }, texto)),
  );
}

/** Campo de formulario con su etiqueta encima. */
export function campo(texto, control, clase = '') {
  return h('label', { class: `campo ${clase}` }, h('span', {}, texto), control);
}

/** Abre una ventana modal con título. Se elimina sola al cerrarse. */
export function abrirDialogo(titulo, contenido) {
  const d = h(
    'dialog',
    { class: 'dialogo', 'aria-label': titulo },
    h(
      'header',
      { class: 'dialogo-cabecera' },
      h('h2', {}, titulo),
      h('button', { type: 'button', class: 'boton fantasma', 'aria-label': 'Cerrar', onclick: () => d.close() }, '✕'),
    ),
    contenido,
  );
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

/** Como `cont.append(...)`, pero ignorando los huecos (null/false) de las partes opcionales. */
export function poner(cont, ...hijos) {
  cont.append(...hijos.flat(Infinity).filter((x) => x != null && x !== false));
}
