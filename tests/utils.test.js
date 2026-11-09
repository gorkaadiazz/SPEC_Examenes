// Tests de las utilidades puras. Ejecutar con: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { cuentaAtras, diasHasta, aInputLocal, deInputLocal } from '../js/utils/fechas.js';
import { porcentajePreparado } from '../js/utils/progreso.js';

const ahora = new Date(2026, 10, 9, 10, 0, 0); // 9 nov 2026, 10:00 (hora local)
const dentroDe = (ms) => new Date(ahora.getTime() + ms).toISOString();
const H = 3_600_000;

test('cuentaAtras: días y horas', () => {
  assert.equal(cuentaAtras(dentroDe(3 * 24 * H + 4 * H), ahora), 'T-3d 04h');
});

test('cuentaAtras: menos de un día pasa a horas y minutos', () => {
  assert.equal(cuentaAtras(dentroDe(4 * H + 12 * 60_000), ahora), 'T-04h 12m');
});

test('cuentaAtras: fecha ya pasada', () => {
  assert.equal(cuentaAtras(dentroDe(-(2 * 24 * H + H)), ahora), 'T+2d 01h');
});

test('diasHasta cuenta días naturales, no bloques de 24 h', () => {
  assert.equal(diasHasta(new Date(2026, 10, 9, 23, 59).toISOString(), ahora), 0); // hoy
  assert.equal(diasHasta(new Date(2026, 10, 10, 0, 5).toISOString(), ahora), 1); // mañana
  assert.equal(diasHasta(new Date(2026, 10, 8, 23, 0).toISOString(), ahora), -1); // ayer
});

test('datetime-local: ida y vuelta sin perder la hora', () => {
  assert.equal(aInputLocal(deInputLocal('2026-11-12T09:30')), '2026-11-12T09:30');
});

test('porcentajePreparado', () => {
  assert.equal(porcentajePreparado([]), null);
  assert.equal(porcentajePreparado(undefined), null);
  assert.equal(porcentajePreparado([{ estudiado: true }, { estudiado: false }, { estudiado: false }]), 33);
  assert.equal(porcentajePreparado([{ estudiado: true }]), 100);
});
