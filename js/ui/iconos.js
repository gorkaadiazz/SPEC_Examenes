// Iconos de línea (SVG dibujados a mano, todos con el mismo grosor).
// Son trazos fijos: nunca llevan datos del usuario.

const TRAZOS = {
  inicio: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  calendario: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4',
  notas: 'M5 20V10M10 20V4M15 20v-7M20 20v-4',
  estudiar: 'M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13',
  mas: 'M12 5v14M5 12h14',
  perfil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c1.2-3.5 4-5 7.5-5s6.3 1.5 7.5 5',
  evaluaciones: 'M8 4.5h8M6 7h12a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM9 12h6M9 16h4',
  ajustes: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  cerrar: 'M6 6l12 12M18 6 6 18',
  todos: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
  alerta: 'M12 4 2.5 20h19zM12 10v4.5M12 17.2v.1',
  flecha: 'M9 5l7 7-7 7',
  papelera: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13',
  chispa: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  instalar: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  subir: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15',
  foto: 'M5 6.5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1zM4 15l4.5-4 4 3.5 2.5-2 5 4M15.5 10.2v.1',
  clip: 'M15.5 7.5 8.6 14.4a2 2 0 0 0 2.8 2.8l7.4-7.4a4 4 0 0 0-5.7-5.7l-7.4 7.4a6 6 0 0 0 8.5 8.5L20 14.2',
};

/** Devuelve un <svg> con el icono pedido. */
export function icono(nombre) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icono');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', TRAZOS[nombre] ?? TRAZOS.chispa);
  svg.append(p);
  return svg;
}
