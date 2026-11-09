// Avisos internos muy simples: los repos emiten 'cambio' al guardar o borrar
// y la app vuelve a pintar la vista que esté abierta.

const oyentes = new Map();

export function escuchar(nombre, fn) {
  if (!oyentes.has(nombre)) oyentes.set(nombre, new Set());
  oyentes.get(nombre).add(fn);
}

export function emitir(nombre, dato) {
  for (const fn of oyentes.get(nombre) ?? []) fn(dato);
}
