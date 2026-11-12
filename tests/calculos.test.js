// Tests de notas por RA, faltas, subredes, .ics y repaso. Ejecutar con: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { modeloRA, modeloPorcentajes, resumen, necesitoEnParte, necesitoEnModulo, simular, limiteFaltas, estadoFaltas } from '../js/notas.js';
import { interpretar, red, dividir, vlsm, ipABinario, convertir, cidrDeMascara } from '../js/tools/subredes.js';
import { generarICS } from '../js/utils/ics.js';
import { repasar, pendientes } from '../js/tools/repaso.js';

const ras = [{ id: 'r1', codigo: 'RA1', peso: 40 }, { id: 'r2', codigo: 'RA2', peso: 60 }];
const evs = [{ id: 'e1', nota: 8 }, { id: 'e2', nota: 4 }, { id: 'e3', nota: null }, { id: 'e4', nota: null }];
const enlaces = [
  { evaluacion_id: 'e1', ra_id: 'r1', peso: 100 },
  { evaluacion_id: 'e2', ra_id: 'r2', peso: 50 },
  { evaluacion_id: 'e3', ra_id: 'r2', peso: 50 },
  { evaluacion_id: 'e4', ra_id: 'r1', peso: 100 },
];

test('nota por RA y del módulo: media ponderada', () => {
  const r = resumen(modeloRA(ras, enlaces, evs));
  assert.equal(r.partes[0].nota, 8);
  assert.equal(r.partes[1].nota, 4);
  assert.equal(r.nota, 5.6); // (40·8 + 60·4) / 100
});

test('el módulo no está aprobado si un RA está por debajo de 5, aunque la media dé aprobado', () => {
  const r = resumen(modeloRA(ras, enlaces, evs));
  assert.equal(r.aprobado, false);
  assert.deepEqual(r.suspensas, ['RA2']);
});

test('sin notas no hay nota ni aprobado', () => {
  const r = resumen(modeloRA(ras, enlaces, evs.map((e) => ({ ...e, nota: null }))));
  assert.equal(r.nota, null);
  assert.equal(r.aprobado, null);
});

test('¿qué necesito? por RA', () => {
  const m = modeloRA(ras, enlaces, evs);
  assert.equal(necesitoEnParte(m.partes[1], 5), 6); // (5·100 − 50·4) / 50
  assert.equal(necesitoEnParte(m.partes[0], 5), 2); // ya llevo 8 en la mitad
  assert.equal(necesitoEnParte({ items: [{ id: 'x', peso: 100, nota: 7 }] }, 5), null); // nada pendiente
});

test('¿qué necesito? en el módulo: manda el RA más flojo', () => {
  const m = modeloRA(ras, enlaces, evs);
  // Para un 5 de media bastaría menos, pero RA2 necesita un 6 para llegar a 5
  assert.equal(necesitoEnModulo(m, 5).nota, 6);
  // Para un 7: módulo(x) = 2.8 + 0.5x  ->  x = 8.4
  assert.equal(necesitoEnModulo(m, 7).nota, 8.4);
  assert.equal(necesitoEnModulo(m, 9).imposible, true);
});

test('RA cerrado por debajo de 5: imposible', () => {
  const m = modeloRA(ras, enlaces, [{ id: 'e1', nota: 8 }, { id: 'e2', nota: 2 }, { id: 'e3', nota: 3 }, { id: 'e4', nota: null }]);
  const n = necesitoEnModulo(m, 5);
  assert.equal(n.imposible, true);
  assert.match(n.motivo, /RA2/);
});

test('simulador: si saco X en un examen', () => {
  const m = simular(modeloRA(ras, enlaces, evs), 'e3', 8);
  const r = resumen(m);
  assert.equal(r.partes[1].nota, 6);
  assert.equal(r.aprobado, true);
  assert.equal(r.nota, 6.8);
});

test('sistema de porcentajes: exámenes y prácticas', () => {
  const lista = [{ id: 'a', tipo: 'examen_teorico', nota: 6 }, { id: 'b', tipo: 'practica', nota: 9 }, { id: 'c', tipo: 'trabajo', nota: 7 }, { id: 'd', tipo: 'examen_practico', nota: null }];
  const m = modeloPorcentajes(lista, 60);
  const r = resumen(m);
  assert.equal(r.nota, 6.8); // 0.6·6 + 0.4·8
  assert.equal(r.aprobado, true);
  assert.equal(resumen(modeloPorcentajes([{ id: 'a', tipo: 'examen_teorico', nota: 3 }, { id: 'b', tipo: 'practica', nota: 10 }], 50)).aprobado, true); // 6.5: aquí no se exige ≥5 en cada parte
});

test('faltas: límite y niveles', () => {
  assert.equal(limiteFaltas(6, 30, 25), 45);
  assert.equal(limiteFaltas(null, 30), null);
  const f = (horas, justificada = false) => ({ horas, justificada });
  assert.deepEqual(estadoFaltas([f(10), f(5, true)], 45), { horas: 10, limite: 45, quedan: 35, proporcion: 10 / 45, nivel: 'ok' });
  assert.equal(estadoFaltas([f(32)], 45).nivel, 'aviso'); // 71 %
  assert.equal(estadoFaltas([f(41)], 45).nivel, 'peligro'); // 91 %
  assert.equal(estadoFaltas([f(10), f(5, true)], 45, true).horas, 15);
  assert.equal(estadoFaltas([f(50)], 45).quedan, 0);
});

test('subredes: datos de una red', () => {
  const { ip, cidr } = interpretar('192.168.1.130/26');
  const r = red(ip, cidr);
  assert.equal(r.red, '192.168.1.128');
  assert.equal(r.mascara, '255.255.255.192');
  assert.equal(r.wildcard, '0.0.0.63');
  assert.equal(r.broadcast, '192.168.1.191');
  assert.equal(r.primerHost, '192.168.1.129');
  assert.equal(r.ultimoHost, '192.168.1.190');
  assert.equal(r.hosts, 62);
});

test('subredes: máscara decimal, /8, /31 y /32', () => {
  assert.deepEqual(interpretar('10.0.0.1 255.0.0.0'), { ip: 167772161, cidr: 8 });
  assert.deepEqual(interpretar('10.0.0.1', '255.255.0.0').cidr, 16);
  assert.equal(red(interpretar('10.20.30.40/8').ip, 8).broadcast, '10.255.255.255');
  assert.equal(red(interpretar('10.0.0.5/31').ip, 31).hosts, 2);
  assert.equal(red(interpretar('10.0.0.5/32').ip, 32).primerHost, '10.0.0.5');
  assert.equal(red(interpretar('200.1.2.3/0').ip, 0).red, '0.0.0.0');
  assert.equal(cidrDeMascara('255.255.255.128'), 25);
  assert.equal(cidrDeMascara('255.0.255.0'), null);
});

test('subredes: entradas incorrectas', () => {
  assert.throws(() => interpretar('300.1.1.1/24'), /IP/);
  assert.throws(() => interpretar('192.168.1.1'), /máscara/);
  assert.throws(() => interpretar('192.168.1.1/33'), /máscara/);
  assert.throws(() => interpretar('192.168.1.1 255.0.255.0'), /máscara/);
});

test('subredes: dividir en N subredes iguales', () => {
  const s = dividir(interpretar('192.168.1.0/24').ip, 24, 3); // 3 -> 4 subredes /26
  assert.deepEqual(s.map((x) => `${x.red}/${x.cidr}`), ['192.168.1.0/26', '192.168.1.64/26', '192.168.1.128/26', '192.168.1.192/26']);
  assert.throws(() => dividir(interpretar('192.168.1.0/30').ip, 30, 4), /caben/);
});

test('subredes: VLSM', () => {
  const s = vlsm(interpretar('192.168.1.0/24').ip, 24, [10, 100, 50, 2]);
  assert.deepEqual(s.map((x) => `${x.red}/${x.cidr}`), ['192.168.1.0/25', '192.168.1.128/26', '192.168.1.192/28', '192.168.1.208/30']);
  assert.deepEqual(s.map((x) => x.hosts), [126, 62, 14, 2]);
  assert.throws(() => vlsm(interpretar('192.168.1.0/24').ip, 24, [200, 100]), /caben/);
});

test('conversor de bases e IP en binario', () => {
  assert.deepEqual(convertir('255', 'dec'), { dec: '255', bin: '11111111', hex: 'FF' });
  assert.deepEqual(convertir('1010', 'bin'), { dec: '10', bin: '1010', hex: 'A' });
  assert.deepEqual(convertir('0xff', 'hex'), { dec: '255', bin: '11111111', hex: 'FF' });
  assert.equal(convertir('12a', 'dec'), null);
  assert.equal(convertir('18446744073709551615', 'dec').hex, 'FFFFFFFFFFFFFFFF');
  assert.equal(ipABinario('192.168.1.10'), '11000000.10101000.00000001.00001010');
});

test('.ics: evento con aviso, texto escapado y líneas plegadas', () => {
  const ics = generarICS([{ id: 'abc', titulo: 'Examen DHCP, DNS; y más', fecha: '2026-11-13T07:30:00.000Z', notas: 'Línea 1\nLínea 2', modulo: { abreviatura: 'SOR', nombre: 'Sistemas Operativos en Red' } }], { ahora: new Date('2026-11-12T10:00:00Z') });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /UID:abc@examenes-2smr\r\n/);
  assert.match(ics, /DTSTART:20261113T073000Z\r\n/);
  assert.match(ics, /DTEND:20261113T083000Z\r\n/);
  assert.ok(ics.includes('SUMMARY:[SOR] Examen DHCP\\, DNS\\; y más\r\n'));
  assert.match(ics, /DESCRIPTION:Sistemas Operativos en Red\\nLínea 1\\nLínea 2\r\n/);
  assert.match(ics, /TRIGGER:-P1D\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  const largo = generarICS([{ id: 'x', titulo: 'a'.repeat(200), fecha: '2026-11-13T07:30:00Z' }]);
  assert.ok(largo.split('\r\n').every((l) => l.length <= 75));
});

test('flashcards: repetición espaciada', () => {
  const ahora = new Date(2026, 10, 12, 10);
  assert.deepEqual(repasar({ nivel: 0 }, 'se', ahora), { nivel: 1, proxima_revision: '2026-11-13' });
  assert.deepEqual(repasar({ nivel: 2 }, 'se', ahora), { nivel: 3, proxima_revision: '2026-11-19' });
  assert.deepEqual(repasar({ nivel: 3 }, 'dudosa', ahora), { nivel: 3, proxima_revision: '2026-11-13' });
  assert.deepEqual(repasar({ nivel: 4 }, 'no', ahora), { nivel: 0, proxima_revision: '2026-11-12' });
  assert.equal(repasar({ nivel: 5 }, 'se', ahora).nivel, 5);
  const p = pendientes([{ id: 1, proxima_revision: '2026-11-20' }, { id: 2, proxima_revision: '2026-11-12' }, { id: 3, proxima_revision: '2026-11-01' }], ahora);
  assert.deepEqual(p.map((t) => t.id), [3, 2]);
});
