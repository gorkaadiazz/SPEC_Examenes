// Pantalla "Herramientas" (sección 5.2): calculadora de subredes, conversor,
// chuleta de puertos y chuletas de comandos. Todo funciona sin conexión.

import { h, poner, campo, opciones, abrirHoja } from '../utils/dom.js';
import { interpretar, red, dividir, vlsm, ipABinario, convertir, ipANumero } from '../tools/subredes.js';
import { chuletas as repoChuletas } from '../repos/varios.js';
import { icono } from './iconos.js';

const estado = { pestana: 'subredes', ip: '192.168.1.10/24', modo: 'datos', n: '4', hosts: '50, 20, 10, 2', base: 'dec', numero: '', ipBin: '', buscaPuerto: '', buscaComando: '', categoria: '' };
const repintar = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
let datos = null; // puertos y comandos (se cargan una vez)

async function cargarDatos() {
  if (!datos) {
    const [puertos, comandos] = await Promise.all(['./data/puertos.json', './data/comandos.json'].map((u) => fetch(u).then((r) => (r.ok ? r.json() : []), () => [])));
    datos = { puertos, comandos };
  }
  return datos;
}

const dato = (nombre, valor) => h('div', { class: 'dato' }, h('span', {}, nombre), h('b', { class: 'num' }, String(valor)));
const tablaRedes = (lista) =>
  h(
    'div',
    { class: 'tabla-scroll' },
    h(
      'table',
      { class: 'tabla' },
      h('thead', {}, h('tr', {}, ['Red', 'Primer host', 'Último host', 'Broadcast', 'Hosts'].map((t) => h('th', {}, t)))),
      h('tbody', {}, lista.map((r) => h('tr', {}, h('td', {}, `${r.red}/${r.cidr}`), h('td', {}, r.primerHost), h('td', {}, r.ultimoHost), h('td', {}, r.broadcast), h('td', {}, r.pedidos ? `${r.hosts} (pedías ${r.pedidos})` : String(r.hosts))))),
    ),
  );

/**
 * Entrada de texto que guarda en el estado mientras se escribe. No redibuja
 * la pantalla (así no se pierde el foco ni un toque en otra pestaña): quien
 * la usa actualiza solo su zona de resultados con `alEscribir`.
 */
function entrada(claveEstado, atributos = {}, alEscribir = null) {
  return h('input', { type: 'text', value: estado[claveEstado], autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', ...atributos, oninput: (e) => { estado[claveEstado] = e.target.value; alEscribir?.(e.target); } });
}

function subredes() {
  const resultado = h('div', { class: 'resultado', 'aria-live': 'polite' });
  const calcular = () => {
    let nodo;
    try {
      const { ip, cidr } = interpretar(estado.ip);
      if (estado.modo === 'dividir') nodo = tablaRedes(dividir(ip, cidr, Number(estado.n)));
      else if (estado.modo === 'vlsm') nodo = tablaRedes(vlsm(ip, cidr, estado.hosts.split(/[,\s]+/).filter(Boolean).map(Number)));
      else {
        const r = red(ip, cidr);
        nodo = h('div', { class: 'datos' }, dato('Red', `${r.red}/${r.cidr}`), dato('Máscara', r.mascara), dato('Wildcard', r.wildcard), dato('Broadcast', r.broadcast), dato('Primer host', r.primerHost), dato('Último host', r.ultimoHost), dato('Hosts', r.hosts.toLocaleString('es-ES')), dato('IP en binario', ipABinario(ip)));
      }
    } catch (e) {
      nodo = h('p', { class: 'error', role: 'alert' }, e.message);
    }
    resultado.replaceChildren(nodo);
  };
  calcular();
  const selModo = opciones('Qué quieres', 'modo', [['datos', 'Datos de la red'], ['dividir', 'Dividir'], ['vlsm', 'VLSM']], estado.modo, 'segmentos');
  selModo.addEventListener('change', (e) => { estado.modo = e.target.value; repintar(); });
  return [
    campo('IP y máscara (CIDR o decimal)', entrada('ip', { placeholder: '192.168.1.10/24' }, calcular)),
    selModo,
    estado.modo === 'dividir' ? campo('Número de subredes', entrada('n', { inputmode: 'numeric' }, calcular)) : null,
    estado.modo === 'vlsm' ? campo('Hosts de cada subred (separados por comas)', entrada('hosts', {}, calcular)) : null,
    resultado,
  ];
}

function conversor() {
  const resNumero = h('div', { class: 'resultado', 'aria-live': 'polite' });
  const resIp = h('div', { class: 'resultado', 'aria-live': 'polite' });
  const calcular = () => {
    const c = estado.numero ? convertir(estado.numero, estado.base) : null;
    resNumero.replaceChildren(...(estado.numero ? [c ? h('div', { class: 'datos' }, dato('Decimal', c.dec), dato('Binario', c.bin.replace(/\B(?=(\d{4})+(?!\d))/g, ' ')), dato('Hexadecimal', c.hex)) : h('p', { class: 'error', role: 'alert' }, 'Ese número no es válido en esa base.')] : []));
    const bin = estado.ipBin ? ipABinario(estado.ipBin) : null;
    resIp.replaceChildren(...(estado.ipBin ? [bin ? h('div', { class: 'datos' }, dato('Binario', bin), dato('Como número', ipANumero(estado.ipBin).toLocaleString('es-ES'))) : h('p', { class: 'error', role: 'alert' }, 'Esa IP no es válida.')] : []));
  };
  calcular();
  const selBase = opciones('Está escrito en', 'base', [['dec', 'Decimal'], ['bin', 'Binario'], ['hex', 'Hexadecimal']], estado.base, 'segmentos');
  selBase.addEventListener('change', (e) => { estado.base = e.target.value; calcular(); });
  return [campo('Número', entrada('numero', { placeholder: 'Ej.: 255' }, calcular)), selBase, resNumero, campo('IP a binario', entrada('ipBin', { placeholder: '192.168.1.10' }, calcular)), resIp];
}

/** Filtra una lista con el texto del buscador (sin distinguir mayúsculas ni acentos). */
const normal = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const coincide = (texto, busca) => normal(texto).includes(normal(busca));

function puertos({ puertos: lista }) {
  const visibles = lista;
  const oculto = (p) => !!estado.buscaPuerto && !coincide(`${p.puerto} ${p.servicio} ${p.descripcion} ${p.protocolo}`, estado.buscaPuerto);
  return [
    campo('Buscar puerto o servicio', entrada('buscaPuerto', { type: 'search', placeholder: '22, DNS, correo…' }, (el) => filtrarEnVivo(el, '.fila-puerto'))),
    h('div', { class: 'grupo' }, visibles.map((p) => h('div', { class: 'fila-ra fila-puerto', hidden: oculto(p), 'data-busca': normal(`${p.puerto} ${p.servicio} ${p.descripcion} ${p.protocolo}`) }, h('b', { class: 'puerto num' }, String(p.puerto)), h('span', { class: 'cuerpo' }, h('b', {}, p.servicio), h('span', { class: 'meta' }, p.descripcion)), h('span', { class: 'pastilla' }, p.protocolo)))),
  ];
}

/** Oculta las filas que no coinciden mientras se escribe (sin repintar ni perder el foco). */
function filtrarEnVivo(input, selector) {
  const busca = normal(input.value);
  for (const fila of document.querySelectorAll(selector)) fila.hidden = !!busca && !fila.dataset.busca.includes(busca);
}

async function comandos({ comandos: base }) {
  const propios = await repoChuletas.todos();
  const todos = [...propios.map((c) => ({ ...c, propio: true })), ...base];
  const categorias = [...new Set(todos.map((c) => c.categoria))];
  if (!categorias.includes(estado.categoria)) estado.categoria = '';
  const visibles = todos.filter((c) => !estado.categoria || c.categoria === estado.categoria);
  const oculto = (c) => !!estado.buscaComando && !coincide(`${c.comando} ${c.descripcion}`, estado.buscaComando);
  const selCat = h('select', { 'aria-label': 'Categoría', onchange: (e) => { estado.categoria = e.target.value; repintar(); } }, h('option', { value: '' }, 'Todas las categorías'), categorias.map((c) => h('option', { value: c, selected: c === estado.categoria }, c)));
  const copiar = async (boton, texto) => {
    await navigator.clipboard?.writeText(texto).catch(() => {});
    boton.classList.add('copiado');
    setTimeout(() => boton.classList.remove('copiado'), 900);
  };
  return [
    h('div', { class: 'dos' }, selCat, entrada('buscaComando', { type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar comando' }, (el) => filtrarEnVivo(el, '.fila-comando'))),
    h('div', {}, h('button', { type: 'button', class: 'enlace', onclick: () => abrirChuleta(categorias) }, 'Añadir un comando mío')),
    h(
      'div',
      { class: 'grupo' },
      visibles.map((c) =>
        h(
          'div',
          { class: 'fila-ra fila-comando', hidden: oculto(c), 'data-busca': normal(`${c.comando} ${c.descripcion}`) },
          h('span', { class: 'cuerpo' }, h('code', {}, c.comando), h('span', { class: 'meta' }, estado.categoria ? c.descripcion : `${c.categoria} · ${c.descripcion}`)),
          c.propio ? h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Borrar comando', onclick: async () => confirm('¿Borrar este comando?') && repoChuletas.borrar(c.id) }, icono('papelera')) : null,
          h('button', { type: 'button', class: 'boton-icono', 'aria-label': `Copiar ${c.comando}`, title: 'Copiar', onclick: (e) => copiar(e.currentTarget, c.comando) }, icono('copiar')),
        ),
      ),
    ),
  ];
}

function abrirChuleta(categorias) {
  const error = h('p', { class: 'error', role: 'alert' });
  const form = h(
    'form',
    { class: 'formulario', onsubmit: guardar },
    campo('Categoría', h('input', { name: 'categoria', type: 'text', list: 'categorias-chuleta', maxlength: 40, value: estado.categoria || 'Mis comandos' })),
    h('datalist', { id: 'categorias-chuleta' }, categorias.map((c) => h('option', { value: c }))),
    campo('Comando', h('input', { name: 'comando', type: 'text', maxlength: 300, autocapitalize: 'off', spellcheck: 'false' })),
    campo('Para qué sirve', h('input', { name: 'descripcion', type: 'text', maxlength: 200 })),
    error,
    h('div', { class: 'hoja-pie' }, h('button', { type: 'submit', class: 'boton primario' }, 'Guardar comando')),
  );
  const hoja = abrirHoja('Nuevo comando', form);
  async function guardar(e) {
    e.preventDefault();
    const d = new FormData(form);
    const comando = d.get('comando').trim();
    if (!comando) return (error.textContent = 'Escribe el comando.');
    await repoChuletas.guardar({ categoria: d.get('categoria').trim() || 'Mis comandos', comando, descripcion: d.get('descripcion').trim() });
    hoja.close();
  }
}

export async function render(cont) {
  const d = await cargarDatos();
  const pestanas = opciones('Herramienta', 'pestana', [['subredes', 'Subredes'], ['conversor', 'Conversor'], ['puertos', 'Puertos'], ['comandos', 'Comandos']], estado.pestana, 'segmentos');
  pestanas.querySelector('legend').classList.add('oculto');
  pestanas.addEventListener('change', (e) => { if (e.target.name === 'pestana') { estado.pestana = e.target.value; repintar(); } });
  const contenido = { subredes, conversor, puertos: () => puertos(d), comandos: () => comandos(d) }[estado.pestana];
  poner(cont, h('header', { class: 'barra-superior' }, h('h1', { class: 'titulo-pantalla' }, 'Herramientas')), pestanas, h('section', { class: 'seccion herramienta' }, await contenido()));
}
