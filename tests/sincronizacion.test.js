// Tests de las reglas de sincronización. Ejecutar con: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { limpiarFila, decidirDescarga, nombreSeguro, rutaApunte, soloModulosPrecargados, ORDEN, COLUMNAS } from '../js/sync/reglas.js';

test('limpiarFila solo deja columnas que existen en Supabase', () => {
  const fila = { id: '1', titulo: 'Examen', user_id: 'x', sync_at: 'y', inventada: 3, created_at: 'a', updated_at: 'b', nota: null };
  assert.deepEqual(limpiarFila('evaluaciones', fila), { id: '1', titulo: 'Examen', created_at: 'a', updated_at: 'b', nota: null });
});

test('todas las tablas que se suben tienen columnas definidas', () => {
  for (const t of ORDEN) assert.ok(COLUMNAS[t]?.includes('id'), t);
});

test('los padres se suben antes que los hijos', () => {
  const pos = (t) => ORDEN.indexOf(t);
  assert.ok(pos('modulos') < pos('evaluaciones'));
  assert.ok(pos('evaluaciones') < pos('temas'));
  assert.ok(pos('resultados_aprendizaje') < pos('evaluacion_ra'));
  assert.ok(pos('evaluaciones') < pos('archivos'));
});

test('decidirDescarga: gana el cambio más reciente', () => {
  const viejo = { updated_at: '2026-11-10T10:00:00Z' };
  const nuevo = { updated_at: '2026-11-10T11:00:00Z' };
  const subir = { op: 'upsert' };
  assert.equal(decidirDescarga(viejo, undefined, nuevo), 'aplicar'); // sin cambios locales
  assert.equal(decidirDescarga(nuevo, undefined, viejo), 'aplicar'); // sin cambios locales manda el servidor
  assert.equal(decidirDescarga(viejo, subir, nuevo), 'aplicar'); // el del servidor es más nuevo
  assert.equal(decidirDescarga(nuevo, subir, viejo), 'ignorar'); // el local es más nuevo
  assert.equal(decidirDescarga(undefined, { op: 'delete' }, nuevo), 'ignorar'); // borrado aquí
});

test('nombreSeguro y rutaApunte', () => {
  assert.equal(nombreSeguro('Tema 3: DHCP y DNS (versión final).pdf'), 'Tema-3-DHCP-y-DNS-version-final-.pdf');
  assert.equal(nombreSeguro('../../etc/passwd'), 'etc-passwd');
  assert.equal(nombreSeguro('???'), 'archivo');
  assert.equal(rutaApunte('u1', { id: 'a1', evaluacion_id: 'e1', modulo_id: 'm1', nombre: 'Tema 1.pdf' }), 'u1/e1/a1-Tema-1.pdf');
  assert.equal(rutaApunte('u1', { id: 'a1', evaluacion_id: null, modulo_id: 'm1', nombre: 'foto.jpg' }), 'u1/modulo-m1/a1-foto.jpg');
});

test('soloModulosPrecargados', () => {
  const semilla = ['SOR', 'SI', 'SR'];
  assert.equal(soloModulosPrecargados({ modulos: 3, evaluaciones: 0, archivos: 0 }, ['SOR', 'SI', 'SR'], semilla), true);
  assert.equal(soloModulosPrecargados({ modulos: 3, evaluaciones: 1 }, ['SOR', 'SI', 'SR'], semilla), false);
  assert.equal(soloModulosPrecargados({ modulos: 1 }, ['REDES'], semilla), false);
});
