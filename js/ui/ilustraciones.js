// Ilustraciones de los módulos: dibujos sencillos en blanco sobre el color
// del módulo. Cada una es una lista de formas SVG [etiqueta, atributos].
// Clases: a = blanco, b = blanco translúcido, c = color oscuro del módulo,
// sa / sc = lo mismo pero como trazo (línea) en vez de relleno.

const DIBUJOS = {
  sistemas: [
    ['rect', { x: 6, y: 9, width: 27, height: 21, rx: 3.5, class: 'b' }],
    ['rect', { x: 15, y: 17, width: 27, height: 21, rx: 3.5, class: 'a' }],
    ['circle', { cx: 19.5, cy: 21.5, r: 1.7, class: 'c' }],
    ['circle', { cx: 24.5, cy: 21.5, r: 1.7, class: 'c' }],
    ['path', { d: 'M20 28.5h16M20 33h9', class: 'sc', 'stroke-width': 2.6 }],
  ],
  candado: [
    ['path', { d: 'M16.5 21v-4a7.5 7.5 0 0 1 15 0v4', class: 'sa', 'stroke-width': 4.2 }],
    ['rect', { x: 10, y: 21, width: 28, height: 20, rx: 4.5, class: 'a' }],
    ['circle', { cx: 24, cy: 29.5, r: 3.2, class: 'c' }],
    ['rect', { x: 22.4, y: 30, width: 3.2, height: 6.5, rx: 1.6, class: 'c' }],
  ],
  red: [
    ['circle', { cx: 24, cy: 24, r: 16, class: 'a' }],
    ['ellipse', { cx: 24, cy: 24, rx: 7, ry: 16, class: 'sc', 'stroke-width': 2.4 }],
    ['path', { d: 'M8 24h32M10.5 16h27M10.5 32h27', class: 'sc', 'stroke-width': 2.4 }],
  ],
  documento: [
    ['path', { d: 'M15 7h13l9 9v23a2.5 2.5 0 0 1-2.5 2.5h-19.5A2.5 2.5 0 0 1 12.5 39V9.5A2.5 2.5 0 0 1 15 7z', class: 'a' }],
    ['path', { d: 'M28 7l9 9h-6.5A2.5 2.5 0 0 1 28 13.5z', class: 'b' }],
    ['rect', { x: 17, y: 29, width: 3.6, height: 7, rx: 1, class: 'c' }],
    ['rect', { x: 22.2, y: 23, width: 3.6, height: 13, rx: 1, class: 'c' }],
    ['rect', { x: 27.4, y: 26.5, width: 3.6, height: 9.5, rx: 1, class: 'c' }],
  ],
  nube: [
    ['path', { d: 'M15 36a8.5 8.5 0 0 1-1.3-16.9A11.5 11.5 0 0 1 35.6 17 9.5 9.5 0 0 1 34 36z', class: 'a' }],
    ['path', { d: 'M24 31.5v-10M19.5 25.5l4.5-4.5 4.5 4.5', class: 'sc', 'stroke-width': 2.8 }],
  ],
  maletin: [
    ['path', { d: 'M18 16v-3a2.5 2.5 0 0 1 2.5-2.5h7A2.5 2.5 0 0 1 30 13v3', class: 'sa', 'stroke-width': 3.2 }],
    ['rect', { x: 7, y: 16, width: 34, height: 23, rx: 4.5, class: 'a' }],
    ['path', { d: 'M7 25.5h34', class: 'sc', 'stroke-width': 2.4 }],
    ['rect', { x: 20.5, y: 22.5, width: 7, height: 6, rx: 1.6, class: 'c' }],
  ],
  cohete: [
    ['path', { d: 'M16.5 27l-5.5 6 1 4.5 6.5-4z', class: 'b' }],
    ['path', { d: 'M31.5 27l5.5 6-1 4.5-6.5-4z', class: 'b' }],
    ['path', { d: 'M24 6c6.5 4.5 9.5 12 8.3 21.5L29.5 34h-11l-2.8-6.5C14.5 18 17.5 10.5 24 6z', class: 'a' }],
    ['circle', { cx: 24, cy: 19.5, r: 3.8, class: 'c' }],
    ['path', { d: 'M20.5 36.5h7L24 43z', class: 'b' }],
  ],
  empresa: [
    ['rect', { x: 11, y: 7, width: 26, height: 34, rx: 2.5, class: 'a' }],
    ['rect', { x: 15.5, y: 12, width: 4.5, height: 4.5, rx: 1, class: 'c' }],
    ['rect', { x: 21.75, y: 12, width: 4.5, height: 4.5, rx: 1, class: 'c' }],
    ['rect', { x: 28, y: 12, width: 4.5, height: 4.5, rx: 1, class: 'c' }],
    ['rect', { x: 15.5, y: 19.5, width: 4.5, height: 4.5, rx: 1, class: 'c' }],
    ['rect', { x: 21.75, y: 19.5, width: 4.5, height: 4.5, rx: 1, class: 'c' }],
    ['rect', { x: 28, y: 19.5, width: 4.5, height: 4.5, rx: 1, class: 'c' }],
    ['rect', { x: 20.5, y: 31, width: 7, height: 10, rx: 1.5, class: 'c' }],
  ],
  libro: [
    ['path', { d: 'M7 12.5c6.5-2.5 12-1.5 17 2v25c-5-3.5-10.5-4.5-17-2z', class: 'a' }],
    ['path', { d: 'M41 12.5c-6.5-2.5-12-1.5-17 2v25c5-3.5 10.5-4.5 17-2z', class: 'b' }],
  ],
  portatil: [
    ['rect', { x: 11, y: 11, width: 26, height: 19, rx: 2.5, class: 'a' }],
    ['rect', { x: 14.5, y: 14.5, width: 19, height: 12, rx: 1.2, class: 'c' }],
    ['path', { d: 'M6 33h36l-2.5 4.5h-31z', class: 'a' }],
  ],
  idea: [
    ['path', { d: 'M24 6.5a11.5 11.5 0 0 0-6.8 20.8c1.3 1 2.1 2.5 2.1 4.1V33h9.4v-1.6c0-1.6.8-3.1 2.1-4.1A11.5 11.5 0 0 0 24 6.5z', class: 'a' }],
    ['rect', { x: 19.3, y: 35, width: 9.4, height: 3, rx: 1.5, class: 'b' }],
    ['rect', { x: 21, y: 40, width: 6, height: 2.6, rx: 1.3, class: 'b' }],
    ['path', { d: 'M20.5 20.5l3.5 3.5 3.5-3.5', class: 'sc', 'stroke-width': 2.4 }],
  ],
  estrella: [
    ['path', { d: 'M24 6.5l5.1 10.9 11.9 1.4-8.8 8.1 2.4 11.8L24 32.8l-10.6 5.9 2.4-11.8-8.8-8.1 11.9-1.4z', class: 'a' }],
  ],
};

// Para el selector del formulario de módulo: [clave, nombre].
export const ILUSTRACIONES = [
  ['sistemas', 'Sistemas'],
  ['candado', 'Seguridad'],
  ['red', 'Red'],
  ['documento', 'Documento'],
  ['nube', 'Nube'],
  ['maletin', 'Trabajo'],
  ['cohete', 'Proyecto'],
  ['empresa', 'Empresa'],
  ['libro', 'Libro'],
  ['portatil', 'Portátil'],
  ['idea', 'Idea'],
  ['estrella', 'Estrella'],
];

/** Devuelve el <svg> de una ilustración. */
export function ilustracion(clave) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', 'ilu');
  svg.setAttribute('aria-hidden', 'true');
  for (const [etiqueta, atributos] of DIBUJOS[clave] ?? DIBUJOS.libro) {
    const forma = document.createElementNS(ns, etiqueta);
    for (const [k, v] of Object.entries(atributos)) forma.setAttribute(k, v);
    svg.append(forma);
  }
  return svg;
}
