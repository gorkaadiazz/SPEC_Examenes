// Tests de las utilidades puras. Ejecutar con: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { diasHasta, cuandoLargo, cuandoCorto, aInputs, deInputs, diaSemana, saludo } from '../js/utils/fechas.js';
import { porcentajePreparado } from '../js/utils/progreso.js';

const ahora = new Date(2026, 10, 9, 10, 0, 0); // lunes 9 nov 2026, 10:00 (hora local)
const dia = (d, h = 9) => new Date(2026, 10, d, h, 0).toISOString();

test('diasHasta cuenta días naturales, no bloques de 24 h', () => {
  assert.equal(diasHasta(new Date(2026, 10, 9, 23, 59).toISOString(), ahora), 0); // hoy
  assert.equal(diasHasta(new Date(2026, 10, 10, 0, 5).toISOString(), ahora), 1); // mañana
  assert.equal(diasHasta(new Date(2026, 10, 8, 23, 0).toISOString(), ahora), -1); // ayer
});

test('cuandoLargo y cuandoCorto', () => {
  assert.equal(cuandoLargo(dia(9, 20), ahora), 'Hoy');
  assert.equal(cuandoLargo(dia(10), ahora), 'Mañana');
  assert.equal(cuandoLargo(dia(13), ahora), 'En 4 días');
  assert.equal(cuandoLargo(dia(8), ahora), 'Ayer');
  assert.equal(cuandoLargo(dia(5), ahora), 'Hace 4 días');
  assert.equal(cuandoCorto(dia(13), ahora), '4 días');
  assert.equal(cuandoCorto(dia(5), ahora), 'Hace 4 d');
});

test('diaSemana en español con mayúscula', () => {
  assert.equal(diaSemana(dia(12)), 'Jueves 12');
});

test('saludo según la hora', () => {
  assert.equal(saludo(new Date(2026, 10, 9, 8)), 'Buenos días');
  assert.equal(saludo(new Date(2026, 10, 9, 17)), 'Buenas tardes');
  assert.equal(saludo(new Date(2026, 10, 9, 23)), 'Buenas noches');
});

test('inputs de fecha y hora: ida y vuelta sin perder la hora', () => {
  assert.deepEqual(aInputs(deInputs('2026-11-12', '09:30')), { fecha: '2026-11-12', hora: '09:30' });
  assert.equal(aInputs(deInputs('2026-11-12', '')).hora, '08:00');
});

test('porcentajePreparado', () => {
  assert.equal(porcentajePreparado([]), null);
  assert.equal(porcentajePreparado(undefined), null);
  assert.equal(porcentajePreparado([{ estudiado: true }, { estudiado: false }, { estudiado: false }]), 33);
  assert.equal(porcentajePreparado([{ estudiado: true }]), 100);
});
